// DealCheck Vision — Local Processing Daemon
// Subscribes to Supabase Realtime for new deal uploads and processes
// them with Claude Opus 4.7, then writes results back to Supabase.
//
// Usage:
//   node scripts/local-processor.mjs          # daemon mode (keep running)
//   node scripts/local-processor.mjs --once   # process pending deals and exit
//
// Prerequisites:
//   npm install  (dotenv must be in dependencies)
//   Supabase Realtime must be enabled for the 'deals' table:
//     Database → Replication → supabase_realtime publication → add 'deals' table

import dotenv from 'dotenv';
import { createHash } from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import {
  classifyAllDocuments, runComplianceCheck, mimeFromFilename,
  CLASSIFY_MODEL, COMPLIANCE_MODEL, MODEL_PAIR,
  buildClassifyParams, buildComplianceParams, normalizeClassification,
  parseJsonArray, parseJsonObject, messageText,
} from '../lib/vision.mjs';
import { submitBatch, pollBatchUntilDone, collectResults } from '../lib/batch.mjs';
import { cleanScan, sharpnessScore, isPreprocessableImage } from '../lib/preprocessing/clean-scan.mjs';
import { estimateCostUsd } from '../lib/pricing.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

dotenv.config({ path: join(ROOT, '.env.local') });

const ONCE = process.argv.includes('--once');
const BUCKET = 'deal-files';

// Phase 2 — both OFF by default (opt-in via env) so production behavior is
// unchanged until validated with the eval harness (npm run eval -- --preprocess).
//   PREPROCESS_IMAGES=true     grayscale/normalize/denoise image uploads pre-API
//   LEGIBILITY_THRESHOLD=100   reject deals whose any image page scores below it
//                              (<=0 or unset = gate disabled). Applies to images
//                              only; PDFs are sent natively and bypass both.
const PREPROCESS = process.env.PREPROCESS_IMAGES === 'true';
const GATE_THRESHOLD = Number(process.env.LEGIBILITY_THRESHOLD || 0);

// Phase 3.1 — Batch API. OFF by default; lone deals always stay synchronous.
const BATCH_ENABLED = process.env.BATCH_ENABLED === 'true';
const BATCH_MIN_DEALS = Number(process.env.BATCH_MIN_DEALS || 2);
const BATCH_MAX_WAIT_MIN = Number(process.env.BATCH_MAX_WAIT_MIN || 10);

// ---- Clients ----

const supabaseUrl = `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID}.supabase.co`;

const sb = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anthropic = new Anthropic();

// Prevent double-processing the same deal if a Realtime event and a
// polling cycle overlap within the same process instance.
const inFlight = new Set();

// ---- Deal-set deduplication cache (Phase 1.2) ----
//
// A deal-set hash uniquely identifies a set of uploaded files by their CONTENT
// (not filename or storage path), so re-uploading byte-identical files yields
// the same hash even though the deal id and storage paths differ. If we've seen
// this exact set before with the same model, we reuse the stored classification
// and compliance results and skip both (expensive) Opus calls.
//
// Each helper swallows its own errors so a missing `classification_cache` table
// or a transient DB failure degrades to "no caching" rather than breaking the
// pipeline. Run supabase/migrations/*_classification_cache.sql to enable it.

function computeDealSetHash(buffers) {
  const fileHashes = buffers
    .map(b => createHash('sha256').update(b).digest('hex'))
    .sort(); // order-independent: same files in any order → same hash
  return createHash('sha256').update(fileHashes.join('\n')).digest('hex');
}

async function lookupClassificationCache(dealSetHash) {
  try {
    const { data, error } = await sb
      .from('classification_cache')
      .select('classification_result, compliance_result, model_used')
      .eq('deal_set_hash', dealSetHash)
      .maybeSingle();
    if (error) { console.warn('  cache lookup failed:', error.message); return null; }
    return data;
  } catch (err) {
    console.warn('  cache lookup error:', err.message);
    return null;
  }
}

async function saveClassificationCache(dealSetHash, classificationResult, complianceResult) {
  try {
    const { error } = await sb.from('classification_cache').upsert({
      deal_set_hash: dealSetHash,
      classification_result: classificationResult,
      compliance_result: complianceResult,
      model_used: MODEL_PAIR,
      created_at: new Date().toISOString(),
    });
    if (error) console.warn('  cache save failed:', error.message);
  } catch (err) {
    console.warn('  cache save error:', err.message);
  }
}

// Phase 4.1: record one row per Anthropic call. Swallows errors so a missing
// deal_costs table degrades to "no cost tracking" rather than breaking the deal.
async function logDealCost(dealId, callType, model, usage, fromBatch = false) {
  if (!usage) return;
  const cost = estimateCostUsd(model, usage, { batch: fromBatch });
  console.log(`  cost ${callType}: $${cost.toFixed(4)} (${model})`);
  try {
    const { error } = await sb.from('deal_costs').insert({
      deal_id: dealId,
      call_type: callType,
      model,
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
      estimated_cost_usd: cost,
      from_batch: fromBatch,
    });
    if (error) console.warn('  cost log failed:', error.message);
  } catch (err) {
    console.warn('  cost log error:', err.message);
  }
}

// ---- Pipeline ----

// Download a deal's files, compute its dedup hash, and apply Phase 2
// preprocessing/quality-gating. Shared by the sync and batch paths.
// Returns { downloaded, dealSetHash, filesForApi, illegible }.
async function prepareDealFiles(dealId, orgId) {
  const prefix = `${orgId}/${dealId}`;
  const { data: storageList, error: listErr } = await sb.storage.from(BUCKET).list(prefix);
  if (listErr) throw new Error(listErr.message);
  if (!storageList?.length) throw new Error('no files found in storage');

  const downloaded = await Promise.all(
    storageList.map(async entry => {
      const storagePath = `${prefix}/${entry.name}`;
      const originalName = entry.name.replace(/^[0-9a-f-]{36}-/, '');
      const { data: blob, error: dlErr } = await sb.storage.from(BUCKET).download(storagePath);
      if (dlErr) throw new Error(`download failed for ${originalName}: ${dlErr.message}`);
      const bytes = Buffer.from(await blob.arrayBuffer());
      return { originalName, storagePath, bytes };
    })
  );

  const dealSetHash = computeDealSetHash(downloaded.map(f => f.bytes));

  let filesForApi = downloaded.map(f => ({ bytes: f.bytes, filename: f.originalName }));
  let illegible = [];
  if (PREPROCESS || GATE_THRESHOLD > 0) {
    illegible = [];
    filesForApi = await Promise.all(downloaded.map(async f => {
      const mime = mimeFromFilename(f.originalName);
      if (!isPreprocessableImage(mime)) return { bytes: f.bytes, filename: f.originalName };
      if (GATE_THRESHOLD > 0) {
        const score = await sharpnessScore(f.bytes);
        console.log(`  legibility ${f.originalName}: ${score.toFixed(0)} (threshold ${GATE_THRESHOLD})`);
        if (score < GATE_THRESHOLD) illegible.push(f.originalName);
      }
      const bytes = PREPROCESS ? await cleanScan(f.bytes) : f.bytes;
      return { bytes, filename: f.originalName };
    }));
  }

  return { downloaded, dealSetHash, filesForApi, illegible };
}

// Map classification extractions to the stored per-file shape.
function buildPerFile(downloaded, extractions) {
  const storageByName = Object.fromEntries(downloaded.map(f => [f.originalName, f]));
  return extractions.map(ext => {
    const src = storageByName[ext.source_file] || downloaded[0];
    return {
      filename: ext.filename,
      source_file: ext.source_file,
      storage_path: src?.storagePath || null,
      mime_type: mimeFromFilename(src?.originalName || ''),
      doc_type: ext.doc_type || null,
      signed_by_customer: ext.signed_by_customer ?? false,
      signed_by_dealer: ext.signed_by_dealer ?? false,
      fields: ext.fields || null,
    };
  });
}

// Persist a finished deal: cache the result and mark it completed.
async function writeCompletedDeal(dealId, report, perFile, dealSetHash) {
  await saveClassificationCache(dealSetHash, perFile, report);
  await sb.from('deals').update({
    status: 'completed',
    report,
    files: perFile,
    customer_name: report.customer_name || null,
    vehicle_info: report.vehicle_info || null,
    batch_id: null,
    batch_stage: null,
  }).eq('id', dealId);
}

async function processDeal(dealId, orgId) {
  if (inFlight.has(dealId)) return;
  inFlight.add(dealId);

  const ts = () => new Date().toISOString();
  console.log(`\n[${ts()}] deal ${dealId} — starting`);

  try {
    await sb.from('deals').update({ status: 'processing' }).eq('id', dealId);

    const { downloaded, dealSetHash, filesForApi, illegible } = await prepareDealFiles(dealId, orgId);

    // Phase 1.2: reuse a prior identical result.
    const cached = await lookupClassificationCache(dealSetHash);
    if (cached && cached.model_used === MODEL_PAIR) {
      const cachedReport = { ...cached.compliance_result, from_cache: true };
      await writeCompletedDeal(dealId, cachedReport, cached.classification_result, dealSetHash);
      console.log(`[${ts()}] deal ${dealId} — DONE from cache (${cachedReport.overall_status})`);
      return;
    }

    // Phase 2: reject illegible scans before spending tokens.
    if (illegible.length) {
      await sb.from('deals').update({
        status: 'needs_reupload',
        error: `Illegible scan(s): ${illegible.join(', ')}. Please re-upload clearer copies.`,
      }).eq('id', dealId);
      console.log(`[${ts()}] deal ${dealId} — NEEDS REUPLOAD: ${illegible.join(', ')}`);
      return;
    }

    console.log(`  downloaded ${downloaded.length} file(s) — classifying...`);
    let classifyUsage = null;
    const extractions = await classifyAllDocuments(filesForApi, { onUsage: u => { classifyUsage = u; } });
    await logDealCost(dealId, 'classification', CLASSIFY_MODEL, classifyUsage);
    console.log(`  classified ${extractions.length} document(s) — running compliance check...`);

    const perFile = buildPerFile(downloaded, extractions);

    let complianceUsage = null;
    const report = await runComplianceCheck(perFile, { onUsage: u => { complianceUsage = u; } });
    await logDealCost(dealId, 'compliance', COMPLIANCE_MODEL, complianceUsage);

    await writeCompletedDeal(dealId, report, perFile, dealSetHash);
    console.log(`[${ts()}] deal ${dealId} — DONE (${report.overall_status})`);
  } catch (err) {
    await sb.from('deals').update({ status: 'failed', error: String(err?.message || err) }).eq('id', dealId);
    console.error(`[${ts()}] deal ${dealId} — FAILED: ${err.message}`);
  } finally {
    inFlight.delete(dealId);
  }
}

// Phase 3.1: process a burst of pending deals via the Message Batches API.
// Two sequential stages (classify → compliance), each capped at BATCH_MAX_WAIT_MIN;
// on timeout or batch error, stragglers fall back to synchronous calls.
async function runBatchPipeline(pending) {
  const ts = () => new Date().toISOString();
  const maxWaitMs = BATCH_MAX_WAIT_MIN * 60_000;
  console.log(`\n[${ts()}] batch pipeline — ${pending.length} deal(s)`);

  // --- Stage 0: prepare; resolve cache hits + gate failures immediately ---
  const prepared = [];
  for (const d of pending) {
    if (inFlight.has(d.id)) continue;
    inFlight.add(d.id);
    try {
      await sb.from('deals').update({ status: 'classifying', batch_stage: 'classifying' }).eq('id', d.id);
      const prep = await prepareDealFiles(d.id, d.org_id);

      const cached = await lookupClassificationCache(prep.dealSetHash);
      if (cached && cached.model_used === MODEL_PAIR) {
        const report = { ...cached.compliance_result, from_cache: true };
        await writeCompletedDeal(d.id, report, cached.classification_result, prep.dealSetHash);
        console.log(`  deal ${d.id} — from cache`);
        inFlight.delete(d.id);
        continue;
      }
      if (prep.illegible.length) {
        await sb.from('deals').update({
          status: 'needs_reupload',
          error: `Illegible scan(s): ${prep.illegible.join(', ')}. Please re-upload clearer copies.`,
          batch_stage: null,
        }).eq('id', d.id);
        inFlight.delete(d.id);
        continue;
      }
      prepared.push({ dealId: d.id, ...prep });
    } catch (err) {
      await sb.from('deals').update({ status: 'failed', error: String(err?.message || err), batch_stage: null }).eq('id', d.id);
      inFlight.delete(d.id);
    }
  }
  if (!prepared.length) return;

  // --- Stage 1: classification batch ---
  let classifyResults = {};
  try {
    const requests = prepared.map(p => ({ custom_id: p.dealId, params: buildClassifyParams(p.filesForApi, { model: CLASSIFY_MODEL }) }));
    const batchId = await submitBatch(anthropic, requests);
    await Promise.all(prepared.map(p => sb.from('deals').update({ batch_id: batchId }).eq('id', p.dealId)));
    const poll = await pollBatchUntilDone(anthropic, batchId, { maxWaitMs });
    if (poll.status === 'timeout') {
      console.warn(`  classify batch timed out after ${BATCH_MAX_WAIT_MIN}m — cancelling; harvesting completed results`);
      await anthropic.messages.batches.cancel(batchId);
      // Results are only available once the batch ends (canceling → ended).
      // Wait briefly so deals that already finished are harvested instead of
      // being re-billed via the sync fallback.
      await pollBatchUntilDone(anthropic, batchId, { maxWaitMs: 60_000 });
    }
    classifyResults = await collectResults(anthropic, batchId);
  } catch (err) {
    console.warn('  classify batch error — all deals fall back to sync:', err.message);
  }

  const classified = [];
  for (const p of prepared) {
    try {
      const r = classifyResults[p.dealId];
      let extractions;
      if (r && r.type === 'succeeded') {
        await logDealCost(p.dealId, 'classification', CLASSIFY_MODEL, r.message.usage, true);
        extractions = normalizeClassification(parseJsonArray(messageText(r.message.content)), p.filesForApi);
      } else {
        let usage = null;
        extractions = await classifyAllDocuments(p.filesForApi, { onUsage: u => { usage = u; } });
        await logDealCost(p.dealId, 'classification', CLASSIFY_MODEL, usage, false);
      }
      await sb.from('deals').update({ status: 'checking', batch_stage: 'checking' }).eq('id', p.dealId);
      classified.push({ ...p, perFile: buildPerFile(p.downloaded, extractions) });
    } catch (err) {
      await sb.from('deals').update({ status: 'failed', error: String(err?.message || err), batch_id: null, batch_stage: null }).eq('id', p.dealId);
      inFlight.delete(p.dealId);
    }
  }
  if (!classified.length) return;

  // --- Stage 2: compliance batch ---
  let complianceResults = {};
  try {
    const requests = classified.map(c => ({ custom_id: c.dealId, params: buildComplianceParams(c.perFile, { model: COMPLIANCE_MODEL }) }));
    const batchId = await submitBatch(anthropic, requests);
    await Promise.all(classified.map(c => sb.from('deals').update({ batch_id: batchId }).eq('id', c.dealId)));
    const poll = await pollBatchUntilDone(anthropic, batchId, { maxWaitMs });
    if (poll.status === 'timeout') {
      console.warn(`  compliance batch timed out after ${BATCH_MAX_WAIT_MIN}m — cancelling; harvesting completed results`);
      await anthropic.messages.batches.cancel(batchId);
      // Results are only available once the batch ends (canceling → ended).
      // Wait briefly so deals that already finished are harvested instead of
      // being re-billed via the sync fallback.
      await pollBatchUntilDone(anthropic, batchId, { maxWaitMs: 60_000 });
    }
    complianceResults = await collectResults(anthropic, batchId);
  } catch (err) {
    console.warn('  compliance batch error — all deals fall back to sync:', err.message);
  }

  for (const c of classified) {
    try {
      const r = complianceResults[c.dealId];
      let report;
      if (r && r.type === 'succeeded') {
        await logDealCost(c.dealId, 'compliance', COMPLIANCE_MODEL, r.message.usage, true);
        report = parseJsonObject(messageText(r.message.content));
      } else {
        let usage = null;
        report = await runComplianceCheck(c.perFile, { onUsage: u => { usage = u; } });
        await logDealCost(c.dealId, 'compliance', COMPLIANCE_MODEL, usage, false);
      }
      await writeCompletedDeal(c.dealId, report, c.perFile, c.dealSetHash);
      console.log(`[${ts()}] deal ${c.dealId} — DONE (${report.overall_status})`);
    } catch (err) {
      await sb.from('deals').update({ status: 'failed', error: String(err?.message || err), batch_id: null, batch_stage: null }).eq('id', c.dealId);
    } finally {
      inFlight.delete(c.dealId);
    }
  }
}

// ---- Catch-up: process any deals stuck in 'uploaded' ----

async function processPending() {
  const { data, error } = await sb.from('deals').select('id, org_id').eq('status', 'uploaded');
  if (error) { console.error('Error querying pending deals:', error.message); return; }
  if (!data?.length) return;
  console.log(`\nCatch-up: ${data.length} pending deal(s) found`);
  if (BATCH_ENABLED && data.length >= BATCH_MIN_DEALS) {
    await runBatchPipeline(data);
  } else {
    // Process sequentially to avoid hammering the Anthropic API on restart.
    for (const d of data) {
      await processDeal(d.id, d.org_id);
    }
  }
}

// On startup, reset any deal left mid-flight by a crashed run (sync 'processing'
// or batch 'classifying'/'checking') back to 'uploaded' so it is reprocessed.
async function recoverStuckDeals() {
  const { error } = await sb.from('deals')
    .update({ status: 'uploaded', batch_id: null, batch_stage: null })
    .in('status', ['processing', 'classifying', 'checking']);
  if (error) console.warn('Could not reset stuck deals:', error.message);
}

// ---- Entry point ----

async function main() {
  const required = ['NEXT_PUBLIC_SUPABASE_PROJECT_ID', 'SUPABASE_SERVICE_KEY', 'ANTHROPIC_API_KEY'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    console.error('Missing env vars:', missing.join(', '));
    console.error('Make sure .env.local is in the project root.');
    process.exit(1);
  }

  console.log('DealCheck Vision — Local Processor');
  console.log(`Project: ${supabaseUrl}`);
  console.log(`Mode   : ${ONCE ? 'one-shot (--once)' : 'daemon'}\n`);

  await recoverStuckDeals();
  await processPending();

  if (ONCE) {
    console.log('\nDone.');
    process.exit(0);
  }

  // Primary trigger: Supabase Realtime UPDATE events — fires when the upload
  // route flips status from 'uploading' → 'uploaded', guaranteeing all files
  // are in storage before we start downloading them.
  // Requires Realtime enabled for 'deals' table in Supabase dashboard:
  //   Database → Replication → supabase_realtime publication → add 'deals' table
  sb.channel('deals-uploads')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'deals',
      filter: 'status=eq.uploaded',
    }, payload => {
      const deal = payload.new;
      processDeal(deal.id, deal.org_id);
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') {
        console.log('Supabase Realtime connected — listening for uploads...');
      } else if (status === 'CHANNEL_ERROR') {
        console.warn('Realtime subscription error — polling fallback will catch new uploads');
      }
    });

  // Fallback: poll every 60 s in case a Realtime event is missed.
  setInterval(processPending, 60_000);

  console.log('Local processor running. Press Ctrl+C to stop.\n');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

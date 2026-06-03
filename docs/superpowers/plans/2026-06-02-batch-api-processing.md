# Batch API Processing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Process bursts of pending deals through the Anthropic Message Batches API (50% cost) with a per-stage latency cap that falls back to synchronous calls, so no single deal waits hours.

**Architecture:** The local daemon's catch-up sweep routes ≥`BATCH_MIN_DEALS` pending deals through a two-stage batch pipeline (classification batch → compliance batch); lone deals keep the existing synchronous path. Request-building and parsing are extracted from `lib/vision.mjs` so both paths share identical prompt/cache logic. Everything ships behind `BATCH_ENABLED=false`.

**Tech Stack:** Node ESM (`.mjs`), `@anthropic-ai/sdk` Message Batches, Supabase JS, `node:test`.

**Spec:** `docs/superpowers/specs/2026-06-02-batch-api-processing-design.md`

---

## File Structure

- `lib/pricing.mjs` (modify) — add `BATCH_DISCOUNT`; `estimateCostUsd` takes `{ batch }`.
- `lib/pricing.test.mjs` (modify) — batch-discount test.
- `lib/vision.mjs` (modify) — extract `buildClassifyParams`, `buildComplianceParams`, `normalizeClassification`, `messageText`; export `parseJsonArray`/`parseJsonObject`; sync functions reuse them.
- `lib/vision.test.mjs` (create) — builder + normalize tests.
- `lib/batch.mjs` (create) — `submitBatch`, `pollBatchUntilDone`, `collectResults` (client injected).
- `lib/batch.test.mjs` (create) — poll deadline + results-mapping tests with a mock client.
- `supabase/migrations/20260602_batch_columns.sql` (create) — `batch_id`, `batch_stage` columns.
- `scripts/local-processor.mjs` (modify) — extract shared helpers; add `runBatchPipeline`, routing, recovery, env flags.
- `app/deals/[id]/DealView.js` (modify) — `classifying`/`checking` progress labels.

---

## Task 1: Batch discount in pricing

**Files:**
- Modify: `lib/pricing.mjs`
- Test: `lib/pricing.test.mjs`

- [ ] **Step 1: Write the failing test** — append to `lib/pricing.test.mjs`:

```js
test('estimateCostUsd: batch option applies the 50% discount', () => {
  const usage = { input_tokens: 1_000_000, output_tokens: 1_000_000 };
  const full = estimateCostUsd('claude-opus-4-7', usage);
  const batched = estimateCostUsd('claude-opus-4-7', usage, { batch: true });
  assert.ok(Math.abs(full - 90) < 1e-6, `full expected 90, got ${full}`);
  assert.ok(Math.abs(batched - 45) < 1e-6, `batched expected 45, got ${batched}`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `batched` equals 90 (option ignored), assertion throws.

- [ ] **Step 3: Implement** — in `lib/pricing.mjs`, add the constant after the `PRICING` block and replace the `estimateCostUsd` signature/return:

```js
export const BATCH_DISCOUNT = 0.5; // Message Batches API is 50% off
```

```js
export function estimateCostUsd(model, usage, { batch = false } = {}) {
  const p = PRICING[model];
  if (!p || !usage) return 0;
  const fresh = usage.input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const out = usage.output_tokens ?? 0;
  const base = (
    fresh * p.input +
    cacheRead * p.input * CACHE_READ_MULT +
    cacheWrite * p.input * CACHE_WRITE_MULT +
    out * p.output
  ) / 1_000_000;
  return batch ? base * BATCH_DISCOUNT : base;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all pricing tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/pricing.mjs lib/pricing.test.mjs
git commit -m "Phase 3.1: batch discount in cost estimate"
```

---

## Task 2: Extract request builders + parsers in vision.mjs

**Files:**
- Modify: `lib/vision.mjs`
- Test: `lib/vision.test.mjs` (create)

- [ ] **Step 1: Write the failing test** — create `lib/vision.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert';
import {
  buildClassifyParams,
  buildComplianceParams,
  normalizeClassification,
  messageText,
  MODEL,
} from './vision.mjs';

const files = [{ bytes: Buffer.from('fake-png'), filename: 'scan.png' }];

test('buildClassifyParams: shape, default model, cached system block', () => {
  const p = buildClassifyParams(files);
  assert.equal(p.model, MODEL);
  assert.equal(p.max_tokens, 16000);
  assert.equal(p.system[0].cache_control.type, 'ephemeral');
  assert.equal(p.messages[0].role, 'user');
  // text label + image block + trailing instruction
  assert.ok(p.messages[0].content.some((b) => b.type === 'image'));
  assert.ok(p.messages[0].content.some((b) => b.type === 'text' && b.text.includes('scan.png')));
});

test('buildClassifyParams: model override', () => {
  assert.equal(buildClassifyParams(files, { model: 'claude-sonnet-4-6' }).model, 'claude-sonnet-4-6');
});

test('buildComplianceParams: shape + cached system block', () => {
  const p = buildComplianceParams([{ filename: 'x', doc_type: 'bill_of_sale', fields: {} }]);
  assert.equal(p.model, MODEL);
  assert.equal(p.max_tokens, 4096);
  assert.equal(p.system[0].cache_control.type, 'ephemeral');
  assert.equal(p.messages[0].role, 'user');
});

test('normalizeClassification: defaults + indexed filename', () => {
  const out = normalizeClassification([{ doc_type: 'carfax_report', fields: { vin: 'X' } }], files);
  assert.equal(out[0].doc_type, 'carfax_report');
  assert.equal(out[0].source_file, 'scan.png');
  assert.ok(out[0].filename.includes('doc 1'));
  // missing doc_type defaults to 'other'
  assert.equal(normalizeClassification([{ fields: {} }], files)[0].doc_type, 'other');
});

test('messageText: concatenates text blocks only', () => {
  const text = messageText([
    { type: 'text', text: 'a' },
    { type: 'image' },
    { type: 'text', text: 'b' },
  ]);
  assert.equal(text, 'ab');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `buildClassifyParams` etc. are not exported (import error).

- [ ] **Step 3: Implement** — in `lib/vision.mjs`:

(a) Add `export` to the two existing parse helpers so the batch path can reuse them. Change `function parseJsonArray(` → `export function parseJsonArray(` and `function parseJsonObject(` → `export function parseJsonObject(`.

(b) Add these new exported functions (place them just above `export async function classifyAllDocuments`):

```js
// Build the messages.create params for classification. Shared by the sync call
// and the batch path so the prompt, schema, and cache_control live in one place.
export function buildClassifyParams(files, { model = MODEL } = {}) {
  const content = [];
  for (const { bytes, filename } of files) {
    const mimeType = mimeFromFilename(filename);
    content.push({ type: 'text', text: `--- DOCUMENT: ${filename} ---` });
    content.push(toVisionBlock(bytes, mimeType));
  }
  content.push({
    type: 'text',
    text: `Classify all ${files.length} document(s) above and return the JSON array.`,
  });
  return {
    model,
    max_tokens: 16000,
    system: [{ type: 'text', text: CLASSIFY_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content }],
  };
}

// Concatenate the text blocks of a message's content array.
export function messageText(content) {
  return content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

// Normalize raw parsed classification objects into our per-document shape.
export function normalizeClassification(results, files) {
  return results.map((r, i) => {
    const sourceFile = r.source_file || r.filename || (files[0]?.filename ?? 'unknown');
    return {
      filename: `${sourceFile} — doc ${i + 1}`,
      source_file: sourceFile,
      doc_type: r.doc_type || 'other',
      signed_by_customer: r.signed_by_customer ?? false,
      signed_by_dealer: r.signed_by_dealer ?? false,
      fields: r.fields || {},
    };
  });
}
```

(c) Replace the body of `classifyAllDocuments` (keep its existing signature) with the reusing version:

```js
export async function classifyAllDocuments(files, { model = MODEL, onUsage } = {}) {
  if (files.length === 0) return [];
  const res = await getClient().messages.create(buildClassifyParams(files, { model }));
  logCacheUsage(`classify:${files.length}files:${model}`, res.usage);
  if (onUsage) onUsage(res.usage);
  return normalizeClassification(parseJsonArray(messageText(res.content)), files);
}
```

(d) Add the compliance builder (place just above `export async function runComplianceCheck`):

```js
export function buildComplianceParams(perFile, { model = MODEL } = {}) {
  const compliancePrompt = readFileSync(join(process.cwd(), 'compliance-prompt.md'), 'utf8');
  const payload = perFile.map((f) => ({
    filename: f.filename,
    doc_type: f.doc_type,
    signed_by_customer: f.signed_by_customer,
    signed_by_dealer: f.signed_by_dealer,
    fields: f.fields,
  }));
  return {
    model,
    max_tokens: 4096,
    system: [{ type: 'text', text: compliancePrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `Deal jacket extracted data:\n\n${JSON.stringify(payload, null, 2)}` }],
  };
}
```

(e) Replace the body of `runComplianceCheck` (keep its signature) with:

```js
export async function runComplianceCheck(perFile, { model = MODEL, onUsage } = {}) {
  const res = await getClient().messages.create(buildComplianceParams(perFile, { model }));
  logCacheUsage(`compliance:${model}`, res.usage);
  if (onUsage) onUsage(res.usage);
  return parseJsonObject(messageText(res.content));
}
```

- [ ] **Step 4: Run tests + lint to verify pass and no regressions**

Run: `npm test`
Expected: PASS — vision + pricing + preprocessing tests all green.
Run: `npx eslint lib/vision.mjs lib/vision.test.mjs`
Expected: clean (exit 0).

- [ ] **Step 5: Commit**

```bash
git add lib/vision.mjs lib/vision.test.mjs
git commit -m "Phase 3.1: extract shared request builders + parsers in vision"
```

---

## Task 3: Batch client helpers (lib/batch.mjs)

**Files:**
- Create: `lib/batch.mjs`
- Test: `lib/batch.test.mjs` (create)

- [ ] **Step 1: Write the failing test** — create `lib/batch.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert';
import { submitBatch, pollBatchUntilDone, collectResults } from './batch.mjs';

// Minimal mock of client.messages.batches.
function mockClient({ statuses = [], resultsList = [] } = {}) {
  let i = 0;
  return {
    messages: {
      batches: {
        create: async () => ({ id: 'batch_123' }),
        retrieve: async () => ({ processing_status: statuses[Math.min(i++, statuses.length - 1)] }),
        cancel: async () => ({ processing_status: 'canceling' }),
        results: async () => (async function* () { for (const r of resultsList) yield r; })(),
      },
    },
  };
}

test('submitBatch returns the batch id', async () => {
  assert.equal(await submitBatch(mockClient(), []), 'batch_123');
});

test('pollBatchUntilDone returns ended when the batch ends', async () => {
  const client = mockClient({ statuses: ['in_progress', 'ended'] });
  const res = await pollBatchUntilDone(client, 'batch_123', {
    maxWaitMs: 60_000, intervalMs: 0, sleep: async () => {}, now: () => 0,
  });
  assert.equal(res.status, 'ended');
});

test('pollBatchUntilDone returns timeout past the deadline', async () => {
  const client = mockClient({ statuses: ['in_progress'] });
  let t = 0;
  const res = await pollBatchUntilDone(client, 'batch_123', {
    maxWaitMs: 100, intervalMs: 0, sleep: async () => {}, now: () => (t += 1000),
  });
  assert.equal(res.status, 'timeout');
});

test('collectResults maps custom_id to result', async () => {
  const client = mockClient({ resultsList: [
    { custom_id: 'deal-a', result: { type: 'succeeded' } },
    { custom_id: 'deal-b', result: { type: 'errored' } },
  ] });
  const out = await collectResults(client, 'batch_123');
  assert.equal(out['deal-a'].type, 'succeeded');
  assert.equal(out['deal-b'].type, 'errored');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `./batch.mjs` does not exist (import error).

- [ ] **Step 3: Implement** — create `lib/batch.mjs`:

```js
// Anthropic Message Batches helpers. The client is injected so these are unit
// testable with a mock (no real API calls).

// Submit a batch of { custom_id, params } requests; returns the batch id.
export async function submitBatch(client, requests) {
  const batch = await client.messages.batches.create({ requests });
  return batch.id;
}

// Poll a batch until it ends or the deadline passes.
// Returns { status: 'ended' } or { status: 'timeout' }.
export async function pollBatchUntilDone(client, batchId, {
  maxWaitMs,
  intervalMs = 30_000,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  now = () => Date.now(),
} = {}) {
  const start = now();
  for (;;) {
    const batch = await client.messages.batches.retrieve(batchId);
    if (batch.processing_status === 'ended') return { status: 'ended' };
    if (now() - start >= maxWaitMs) return { status: 'timeout' };
    await sleep(intervalMs);
  }
}

// Read all results into an object keyed by custom_id.
// Each value is the SDK result: { type: 'succeeded'|'errored'|'canceled'|'expired', message?, error? }.
export async function collectResults(client, batchId) {
  const out = {};
  for await (const item of await client.messages.batches.results(batchId)) {
    out[item.custom_id] = item.result;
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test`
Expected: PASS — batch tests green.
Run: `npx eslint lib/batch.mjs lib/batch.test.mjs`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add lib/batch.mjs lib/batch.test.mjs
git commit -m "Phase 3.1: Anthropic Message Batches helpers"
```

---

## Task 4: Migration for batch columns

**Files:**
- Create: `supabase/migrations/20260602_batch_columns.sql`

- [ ] **Step 1: Create the migration**

```sql
-- Phase 3.1: batch-processing state on deals.
-- Apply via Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).

alter table public.deals add column if not exists batch_id text;
alter table public.deals add column if not exists batch_stage text; -- 'classifying' | 'checking'

create index if not exists deals_batch_id_idx on public.deals (batch_id);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260602_batch_columns.sql
git commit -m "Phase 3.1: deals batch_id/batch_stage migration"
```

> NOTE TO OPERATOR: This SQL must be run in Supabase **before the Task 5+ processor changes go live** — not just before enabling `BATCH_ENABLED`. The refactored `writeCompletedDeal` clears `batch_id`/`batch_stage` on every completion (sync included), so both columns must exist for any processing to succeed. They are nullable and harmless when batching is off; runtime behavior stays unchanged until `BATCH_ENABLED=true`.

---

## Task 5: Refactor processDeal to share prep helpers (no behavior change)

**Files:**
- Modify: `scripts/local-processor.mjs`

This task only extracts helpers and rewires the existing synchronous `processDeal` to use them. Behavior must stay identical; Task 6 adds the batch path.

- [ ] **Step 1: Add shared helpers** — in `scripts/local-processor.mjs`, immediately above `// ---- Pipeline ----`, add:

```js
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
```

- [ ] **Step 2: Rewrite processDeal to use the helpers** — replace the entire `processDeal` function body (between `inFlight.add(dealId);` and the `catch`) so it reads:

```js
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
    if (cached && cached.model_used === MODEL) {
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
    await logDealCost(dealId, 'classification', MODEL, classifyUsage);
    console.log(`  classified ${extractions.length} document(s) — running compliance check...`);

    const perFile = buildPerFile(downloaded, extractions);

    let complianceUsage = null;
    const report = await runComplianceCheck(perFile, { onUsage: u => { complianceUsage = u; } });
    await logDealCost(dealId, 'compliance', MODEL, complianceUsage);

    await writeCompletedDeal(dealId, report, perFile, dealSetHash);
    console.log(`[${ts()}] deal ${dealId} — DONE (${report.overall_status})`);
  } catch (err) {
    await sb.from('deals').update({ status: 'failed', error: String(err?.message || err) }).eq('id', dealId);
    console.error(`[${ts()}] deal ${dealId} — FAILED: ${err.message}`);
  } finally {
    inFlight.delete(dealId);
  }
}
```

- [ ] **Step 3: Verify it parses and lints**

Run: `node --check scripts/local-processor.mjs`
Expected: no output (valid).
Run: `npx eslint scripts/local-processor.mjs`
Expected: clean.

- [ ] **Step 4: Smoke-test the sync path is unchanged**

With a daemon env (Node 22 or 24 both fine for the daemon) and `BATCH_ENABLED` unset, run `npm run processor:once` against a project that has ≤1 pending `uploaded` deal. Confirm it still logs `DONE` and writes a report exactly as before. (If no test deal is available, skip — the refactor is behavior-preserving by construction.)

- [ ] **Step 5: Commit**

```bash
git add scripts/local-processor.mjs
git commit -m "Phase 3.1: extract shared prep/perFile/write helpers in processor"
```

---

## Task 6: Batch pipeline + routing + recovery

**Files:**
- Modify: `scripts/local-processor.mjs`

- [ ] **Step 1: Add imports + env flags** — update the vision import line and add a batch import + an Anthropic client + flags.

Change the existing import:
```js
import { classifyAllDocuments, runComplianceCheck, mimeFromFilename, MODEL } from '../lib/vision.mjs';
```
to:
```js
import Anthropic from '@anthropic-ai/sdk';
import {
  classifyAllDocuments, runComplianceCheck, mimeFromFilename, MODEL,
  buildClassifyParams, buildComplianceParams, normalizeClassification,
  parseJsonArray, parseJsonObject, messageText,
} from '../lib/vision.mjs';
import { submitBatch, pollBatchUntilDone, collectResults } from '../lib/batch.mjs';
```

After the `const GATE_THRESHOLD = ...` line, add:
```js
// Phase 3.1 — Batch API. OFF by default; lone deals always stay synchronous.
const BATCH_ENABLED = process.env.BATCH_ENABLED === 'true';
const BATCH_MIN_DEALS = Number(process.env.BATCH_MIN_DEALS || 2);
const BATCH_MAX_WAIT_MIN = Number(process.env.BATCH_MAX_WAIT_MIN || 10);
```

After the `const sb = createClient(...)` block, add:
```js
const anthropic = new Anthropic();
```

Also update `logDealCost` so batch rows get the 50% discount. Change its cost line:
```js
  const cost = estimateCostUsd(model, usage);
```
to:
```js
  const cost = estimateCostUsd(model, usage, { batch: fromBatch });
```

- [ ] **Step 2: Add runBatchPipeline** — add this function just below `processDeal`:

```js
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
      if (cached && cached.model_used === MODEL) {
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
    const requests = prepared.map(p => ({ custom_id: p.dealId, params: buildClassifyParams(p.filesForApi, { model: MODEL }) }));
    const batchId = await submitBatch(anthropic, requests);
    await Promise.all(prepared.map(p => sb.from('deals').update({ batch_id: batchId }).eq('id', p.dealId)));
    const poll = await pollBatchUntilDone(anthropic, batchId, { maxWaitMs });
    if (poll.status === 'timeout') {
      console.warn(`  classify batch timed out after ${BATCH_MAX_WAIT_MIN}m — cancelling, will fall back`);
      await anthropic.messages.batches.cancel(batchId);
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
        await logDealCost(p.dealId, 'classification', MODEL, r.message.usage, true);
        extractions = normalizeClassification(parseJsonArray(messageText(r.message.content)), p.filesForApi);
      } else {
        let usage = null;
        extractions = await classifyAllDocuments(p.filesForApi, { onUsage: u => { usage = u; } });
        await logDealCost(p.dealId, 'classification', MODEL, usage, false);
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
    const requests = classified.map(c => ({ custom_id: c.dealId, params: buildComplianceParams(c.perFile, { model: MODEL }) }));
    const batchId = await submitBatch(anthropic, requests);
    await Promise.all(classified.map(c => sb.from('deals').update({ batch_id: batchId }).eq('id', c.dealId)));
    const poll = await pollBatchUntilDone(anthropic, batchId, { maxWaitMs });
    if (poll.status === 'timeout') {
      console.warn(`  compliance batch timed out after ${BATCH_MAX_WAIT_MIN}m — cancelling, will fall back`);
      await anthropic.messages.batches.cancel(batchId);
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
        await logDealCost(c.dealId, 'compliance', MODEL, r.message.usage, true);
        report = parseJsonObject(messageText(r.message.content));
      } else {
        let usage = null;
        report = await runComplianceCheck(c.perFile, { onUsage: u => { usage = u; } });
        await logDealCost(c.dealId, 'compliance', MODEL, usage, false);
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
```

- [ ] **Step 3: Route bursts in processPending** — replace the loop in `processPending` (`for (const d of data) { await processDeal(d.id, d.org_id); }`) with:

```js
  if (BATCH_ENABLED && data.length >= BATCH_MIN_DEALS) {
    await runBatchPipeline(data);
  } else {
    // Process sequentially to avoid hammering the Anthropic API on restart.
    for (const d of data) {
      await processDeal(d.id, d.org_id);
    }
  }
```

- [ ] **Step 4: Extend crash recovery** — replace `recoverStuckDeals` with a version that also resets in-flight batch stages back to `uploaded` for reprocessing (simpler and safe vs. resuming a mid-flight batch; rare double-spend on a crash is accepted):

```js
// On startup, reset any deal left mid-flight by a crashed run (sync 'processing'
// or batch 'classifying'/'checking') back to 'uploaded' so it is reprocessed.
async function recoverStuckDeals() {
  const { error } = await sb.from('deals')
    .update({ status: 'uploaded', batch_id: null, batch_stage: null })
    .in('status', ['processing', 'classifying', 'checking']);
  if (error) console.warn('Could not reset stuck deals:', error.message);
}
```

- [ ] **Step 5: Verify parses + lints**

Run: `node --check scripts/local-processor.mjs`
Expected: valid.
Run: `npx eslint scripts/local-processor.mjs`
Expected: clean.
Run: `npm test`
Expected: PASS (unit tests unaffected).

- [ ] **Step 6: Commit**

```bash
git add scripts/local-processor.mjs
git commit -m "Phase 3.1: burst batch pipeline + routing + crash recovery"
```

---

## Task 7: UI progress labels for batch stages

**Files:**
- Modify: `app/deals/[id]/DealView.js`

- [ ] **Step 1: Treat batch stages as in-progress** — replace:

```js
  const inProgress = deal.status === 'uploaded' || deal.status === 'processing';
```
with:
```js
  const inProgress = ['uploaded', 'processing', 'classifying', 'checking'].includes(deal.status);
```

- [ ] **Step 2: Stage-aware banner text** — add this constant just below the `OVERALL_BADGE` object (top-level, above `export default function DealView`):

```js
const STAGE_TEXT = {
  classifying: 'Analyzing documents…',
  checking: 'Running compliance checks — report ready in a few minutes.',
};
```

Then in the in-progress banner, replace:
```js
            <p className="text-sm text-blue-800">
              <span className="font-medium">Running compliance audit</span>
              <span className="text-blue-600"> — OCR, classification, and checks. Usually 30–90 seconds.</span>
            </p>
```
with:
```js
            <p className="text-sm text-blue-800">
              <span className="font-medium">Running compliance audit</span>
              <span className="text-blue-600"> — {STAGE_TEXT[deal.status] || 'OCR, classification, and checks. Usually 30–90 seconds.'}</span>
            </p>
```

- [ ] **Step 3: Verify build (on Node 22)**

Run: `npx eslint app/deals/[id]/DealView.js`
Expected: clean.
Run (Node 22): `npm run build`
Expected: build succeeds (exit 0).

- [ ] **Step 4: Commit**

```bash
git add "app/deals/[id]/DealView.js"
git commit -m "Phase 3.1: show classifying/checking progress in DealView"
```

---

## Task 8: Enable & smoke-test (manual)

**Files:** none (operational).

- [ ] **Step 1: Apply the migration** — run `supabase/migrations/20260602_batch_columns.sql` in the Supabase SQL Editor.

- [ ] **Step 2: Enable batching for the daemon** — add to `.env.local`:

```
BATCH_ENABLED=true
BATCH_MIN_DEALS=2
BATCH_MAX_WAIT_MIN=10
```

- [ ] **Step 3: Run a burst** — start `npm run processor`, then upload **3 deals at once**. Watch the logs: deals should move `classifying → checking → completed`. Confirm `deal_costs` rows show `from_batch=true` and ~half the usual cost.

- [ ] **Step 4: Verify parity** — open one batched deal in the UI and confirm the report matches what the synchronous path produces for the same files (re-upload one file set with `BATCH_ENABLED=false` to compare).

- [ ] **Step 5: Verify latency cap** — (optional) set `BATCH_MAX_WAIT_MIN=0`, upload a burst, and confirm every deal immediately falls back to synchronous processing and still completes.

---

## Notes / deferred (from spec "Out of scope")

- Cross-window accumulation / scheduled nightly batches.
- Resuming a specific in-flight batch across a daemon restart (current recovery reprocesses from scratch).
- Per-request retry/backoff beyond the single sync fallback.

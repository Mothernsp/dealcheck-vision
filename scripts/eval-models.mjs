// DealCheck Vision — Model Evaluation Harness (Phase 3.2)
//
// Runs a "golden set" of hand-labeled deal jackets through one or more models
// and reports, per model: document-type accuracy, VIN read accuracy, dollar
// read accuracy, total cost, and latency. INFORMATIONAL ONLY — it never changes
// the production model.
//
// Usage:
//   npm run eval
//   node scripts/eval-models.mjs --models=claude-opus-4-7,claude-sonnet-4-6
//
// Golden set layout (you supply this — see evals/golden/README.md):
//   evals/golden/<deal-name>/
//     <one or more input files: scan.pdf, page1.jpg, ...>
//     expected.json        ← hand-verified expected classification
//
// NOTE: this makes real API calls for every (deal × model) — it costs money.

import dotenv from 'dotenv';
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { classifyAllDocuments, mimeFromFilename } from '../lib/vision.mjs';
import { cleanScan, isPreprocessableImage } from '../lib/preprocessing/clean-scan.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
dotenv.config({ path: join(ROOT, '.env.local') });

const GOLDEN_DIR = join(ROOT, 'evals', 'golden');
const RESULTS_DIR = join(ROOT, 'evals', 'results');

// Models to compare. Override with --models=a,b,c
const argModels = (process.argv.find(a => a.startsWith('--models=')) || '').split('=')[1];
const MODELS = argModels ? argModels.split(',').map(s => s.trim()).filter(Boolean)
                         : ['claude-opus-4-7', 'claude-sonnet-4-6'];
// --preprocess: run image inputs through Phase 2 cleanScan first, to A/B test
// preprocessing's effect on accuracy against an un-preprocessed run.
const PREPROCESS = process.argv.includes('--preprocess');
// The production baseline everything is compared against (first model by default).
const BASELINE = MODELS[0];

// USD per million tokens. VERIFY against https://www.anthropic.com/pricing —
// these are estimates and the cost column is only as accurate as this table.
const PRICING = {
  'claude-opus-4-7':   { input: 15, output: 75 },
  'claude-opus-4-8':   { input: 15, output: 75 },
  'claude-sonnet-4-6': { input: 3,  output: 15 },
};
const CACHE_READ_MULT = 0.1;   // cached-input read is ~10% of input price
const CACHE_WRITE_MULT = 1.25; // 5-min ephemeral cache write is ~125% of input price

// Money fields we score for "dollar read accuracy".
const DOLLAR_FIELDS = [
  'sale_price', 'amount_financed', 'down_payment', 'monthly_payment',
  'trade_in_value', 'gst_amount', 'pst_amount', 'lien_amount',
];

// ---- helpers ----

function normVin(v) {
  if (v == null) return null;
  return String(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function vinEq(a, b) {
  const na = normVin(a), nb = normVin(b);
  return na != null && nb != null && na === nb;
}

function moneyEq(a, b) {
  if (a == null || b == null) return false;
  return Math.abs(Number(a) - Number(b)) < 0.01;
}

function costUsd(model, usage) {
  const p = PRICING[model];
  if (!p || !usage) return 0;
  const fresh = usage.input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const out = usage.output_tokens ?? 0;
  return (
    fresh * p.input +
    cacheRead * p.input * CACHE_READ_MULT +
    cacheWrite * p.input * CACHE_WRITE_MULT +
    out * p.output
  ) / 1_000_000;
}

function loadGoldenDeals() {
  if (!existsSync(GOLDEN_DIR)) return [];
  return readdirSync(GOLDEN_DIR)
    .filter(name => !name.startsWith('.') && !name.startsWith('_'))
    .filter(name => statSync(join(GOLDEN_DIR, name)).isDirectory())
    .map(name => {
      const dir = join(GOLDEN_DIR, name);
      const inputs = readdirSync(dir).filter(
        f => f !== 'expected.json' && !f.startsWith('.') && f.toLowerCase() !== 'readme.md'
      );
      const files = inputs.map(f => ({ filename: f, bytes: readFileSync(join(dir, f)) }));
      const expectedPath = join(dir, 'expected.json');
      let expected = null;
      if (existsSync(expectedPath)) {
        const raw = JSON.parse(readFileSync(expectedPath, 'utf8'));
        expected = Array.isArray(raw) ? raw : (raw.documents || null);
      }
      return { name, files, expected };
    })
    .filter(d => d.files.length && Array.isArray(d.expected));
}

// Greedily align expected docs to predicted docs, preferring same doc_type +
// matching VIN, then same doc_type, then VIN-only.
function alignDocs(expectedDocs, predictedDocs) {
  const preds = predictedDocs.map(p => ({ p, used: false }));
  const pairs = [];
  for (const e of expectedDocs) {
    const ev = e.fields?.vin;
    let cand =
      (ev && preds.find(x => !x.used && x.p.doc_type === e.doc_type && vinEq(x.p.fields?.vin, ev))) ||
      preds.find(x => !x.used && x.p.doc_type === e.doc_type) ||
      (ev && preds.find(x => !x.used && vinEq(x.p.fields?.vin, ev))) ||
      null;
    if (cand) cand.used = true;
    pairs.push([e, cand ? cand.p : null]);
  }
  return pairs;
}

function scoreDeal(expectedDocs, predictedDocs, acc) {
  const pairs = alignDocs(expectedDocs, predictedDocs);
  acc.expectedDocs += expectedDocs.length;
  acc.predictedDocs += predictedDocs.length;

  for (const [e, p] of pairs) {
    if (p && p.doc_type === e.doc_type) acc.docTypeCorrect += 1;

    if (e.fields?.vin != null) {
      acc.vinTotal += 1;
      if (p && vinEq(p.fields?.vin, e.fields.vin)) acc.vinCorrect += 1;
    }

    for (const fld of DOLLAR_FIELDS) {
      const ev = e.fields?.[fld];
      if (ev != null) {
        acc.dollarTotal += 1;
        if (p && moneyEq(p.fields?.[fld], ev)) acc.dollarCorrect += 1;
      }
    }
  }
}

function pct(n, d) {
  if (!d) return null;
  return (100 * n) / d;
}

function fmtPct(v) {
  return v == null ? 'n/a' : `${v.toFixed(1)}%`;
}

// ---- run ----

async function evalModel(model, deals) {
  const acc = {
    dealsRun: 0, dealsFailed: 0,
    expectedDocs: 0, predictedDocs: 0, docTypeCorrect: 0,
    vinTotal: 0, vinCorrect: 0,
    dollarTotal: 0, dollarCorrect: 0,
    costUsd: 0, latencyMs: 0,
  };

  for (const deal of deals) {
    process.stdout.write(`  [${model}] ${deal.name} ... `);
    const t0 = Date.now();
    let usage = null;
    try {
      let inputFiles = deal.files;
      if (PREPROCESS) {
        inputFiles = await Promise.all(deal.files.map(async f =>
          isPreprocessableImage(mimeFromFilename(f.filename))
            ? { ...f, bytes: await cleanScan(f.bytes) }
            : f
        ));
      }
      const docs = await classifyAllDocuments(inputFiles, { model, onUsage: u => { usage = u; } });
      acc.latencyMs += Date.now() - t0;
      acc.costUsd += costUsd(model, usage);
      scoreDeal(deal.expected, docs, acc);
      acc.dealsRun += 1;
      console.log(`ok (${docs.length} docs, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    } catch (err) {
      acc.dealsFailed += 1;
      acc.latencyMs += Date.now() - t0;
      console.log(`FAILED: ${err.message}`);
    }
  }
  return acc;
}

function buildReport(results, deals) {
  const lines = [];
  lines.push(`# Model eval — ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`Golden set: **${deals.length}** deals. Baseline: \`${BASELINE}\`. Preprocessing: **${PREPROCESS ? 'on' : 'off'}**.`);
  lines.push('');
  lines.push('| Model | Deals | Docs (pred/exp) | DocType Acc | VIN Acc | $ Acc | Total Cost | Avg $/Deal | Avg Latency |');
  lines.push('|---|---|---|---|---|---|---|---|---|');

  for (const { model, acc } of results) {
    const docTypeAcc = pct(acc.docTypeCorrect, acc.expectedDocs);
    const vinAcc = pct(acc.vinCorrect, acc.vinTotal);
    const dollarAcc = pct(acc.dollarCorrect, acc.dollarTotal);
    const avgCost = acc.dealsRun ? acc.costUsd / acc.dealsRun : 0;
    const avgLat = acc.dealsRun ? acc.latencyMs / acc.dealsRun / 1000 : 0;
    const dealsCell = acc.dealsFailed ? `${acc.dealsRun} (+${acc.dealsFailed} failed)` : `${acc.dealsRun}`;
    lines.push(
      `| \`${model}\` | ${dealsCell} | ${acc.predictedDocs}/${acc.expectedDocs} | ` +
      `${fmtPct(docTypeAcc)} | ${fmtPct(vinAcc)} | ${fmtPct(dollarAcc)} | ` +
      `$${acc.costUsd.toFixed(4)} | $${avgCost.toFixed(4)} | ${avgLat.toFixed(1)}s |`
    );
  }
  lines.push('');

  // Recommendation: a non-baseline model that hits >=98% of baseline on all
  // three accuracy metrics is a candidate switch.
  const base = results.find(r => r.model === BASELINE)?.acc;
  if (base) {
    const baseMetrics = {
      doc: pct(base.docTypeCorrect, base.expectedDocs),
      vin: pct(base.vinCorrect, base.vinTotal),
      dollar: pct(base.dollarCorrect, base.dollarTotal),
    };
    lines.push(`## Relative to baseline \`${BASELINE}\``);
    lines.push('');
    for (const { model, acc } of results) {
      if (model === BASELINE) continue;
      const m = {
        doc: pct(acc.docTypeCorrect, acc.expectedDocs),
        vin: pct(acc.vinCorrect, acc.vinTotal),
        dollar: pct(acc.dollarCorrect, acc.dollarTotal),
      };
      const rel = (a, b) => (a == null || b == null || b === 0) ? null : (100 * a) / b;
      const ratios = [rel(m.doc, baseMetrics.doc), rel(m.vin, baseMetrics.vin), rel(m.dollar, baseMetrics.dollar)];
      const meets = ratios.every(r => r != null && r >= 98);
      lines.push(
        `- \`${model}\`: DocType ${fmtPct(m.doc)}, VIN ${fmtPct(m.vin)}, $ ${fmtPct(m.dollar)} — ` +
        (meets
          ? `**meets ≥98% of baseline on all metrics — candidate switch.**`
          : `below the 98%-of-baseline bar on at least one metric — keep baseline.`)
      );
    }
    lines.push('');
  }
  lines.push('> Cost uses the estimated PRICING table in scripts/eval-models.mjs — verify against current Anthropic pricing.');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Missing ANTHROPIC_API_KEY (expected in .env.local).');
    process.exit(1);
  }

  const deals = loadGoldenDeals();
  if (!deals.length) {
    console.error(`No golden deals found in ${GOLDEN_DIR}.`);
    console.error('Add at least one <deal>/ folder with input files + expected.json.');
    console.error('See evals/golden/README.md for the format.');
    process.exit(1);
  }

  console.log(`Evaluating ${deals.length} deal(s) across: ${MODELS.join(', ')}${PREPROCESS ? ' (preprocessing ON)' : ''}\n`);
  const results = [];
  for (const model of MODELS) {
    if (!PRICING[model]) {
      console.warn(`  (no pricing for ${model} — cost will read $0)\n`);
    }
    const acc = await evalModel(model, deals);
    results.push({ model, acc });
    console.log('');
  }

  const report = buildReport(results, deals);
  console.log('\n' + report);

  mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = join(RESULTS_DIR, `${stamp}.md`);
  writeFileSync(outPath, report, 'utf8');
  console.log(`\nReport written to ${outPath}`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

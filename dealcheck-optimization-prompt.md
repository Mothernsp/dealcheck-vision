# DealCheck Vision — Cost & Quality Optimization Prompt

Paste this entire document to Claude Code at the root of `C:\Users\weara\Desktop\dealcheck-vision`.

---

## Context

This is **DealCheck Vision**, a BC auto dealership F&I compliance tool. Stack: Next.js (App Router) on Vercel, Supabase (Postgres + Storage), Clerk auth, Claude Opus (Vision + JSON) via the Anthropic API.

Pipeline today:
```
Upload → Supabase Storage → processDeal() [background via after()]
  1. Download all files
  2. classifyAllDocuments() — ONE Opus Vision call (multi-doc detection)
  3. runComplianceCheck() — second Opus call (JSON only)
  4. Save report to Supabase
```

Inputs are **always scanned paper documents** (PDFs or images), never digitally-generated PDFs with text layers. Tested Haiku and it misreads degraded scans, so vision must stay on Opus (or Sonnet pending eval). Few-shot examples live in `lib/examples/*.md` and are reused on every deal.

## Goals (in priority order)

1. Cut per-deal API cost without hurting compliance accuracy
2. Avoid re-processing duplicate uploads
3. Improve robustness on bad scans (skewed, low-contrast, noisy)
4. Add visibility into per-deal cost so future optimization is data-driven

## Implementation rules

- Work in **phases**. After each phase: commit, push to `master`, confirm Vercel deploy succeeds, and stop for review before starting the next phase.
- Do not change the user-facing flow or report schema unless explicitly required by a task.
- Add tests where the task description says so.
- All env vars go in `.env.local` and `vercel env`.
- Use TypeScript strict mode; no `any` without a comment justifying it.

---

## Phase 1 — Quick wins, zero behavior change

### 1.1 Tighten prompt caching

**Goal:** Cache the entire static prefix — system prompt **plus** the contents of `lib/examples/*.md` — in one block so we pay full price for it once per ~5 minutes and ~10% thereafter.

- Audit current calls to the Anthropic SDK in the classification and compliance paths
- Load and concatenate all `lib/examples/*.md` files into the system prompt at module load (not per-request)
- Apply `cache_control: { type: "ephemeral" }` to the final block of the static prefix
- Log `cache_read_input_tokens` and `cache_creation_input_tokens` from the response on every call so we can verify hits
- **Acceptance:** after running two deals back-to-back, the second deal's logs show `cache_read_input_tokens > 0` for both API calls

Docs: https://docs.claude.com/en/docs/build-with-claude/prompt-caching

### 1.2 File-hash deduplication

**Goal:** If a dealer re-uploads the same deal package (same files, byte-identical), skip the API calls entirely and return the prior report.

- Compute SHA-256 of each uploaded file at upload time; store the hash on the file record in Supabase
- Compute a **deal-set hash** = SHA-256 of the sorted concatenated file hashes for the deal
- New Supabase table `classification_cache`:
  - `deal_set_hash` (text, primary key)
  - `classification_result` (jsonb)
  - `compliance_result` (jsonb)
  - `created_at` (timestamptz)
  - `model_used` (text)
- In `processDeal()`, before calling `classifyAllDocuments()`, look up the deal-set hash. If found and `model_used` matches the current model: reuse both stored results and skip both API calls. Mark the report with `from_cache: true`.
- Add an admin-only endpoint to clear the cache for a deal set, in case of bad cached output
- **Acceptance:** uploading the same set of files twice triggers exactly one set of API calls; the second upload's report is generated from cache in under 500ms

### 1.3 DPI control on rasterization

**Goal:** Stop overpaying image tokens when source PDFs are at 300+ DPI.

- For PDF inputs, rasterize at **150 DPI** (target). Use `pdfjs-dist` or `pdf2pic`.
- For raw image uploads, resize so the longest edge is at most **2000px** before sending to the API
- Log the resulting image dimensions per page so we have data for tuning
- **Acceptance:** input_tokens per page in the classification call drops by at least 20% on a sample of pre-change deals vs. post-change deals of similar page count

---

## Phase 2 — Image preprocessing & quality gating

### 2.1 Preprocessing pipeline with `sharp`

**Goal:** Improve Vision accuracy and make a cheaper model viable in Phase 3.

Install `sharp`. Create `lib/preprocessing/clean-scan.ts` that takes a Buffer and returns a Buffer, applying in order:

1. Convert to grayscale (keep originals in storage; preprocess only the copy sent to the API)
2. Normalize contrast (`.normalize()`)
3. Light denoise (`.median(1)`)
4. Re-encode as JPEG quality 90

Skip deskew for v1 — it requires OpenCV.js or a custom Hough-transform step and adds significant build complexity on Vercel. Note it as a v2 TODO.

Wire this in between rasterization and the API call. Keep originals in Supabase Storage untouched; preprocessed bytes are in-memory only.

**Acceptance:** A/B test 10 pre-existing deals through old vs new pipeline; misread rate on VINs and dollar amounts is unchanged or better.

### 2.2 Quality gating

**Goal:** Reject illegible uploads before burning Vision tokens on them.

- After preprocessing, compute a sharpness/legibility score per page. Simplest: variance of the Laplacian (run a 3x3 Laplacian kernel via `sharp.convolve`, then compute variance of the output pixels).
- If any page scores below a configurable threshold (start at `LEGIBILITY_THRESHOLD=100`, tune later), mark the deal as `needs_reupload` and return a structured error to the UI naming the offending page(s)
- Do **not** call the Anthropic API for deals that fail the gate
- Make the threshold env-configurable so it can be tuned without redeploys

**Acceptance:** unit test with one clearly illegible scan (blurred, low contrast) returns `needs_reupload`; one clean scan passes through.

---

## Phase 3 — Architectural changes

### 3.1 Batch API for `processDeal()`

**Goal:** Cut all Anthropic API costs by 50%. Since `processDeal()` already runs in the background via `after()`, the latency tradeoff is acceptable.

Refactor `processDeal()` to use the Anthropic Message Batches API:

- Submit both the classification and compliance requests as a batch. The compliance request depends on classification output, so this is two sequential batches, not one combined batch. (Anthropic's batch API processes requests within 24h, typically far faster — usually minutes for small batches.)
- Persist batch IDs on the deal record in Supabase
- Replace the current synchronous-within-`after()` flow with a poll loop: after submitting a batch, poll status every 30s for up to 2 hours, then fall back to a longer poll cadence. Use a Vercel cron route or a background worker (suggest the simplest path that works on Vercel — a serverless cron hitting an endpoint that resumes pending deals).
- Deal status field: `uploaded` → `classifying` → `checking` → `complete` | `failed` | `needs_reupload`
- Update the UI to reflect deal status and show "report ready in a few minutes" rather than implying immediate availability

Docs: https://docs.claude.com/en/docs/build-with-claude/batch-processing

**Important:** prompt caching stacks with batch processing. Make sure the cache control headers from Phase 1.1 are preserved on the batched requests.

**Acceptance:** A test deal completes end-to-end through the batch path; cost reported in the response is ~50% of the equivalent non-batched call; cache hit metrics are still positive on the second deal of the day.

### 3.2 Model evaluation harness

**Goal:** Before committing to Opus forever, get real data on whether Sonnet 4.6 (or future models) can handle classification on our actual scan quality.

- Create `scripts/eval-models.ts`
- Define a "golden set" of 15–20 real deal jackets in a `evals/golden/` directory, each with a hand-verified expected classification output (`*.expected.json`)
- The script runs each golden deal through a configurable list of models (`claude-opus-4-8`, `claude-sonnet-4-6`, etc.) and compares output to expected
- Report per-model: classification accuracy (correct doc types per page), VIN read accuracy, dollar amount read accuracy, total cost, total latency
- Output as a markdown table to stdout and `evals/results/{timestamp}.md`
- **Do not change the production model in this phase** — the eval is informational. Recommend a switch only if Sonnet 4.6 hits ≥98% of Opus accuracy on this golden set.

**Acceptance:** running `npm run eval` produces a comparison report covering at least Opus and Sonnet on the golden set.

### 3.3 Compliance call: re-evaluate whether images are needed

**Goal:** If `classifyAllDocuments()` already extracts every field the compliance check needs (VINs, dollar amounts, dates, signature presence, license numbers, CCO presence, etc.), then `runComplianceCheck()` can be a pure text-reasoning call with no images attached — which means it can potentially run on Sonnet 4.6 even if classification stays on Opus.

- Audit what fields the 100-item compliance checklist actually inspects
- Make sure `classifyAllDocuments()` returns ALL of those fields in its structured output (extend the classification prompt and schema if needed)
- Refactor `runComplianceCheck()` to consume the classification JSON only — no images
- Evaluate this text-only compliance call on Sonnet 4.6 via the eval harness
- If accuracy holds, ship Sonnet for compliance; keep Opus for classification

**Acceptance:** compliance call no longer attaches image content blocks; eval harness shows Sonnet compliance accuracy ≥98% of Opus compliance accuracy on the golden set.

---

## Phase 4 — Operational improvements

### 4.1 Per-deal cost tracking

Add a `deal_costs` Supabase table:
- `deal_id` (fk)
- `call_type` ('classification' | 'compliance')
- `model` (text)
- `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens` (int)
- `estimated_cost_usd` (numeric)
- `from_batch` (boolean)
- `created_at`

Log a row from every Anthropic API call. Build a simple admin page `/admin/costs` showing rolling 7-day cost, average cost per deal, cache hit rate, and batch usage rate.

### 4.2 Output discipline

- Cap `max_tokens` on the compliance call to a reasonable number for the JSON output schema (probably 2000–3000; tune after measuring)
- Verify no call is generating verbose rationale unless we display it. If we don't display it, prompt for terse output.

---

## What NOT to do

- Don't add any "memory" feature, conversation memory tool, or persistent agent context. The pipeline is stateless per deal; the right reuse mechanism is prompt caching (Phase 1.1) plus result caching (Phase 1.2), both of which are already in scope.
- Don't add OCR (Tesseract, Textract, Document AI) as a pre-step. With Opus-class vision, the marginal accuracy gain doesn't justify the cost and latency.
- Don't downgrade to Haiku for any vision call — already tested, fails on our scan quality.
- Don't change the report schema or break existing deal records.

---

## Order of operations

1. Start with Phase 1 (all three tasks). Commit after each task, push, deploy, smoke test.
2. After Phase 1 is live and verified, stop and report cost/cache-hit numbers.
3. Wait for go-ahead before starting Phase 2.
4. Same gate before Phase 3 (batch API is the biggest refactor — needs explicit approval).
5. Phase 4 anytime after Phase 3.

Begin with Phase 1.1.

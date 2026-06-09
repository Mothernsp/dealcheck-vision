# DealCheck Vision — Project Overview

AI-powered **F&I (Finance & Insurance) compliance checker for BC auto dealerships**. A dealer uploads a "deal jacket" (the bundle of scanned documents for a vehicle sale), and the system uses Claude Vision to classify every document, extract key fields, and run a compliance checklist, then presents a pass/warn/fail report.

> **Inputs are always scanned paper** (PDFs or images), never text-layer PDFs. The pipeline uses **two models**: **Sonnet** does the Vision classification/extraction (`CLASSIFY_MODEL`), **Opus** does the text-only compliance judgment (`COMPLIANCE_MODEL`). Haiku was tested for Vision and misreads degraded scans, so it is not used. ⚠️ Sonnet's extraction accuracy on real scans is **not yet eval-validated** — watch VIN/dollar misreads; a wrong extraction silently produces a wrong compliance verdict (the Opus compliance call never sees the scan).

---

## 1. Stack

| Layer | Tech |
|---|---|
| Web app / API | **Next.js 16** (App Router, Turbopack) on **Vercel** |
| Auth | **Clerk** (org-scoped) |
| Database + file storage + realtime | **Supabase** (Postgres, Storage bucket `deal-files`, Realtime) |
| AI | **Anthropic Claude** — `claude-sonnet-4-6` Vision classification + `claude-opus-4-7` JSON compliance |
| Background processing | **Local Node daemon** (`scripts/local-processor.mjs`) |
| Runtime | **Node 22** (pinned via `.nvmrc` + `engines`; Node 24 breaks `next build`) |

---

## 2. Architecture — two processing planes

The system splits into a **web plane** (Vercel) and a **processing plane** (a daemon on the operator's machine).

```
Dealer ──upload──► Next.js /api/upload (Vercel)
                        │  stores files in Supabase Storage
                        │  inserts deal row: status 'uploading' → 'uploaded'
                        ▼
              Supabase (deals table + Storage)
                        │  Realtime UPDATE event (status=uploaded)
                        ▼
        Local daemon  scripts/local-processor.mjs   ◄── primary processor
          download → dedup → preprocess/gate → classify → compliance → write report
                        │
                        ▼
              deals.report (jsonb) ──► DealView UI polls + renders
```

**Why a local daemon?** The heavy Vision calls run outside Vercel's request lifecycle. The upload route only moves files to storage and flips the deal to `uploaded`; the daemon (subscribed to Supabase Realtime, with a 60s poll fallback) does the AI work. **The daemon must be running for deals to process.**

### Two processors exist (important)

| Path | File | Used by | Optimizations |
|---|---|---|---|
| **Primary** | `scripts/local-processor.mjs` | the daemon (normal flow) | dedup cache, preprocessing/gating, batch API, cost logging — **all** |
| **Secondary** | `lib/process-deal.js` | `/api/check` and `/api/deals/[id]/run` (Vercel, manual re-run) | **none** of the above — older, simpler logic |

⚠️ The secondary path (`lib/process-deal.js`) is a Vercel-side re-run/trigger that has **not** received the Phase 1.2/2/3.1/4.1 work. Re-running a deal through `/api/deals/[id]/run` processes it without dedup, cost logging, or batching. Keep this in mind, or migrate those routes onto the daemon path later.

---

## 3. Processing pipeline (daemon)

Status lifecycle: `uploading → uploaded → processing | classifying → checking → completed | failed | needs_reupload`

1. **Trigger** — daemon catches `uploaded` deals via Realtime or the 60s poll.
2. **Route** — lone deal → synchronous `processDeal`; a burst of ≥`BATCH_MIN_DEALS` (when `BATCH_ENABLED`) → `runBatchPipeline`.
3. **Prepare** (`prepareDealFiles`) — download files from Storage, compute a content **deal-set hash**, run optional image preprocessing + legibility gate.
4. **Dedup** — if the exact file set was processed before with the same model, reuse the stored report (skip both API calls).
5. **Classify** (`classifyAllDocuments`) — one Vision call returns one JSON object **per distinct document** found (a single PDF may contain many stapled documents).
6. **Compliance** (`runComplianceCheck`) — a **text-only** call: feeds the extracted JSON + `compliance-prompt.md` checklist, returns the report.
7. **Persist** (`writeCompletedDeal`) — cache the result and write `deals.report`, `files`, `customer_name`, `vehicle_info`, status `completed`.

---

## 4. Key files & functions

### `lib/` — shared logic

- **`vision.mjs`** — the AI core.
  - `CLASSIFY_MODEL` (`claude-sonnet-4-6`) / `COMPLIANCE_MODEL` (`claude-opus-4-7`) — the per-stage model ids. `MODEL_PAIR` (`"sonnet+opus"`) is recorded on each cache entry so a cached report is only reused when both stages still use the same models.
  - `mimeFromFilename(name)` / `toVisionBlock(bytes, mime)` — build PDF/image content blocks (PDFs sent natively as `document` blocks).
  - `buildClassifyParams(files, {model})` — assembles the classification `messages.create` params (system prompt + few-shot guides + `cache_control`).
  - `classifyAllDocuments(files, {model, onUsage})` — runs the Vision call, returns normalized per-document extractions.
  - `buildComplianceParams(perFile, {model})` — assembles the compliance params (reads `compliance-prompt.md`).
  - `runComplianceCheck(perFile, {model, onUsage})` — runs the text-only compliance call, returns the report object.
  - `normalizeClassification`, `messageText`, `parseJsonArray`, `parseJsonObject` — parsing/shaping helpers shared by sync + batch paths.
  - `logCacheUsage(label, usage)` — logs prompt-cache hit/miss token counts.
  - Internal: `CLASSIFY_SYSTEM` (system prompt), `DOC_TYPES` (20 document types), `loadExamples()` (concatenates `lib/examples/*.md` once at module load, prompt-cached).
- **`vision.js`** — thin barrel re-exporting from `vision.mjs` (so `@/lib/vision` works from Next routes).
- **`batch.mjs`** — Anthropic Message Batches helpers (client injected for testability): `submitBatch`, `pollBatchUntilDone` (deadline-aware), `collectResults` (keyed by `custom_id`, throw-proof).
- **`pricing.mjs`** — `PRICING` table, `BATCH_DISCOUNT` (0.5), `estimateCostUsd(model, usage, {batch})`. **Estimates — verify against Anthropic pricing.**
- **`preprocessing/clean-scan.mjs`** — `cleanScan(bytes)` (grayscale → normalize → denoise → JPEG q90), `sharpnessScore(bytes)` (variance-of-Laplacian legibility score), `isPreprocessableImage(mime)` (excludes PDFs).
- **`admin.js`** — `isAdminUser(userId)` (checks `ADMIN_USER_IDS` allowlist).
- **`supabase.js`** — `supabaseAdmin()` (service-role client), `BUCKET` (`deal-files`).
- **`process-deal.js`** — the **secondary** Vercel-side `processDeal` (see §2).
- **`examples/*.md`** — few-shot document guides reused on every classification (prompt-cached).

### `scripts/` — daemon & tooling

- **`local-processor.mjs`** — the daemon. Key functions:
  - `processDeal(dealId, orgId)` — synchronous single-deal pipeline.
  - `runBatchPipeline(pending)` — burst pipeline (two sequential Message Batches: classify → compliance) with per-stage latency cap + sync fallback.
  - `prepareDealFiles`, `buildPerFile`, `writeCompletedDeal` — shared by both paths.
  - `processPending()` — catch-up sweep + routing (sync vs batch).
  - `recoverStuckDeals()` — on startup, resets `processing`/`classifying`/`checking` deals to `uploaded`.
  - `computeDealSetHash`, `lookupClassificationCache`, `saveClassificationCache` — dedup cache.
  - `logDealCost(...)` — writes a `deal_costs` row per API call (with batch discount).
- **`eval-models.mjs`** — offline model-comparison harness (`npm run eval`). Runs a golden set through configurable models, scores doc-type / VIN / dollar accuracy + cost + latency, writes `evals/results/{timestamp}.md`. **Informational only** — never changes the production model.

### `app/` — Next.js (Vercel)

- **`api/upload/route.js`** — `POST`: auth, create deal, upload files to Storage, flip status to `uploaded` (triggers the daemon).
- **`api/deals/route.js`** — `GET`: list the org's deals (for the dashboard).
- **`api/deals/[id]/route.js`** — `GET`: one deal (polled by `DealView`).
- **`api/deals/[id]/run/route.js`** — `POST`: re-run a stuck/failed deal **synchronously** via the secondary `lib/process-deal`.
- **`api/check/route.js`** — `POST`: trigger processing via Vercel `after()` + secondary path.
- **`api/admin/cache/route.js`** — `DELETE`: clear a cached deal-set (admin-gated).
- **`admin/costs/page.js`** — admin cost dashboard (7-day cost, avg/deal, cache-hit rate, batch rate, recent calls).
- **`deals/[id]/DealView.js`** — client component: polls the deal while in progress, renders the report (summary, pass/warn/fail checks, missing documents, math verification, file list, stage-aware progress).
- **`dashboard/page.js`**, **`upload/page.js`**, **`page.js`** (landing), **`sign-in`/`sign-up`** — UI shell. `layout.js` wraps everything in `<ClerkProvider>`.

---

## 5. Data model (Supabase)

### `deals`
`id` (uuid, pk) · `org_id` · `created_by` · `status` · `report` (jsonb) · `files` (jsonb) · `customer_name` · `vehicle_info` · `error` · `batch_id` · `batch_stage` · `created_at`

### `classification_cache` (dedup — Phase 1.2)
`deal_set_hash` (text, pk) · `classification_result` (jsonb) · `compliance_result` (jsonb) · `model_used` · `created_at`

### `deal_costs` (cost tracking — Phase 4.1)
`id` · `deal_id` · `call_type` ('classification'|'compliance') · `model` · token columns · `estimated_cost_usd` · `from_batch` · `created_at`

Migrations live in `supabase/migrations/*.sql` and are applied **manually** via the Supabase SQL editor (no migration runner). RLS is enabled on the cache/cost tables; only the service role (daemon + admin pages) touches them.

### Report shape (written to `deals.report`)
`overall_status` ('pass'|'warnings'|'fail') · `summary` · `checks[]` ({ id, title, detail, evidence, status: 'pass'|'warn'|'fail' }) · `missing_documents[]` · `math` ({ expected_amount_financed, reported_amount_financed, delta, ok }) · `customer_name` · `vehicle_info` · `from_cache?` / `from_batch?`

---

## 6. Environment variables (`.env.local` + Vercel)

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_PROJECT_ID`, `SUPABASE_SERVICE_KEY` | Supabase |
| `ANTHROPIC_API_KEY` | Claude |
| Clerk keys | auth |
| `ADMIN_USER_IDS` | comma-separated Clerk user ids allowed into `/admin/*` |
| `PREPROCESS_IMAGES` | `true` to grayscale/denoise image uploads (default off) |
| `LEGIBILITY_THRESHOLD` | reject images scoring below this (≤0/unset = gate off) |
| `BATCH_ENABLED` | `true` to batch bursts of deals (default off) |
| `BATCH_MIN_DEALS` | min pending deals to trigger a batch (default 2) |
| `BATCH_MAX_WAIT_MIN` | per-stage batch deadline before sync fallback (default 10) |

---

## 7. npm scripts

| Script | What |
|---|---|
| `npm run dev` / `build` / `start` | Next.js (build/dev require **Node 22**) |
| `npm run lint` | ESLint |
| `npm test` | unit tests (`node --test` over `lib/**` + `scripts/**`) |
| `npm run processor` | start the daemon (keep running) |
| `npm run processor:once` | process pending deals once and exit |
| `npm run eval` | model evaluation harness (needs a golden set) |

---

## 8. Optimization phases implemented

| Phase | Feature | Notes |
|---|---|---|
| 1.1 | **Prompt caching** | system prompt + few-shot guides cached (`cache_control: ephemeral`) |
| 1.2 | **Deal-set dedup** | byte-identical re-uploads skip both API calls (`classification_cache`) |
| 2 | **Preprocessing + legibility gate** | `sharp`, opt-in; images only (PDFs stay native) |
| 3.1 | **Batch API** | burst batching at 50% cost, sync-fallback latency cap; behind `BATCH_ENABLED` |
| 3.2 | **Eval harness** | offline model comparison; needs a labeled golden set |
| 4.1 | **Cost tracking** | `deal_costs` + `/admin/costs` dashboard |
| — | **Node 22 pin** | fixes a Node-24 `next build` prerender crash |

**Deliberate, documented decisions** (see `docs/superpowers/specs|plans/`): errored batch results fall back to synchronous processing (resilience over the spec's "mark failed"); crash recovery is restart-based (not in-daemon resume).

---

## 9. Operational runbook

1. **Apply migrations** — paste each `supabase/migrations/*.sql` into the Supabase SQL editor and run it.
2. **Configure env** — set the vars in §6 in `.env.local` (daemon) and Vercel (web).
3. **Enable Supabase Realtime** for the `deals` table (Database → Replication).
4. **Run the daemon** — `npm run processor` on **Node 22+** (Node 22 not strictly required for the daemon, but use it for consistency). It must stay running for deals to process.
5. **Deploy the web app** — push to `master`; Vercel builds on Node 22.
6. **Verify** — upload a deal, watch it move through statuses to `completed`; check `/admin/costs` for cost rows.

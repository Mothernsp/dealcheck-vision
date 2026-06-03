# Batch API Processing — Design Spec

**Date:** 2026-06-02
**Phase:** 3.1 (from `dealcheck-optimization-prompt.md`)
**Status:** Approved design, pending spec review

## Context

DealCheck Vision processes uploaded deal jackets in a **local daemon**
(`scripts/local-processor.mjs`), not in Vercel `after()` as the original
optimization doc assumed. The daemon listens to Supabase Realtime and polls for
`uploaded` deals, then runs two sequential Anthropic Opus calls per deal:
`classifyAllDocuments()` (vision) → `runComplianceCheck()` (text), writing the
report back to Supabase.

The Anthropic **Message Batches API** offers a **50% discount** on all tokens,
but is asynchronous: requests complete "within 24h," usually minutes, with **no
fast SLA**.

### Constraints established during brainstorming

- **Latency:** minutes per deal is acceptable; **hours for a single file is not.**
- **Volume:** **bursty** — deals frequently arrive in clusters.
- Prompt caching (Phase 1.1), dedup (Phase 1.2), preprocessing (Phase 2), and
  cost logging (Phase 4.1) must all keep working.

## Goals

1. Cut Anthropic cost ~50% on burst traffic via the Batch API.
2. Never let a single deal wait hours — enforce a hard latency ceiling.
3. Keep lone-deal latency fast (~1 min, unchanged).
4. No duplicated prompt/request logic between the sync and batch paths.

## Non-goals

- Changing the report schema or the user-facing report content.
- Batching across the classification→compliance dependency (it's inherently two
  sequential stages).
- Model changes (that's Phase 3.3).

## Approach: A — burst-batch with sync fallback

- **Lone deal** (only one `uploaded` deal pending) → existing **synchronous**
  path. ~1 min, full price, zero batch-latency risk.
- **Burst** (≥ `BATCH_MIN_DEALS`, default **2**, deals pending) → **batch** path.
- **Latency cap:** each batch stage has a deadline (`BATCH_MAX_WAIT_MIN`, default
  **10**). If exceeded, cancel the batch and finish remaining deals
  synchronously. This is what guarantees "minutes, not hours."
- **Feature flag:** `BATCH_ENABLED` (default **false**). Until enabled, the
  daemon behaves exactly as today. Lets us ship inert and turn on after a live
  smoke test.

## Architecture

### Trigger & routing (`processPending`)

The daemon's catch-up sweep currently loops `uploaded` deals and processes each
synchronously. New logic:

```
pending = deals where status = 'uploaded'
if !BATCH_ENABLED or pending.length < BATCH_MIN_DEALS:
    process each synchronously (current behavior)
else:
    runBatchPipeline(pending)
```

The Realtime single-event handler keeps using the synchronous path (a single
event = a single deal). Bursts are caught by the periodic `processPending`
sweep, which is the natural accumulation point.

### Two-stage batch pipeline (`runBatchPipeline`)

Status progression: `uploaded → classifying → checking → completed | failed | needs_reupload`

1. **Prepare** each deal: download files, run Phase 2 preprocessing/quality gate,
   compute deal-set hash. A **dedup cache hit** short-circuits that deal (write
   cached report, skip batching). Gate failures → `needs_reupload`. Deals that
   fail preparation drop out of the batch and are marked `failed`.
2. **Submit classification batch:** one request per remaining deal,
   `custom_id = deal_id`, params identical to the sync classify call
   (model, max_tokens, system with `cache_control`, messages). Persist
   `batch_id` + `batch_stage='classifying'` on each deal; set status
   `classifying`.
3. **Poll** `messages.batches.retrieve(batch_id)` every 30s until
   `processing_status === 'ended'` or deadline.
4. On completion, read `messages.batches.results(batch_id)`, parse each
   `custom_id`'s classification (same parsing as sync), build `perFile`, log
   `deal_costs` (`from_batch=true`).
5. **Submit compliance batch** for the successfully-classified deals; set
   `checking`. Poll. On completion, parse reports, write each deal `completed`,
   log `deal_costs` (`from_batch=true`).

### Request-builder refactor (shared sync/batch)

To avoid duplicating prompt/request construction, factor the message-params out
of `classifyAllDocuments` / `runComplianceCheck` in `lib/vision.mjs`:

- `buildClassifyParams(files, { model })` → the object passed to
  `messages.create` (model, max_tokens, system, messages).
- `buildComplianceParams(perFile, { model })` → same for compliance.
- The existing sync functions call `messages.create(buildXParams(...))`.
- The batch path builds `{ custom_id, params: buildXParams(...) }` per deal.
- Result parsing (`parseJsonArray`/`parseJsonObject`, normalization) is also
  extracted into reusable helpers so sync and batch parse identically.

This keeps caching, the system prompt + examples, and schema in exactly one place.

### Latency cap & fallback

A stage's poll loop runs until `processing_status === 'ended'` OR
`elapsed > BATCH_MAX_WAIT_MIN`. On timeout:
- `messages.batches.cancel(batch_id)`.
- Any deals already returned `succeeded` are used.
- Remaining deals are processed through the **synchronous** functions
  immediately, guaranteeing completion in minutes.

Already-completed batch requests are still billed (at the 50% rate); rarely we
pay for a fallback sync call on top. Accepted as a rare edge cost.

### Crash recovery (`recoverStuckDeals`, extended)

On startup, in addition to resetting `processing` deals:
- Find deals in `classifying`/`checking` with a `batch_id`.
- For each distinct `batch_id`: if the batch still exists and is within
  deadline, resume polling; otherwise fall back to synchronous processing and
  clear `batch_id`/`batch_stage`.

### Cost logging

`logDealCost(dealId, callType, model, usage, from_batch=true)` for batch results.
Batch result messages include `usage`. `lib/pricing.mjs` gains a
`BATCH_DISCOUNT = 0.5` constant, and `estimateCostUsd(model, usage, { batch })`
multiplies the result by `BATCH_DISCOUNT` when `batch` is true. The processor
passes `{ batch: true }` for batch results so `estimated_cost_usd` reflects the
discounted price.

## Data model changes

Migration `supabase/migrations/20260602_batch_columns.sql`:

```sql
alter table public.deals add column if not exists batch_id text;
alter table public.deals add column if not exists batch_stage text; -- 'classifying' | 'checking'
create index if not exists deals_batch_id_idx on public.deals (batch_id);
```

No new table. New status values (`classifying`, `checking`) are just strings in
the existing `status` column.

## Environment variables

| Var | Default | Meaning |
|---|---|---|
| `BATCH_ENABLED` | `false` | Master switch for the batch path |
| `BATCH_MIN_DEALS` | `2` | Minimum pending deals to trigger batching |
| `BATCH_MAX_WAIT_MIN` | `10` | Per-stage deadline before sync fallback |

## UI changes

`app/deals/[id]/DealView.js` already renders status via Realtime. Add display
labels for `classifying` and `checking` (e.g. "Analyzing documents…",
"Running compliance checks… report ready in a few minutes") so dealers see
progress rather than an apparent hang. No schema or flow change.

## Error handling

- A single deal's `errored`/`expired` batch result → that deal `failed` with the
  error; the rest of the batch proceeds.
- Batch submission failure → fall back to synchronous processing for the whole
  group (no deal is stranded).
- All Supabase writes for batch state are best-effort with logging, consistent
  with existing daemon patterns; a failed state write does not crash the loop.

## Testing

- **Unit (node:test, mocked batch client — no real API):**
  - request builders produce params identical to the current inline calls
    (snapshot of model/max_tokens/system/messages shape).
  - batch-results parsing maps `custom_id → report` correctly, including a mixed
    batch with one `errored` result.
  - deadline logic: a batch that never "ends" triggers cancel + sync fallback.
  - recovery: a deal in `classifying` with a stale `batch_id` past deadline routes
    to fallback.
- **Manual smoke test:** with `BATCH_ENABLED=true`, upload 3 deals at once;
  confirm they go `classifying → checking → completed`, reports match the sync
  path, and `deal_costs` rows show `from_batch=true` at ~half cost.

## Rollout / safety

1. Ship with `BATCH_ENABLED=false` — zero behavior change.
2. Apply the migration.
3. Enable in the daemon's env, upload a burst, verify.
4. Compare a batched deal's report against the synchronous path for parity.

## Out of scope (future)

- Cross-window accumulation / scheduled nightly batches.
- Batching the two stages into a single request.
- Per-request retry/backoff beyond the one sync fallback.

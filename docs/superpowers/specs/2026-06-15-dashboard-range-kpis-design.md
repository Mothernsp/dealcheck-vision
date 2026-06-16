# Dashboard date-range filter + KPIs — design

**Date:** 2026-06-15
**Status:** Approved

## Goal

On the dealer dashboard:

1. Order the deal list by **upload date, newest first** (replacing the severity-first sort on the dashboard).
2. Add a **custom date-range filter** (From / To inputs + Clear) that scopes what the dashboard shows.
3. Add two **KPI panels**: top 5 most-common missing documents, and top 5 most-common failure reasons.
4. With no range selected, everything reflects **all** of the org's deals.

The selected range filters the **whole** dashboard: the summary counts, both KPI panels, and the deal list.

## Data shapes (confirmed against current code)

- `report.missing_documents` — array of strings (`app/deals/[id]/DealView.js:137`).
- `report.checks[]` — `{ id, title, detail, evidence, status }`; a failure reason is `title` where `status === 'fail'`.
- `deals.created_at` — ISO timestamp; used as the "uploaded" time.

## Architecture

### `app/dashboard/page.js` (server)
- Keep selecting `report`; extend the lean per-deal shape with KPI-source fields so the client never receives the full report jsonb:
  - `missing_documents: d.report?.missing_documents ?? []`
  - `failed_reasons: (d.report?.checks ?? []).filter(c => c.status === 'fail').map(c => c.title)`
- Stop computing counts server-side. Render `<DashboardClient initialDeals={deals} />`.

### `app/dashboard/DashboardClient.js` (new client component)
- Owns `deals` state (lifted from `DealList` so delete is the single source of truth) and `from` / `to` range state.
- `inRange` = deals whose `created_at` is within `[from 00:00, to 23:59.999]`; either bound optional; no bounds → all.
- Renders, top to bottom: date-range bar (From / To + Clear), 4-count summary (from `inRange`), two KPI cards, then the list.
- Owns the delete handler (`onDeleted` removes from `deals`).

### `app/dashboard/DealList.js` (refactor to controlled)
- Accepts `deals` (already range-filtered) + `onDeleted`; drop the internal `useState(initialDeals)` so a range change re-renders the list.
- Keep the status-chip filter (All / Failing / Needs review / Passed).
- Sort by `created_at` descending (newest uploaded first).
- Empty states: account has zero deals → existing "No deals yet" upload CTA; deals exist but none in range → "No deals in the selected range"; chip filter matches nothing → existing "No deals match this filter."

### `lib/dashboard-metrics.mjs` (new, pure, tested)
- `topCounts(strings, n = 5)` → `[{ label, count }]`, sorted by count desc, first-seen tie-break, capped at `n`.
- `withinRange(createdAt, from, to)` → boolean; inclusive bounds; open-ended when a bound is null/empty.

KPI cards:
- Missing docs = `topCounts(inRange.flatMap(d => d.missing_documents))`
- Failure reasons = `topCounts(inRange.flatMap(d => d.failed_reasons))`

## KPI card UI
Two cards in a `md:grid-cols-2` grid, each styled `rounded-lg border border-slate-200 bg-white`, listing ≤5 rows of `label` + count badge. Empty → "No missing documents in this range" / "No failures in this range." Pending deals carry no report and contribute nothing (expected).

## Testing
`lib/dashboard-metrics.test.mjs`:
- `topCounts`: counts occurrences, caps at 5, first-seen tie-break, empty input → `[]`.
- `withinRange`: inclusive lower/upper bounds, open-ended (null) bounds, out-of-range false.

## Out of scope
- No server-side range filtering / pagination (all org deals already load).
- No changes to the AI pipeline, report shape, or `sortDeals` (other callers keep severity-first).

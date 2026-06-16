// Pure helpers for the dashboard's date-range filter and KPI panels. Kept
// framework-agnostic and side-effect-free so they're unit-testable and shared
// between the server page (KPI-source extraction) and the client component.

// Tally a list of label strings into the top-n most frequent, sorted by count
// descending with a first-seen tie-break. Empty/whitespace/non-string entries
// are ignored. Used for both KPI panels (missing documents, failure reasons).
export function topCounts(strings, n = 5) {
  if (!Array.isArray(strings)) return [];
  const groups = new Map(); // label -> count, insertion order = first-seen
  for (const s of strings) {
    if (typeof s !== 'string') continue;
    const label = s.trim();
    if (label === '') continue;
    groups.set(label, (groups.get(label) ?? 0) + 1);
  }
  return [...groups.entries()]
    .map(([label, count]) => ({ label, count }))
    // Map preserves insertion order, so a stable sort keeps first-seen on ties.
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

// Given one label list per deal, rank labels by the NUMBER OF DEALS that contain
// them (not total occurrences): labels are de-duplicated within each deal first,
// so a deal that lists the same missing document twice still counts once. Powers
// both KPI panels ("how many deals had this missing document / failure reason").
export function dealOccurrenceCounts(perDealLists, n = 5) {
  if (!Array.isArray(perDealLists)) return [];
  const flattened = [];
  for (const list of perDealLists) {
    if (!Array.isArray(list)) continue;
    const seen = new Set();
    for (const s of list) {
      if (typeof s !== 'string') continue;
      const label = s.trim();
      if (label === '' || seen.has(label)) continue;
      seen.add(label);
      flattened.push(label);
    }
  }
  return topCounts(flattened, n);
}

// Is an ISO timestamp within an inclusive [from, to] calendar-day range? Each
// bound is a `YYYY-MM-DD` string (as produced by <input type="date">) or
// null/empty for an open end. Bounds are interpreted in UTC so the result is
// deterministic across machines/timezones: `from` covers from 00:00:00.000Z of
// that day, `to` through 23:59:59.999Z of that day.
export function withinRange(createdAt, from, to) {
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return false;
  if (from) {
    const fromMs = new Date(`${from}T00:00:00.000Z`).getTime();
    if (t < fromMs) return false;
  }
  if (to) {
    const toMs = new Date(`${to}T23:59:59.999Z`).getTime();
    if (t > toMs) return false;
  }
  return true;
}

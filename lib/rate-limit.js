// Lightweight per-identity rate limiting.
//
// This is an in-memory sliding-window limiter. It runs inside each serverless
// instance, so it is a *first line of defense*, not a hard distributed quota:
// under heavy fan-out the same user could hit separate cold instances. For this
// app's threat model (a known set of authenticated org users who could
// accidentally — or maliciously — hammer the costly Claude pipeline) that is
// enough to stop runaway loops and abusive bursts.
//
// To upgrade to a strict cross-instance quota later, swap the body of
// `rateLimit` for an Upstash Ratelimit / Postgres atomic counter — the call
// sites don't need to change.

const buckets = new Map(); // key -> number[] (timestamps, ms)

// Periodically drop empty buckets so the Map can't grow unbounded.
function sweep(now, windowMs) {
  for (const [key, hits] of buckets) {
    const fresh = hits.filter((t) => now - t < windowMs);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  }
}

// Returns { ok, remaining, retryAfterSec }. `ok` is false once `limit`
// requests have occurred within the trailing `windowMs`.
export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000));
    return { ok: false, remaining: 0, retryAfterSec };
  }

  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) sweep(now, windowMs); // cheap safety valve
  return { ok: true, remaining: limit - hits.length, retryAfterSec: 0 };
}

// Convenience: build a 429 Response from a failed limit result.
export function tooManyRequests(result) {
  return Response.json(
    { error: 'Too many requests. Please slow down.' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSec) } }
  );
}

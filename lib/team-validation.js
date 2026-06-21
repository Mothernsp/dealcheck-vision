// Pure validation helpers for the admin dealership/team management feature.
// Kept dependency-free so they can be unit-tested with `node --test`.

export const MAX_ORG_NAME = 100;

// Trim, collapse internal whitespace, and cap length. Returns '' for anything
// that isn't usable so callers can reject with a single falsy check.
export function normalizeOrgName(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_ORG_NAME);
}

// Pragmatic email shape check — not a full RFC validator. Clerk does the
// authoritative validation; this just stops obviously-bad input before we spend
// an API call.
export function isValidEmail(value) {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  if (s.length === 0 || s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

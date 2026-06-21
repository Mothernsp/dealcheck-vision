// Small input-validation helpers for API routes. Reject malformed identifiers
// at the edge so they never reach a query or a storage path.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v) {
  return typeof v === 'string' && UUID_RE.test(v);
}

// deal_set_hash is a hex content hash; bound its shape and length.
export function isHexHash(v) {
  return typeof v === 'string' && /^[0-9a-f]{8,128}$/i.test(v);
}

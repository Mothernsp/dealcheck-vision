// Shared field-normalization + equality helpers. ONE definition used by both
// the eval harness (scripts/eval-models.mjs) and the production comparison
// engine (lib/reconcile.mjs) so "do these two values match?" means exactly the
// same thing when scoring against a golden set as it does in a live deal.

// Money fields that carry a dollar amount. Compared to the cent.
export const DOLLAR_FIELDS = [
  'sale_price',
  'amount_financed',
  'down_payment',
  'monthly_payment',
  'trade_in_value',
  'gst_amount',
  'pst_amount',
  'lien_amount',
];

// Uppercase and strip every non-alphanumeric character so spacing, dashes, and
// case differences between scans don't read as a VIN mismatch.
export function normVin(v) {
  if (v == null) return null;
  return String(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function vinEq(a, b) {
  const na = normVin(a);
  const nb = normVin(b);
  return na != null && na !== '' && na === nb;
}

// Equal to the cent.
export function moneyEq(a, b) {
  if (a == null || b == null) return false;
  return Math.abs(Number(a) - Number(b)) < 0.01;
}

// Numeric equality within a tolerance — used for odometer readings, where
// transcription rounding of a single unit shouldn't flag a discrepancy.
export function numEq(a, b, tol = 1) {
  if (a == null || b == null) return false;
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return Math.abs(na - nb) <= tol;
}

// Case-insensitive, whitespace-collapsed text equality. An empty (or
// whitespace-only) value never matches anything, including another empty.
export function textEq(a, b) {
  const na = normText(a);
  const nb = normText(b);
  return na !== '' && nb !== '' && na === nb;
}

function normText(v) {
  if (v == null) return '';
  return String(v).trim().toLowerCase().replace(/\s+/g, ' ');
}

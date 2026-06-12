// Shared status + severity vocabulary for the compliance-dossier UI.
// Framework-agnostic (no JSX) so server pages and client components agree on
// colors, labels, and ordering. The pass/warn/fail system is the visual spine,
// so every surface must read these from one place.

// ---- Deal-level meta (status + compliance verdict combined) -----------------

// Lower rank sorts to the top. The dossier always surfaces action items first:
// failures, then cautions, then passes, then anything still processing.
export const SEVERITY_RANK = {
  fail: 0, // compliance fail
  failed: 1, // processing error (status === 'failed')
  warn: 2, // compliance warnings (cautious)
  pass: 3, // compliance pass
  pending: 4, // uploading/uploaded/processing/classifying/checking
};

const KIND_STYLES = {
  fail: {
    label: 'Fail',
    rail: 'bg-rose-600',
    chip: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200',
    tileBg: 'bg-rose-50 ring-rose-200',
    tileText: 'text-rose-700',
    dot: 'bg-rose-500',
    text: 'text-rose-600',
  },
  failed: {
    label: 'Error',
    rail: 'bg-rose-400',
    chip: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200',
    tileBg: 'bg-rose-50 ring-rose-200',
    tileText: 'text-rose-700',
    dot: 'bg-rose-400',
    text: 'text-rose-600',
  },
  warn: {
    label: 'Warn',
    rail: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200',
    tileBg: 'bg-amber-50 ring-amber-200',
    tileText: 'text-amber-800',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
  },
  pass: {
    label: 'Pass',
    rail: 'bg-emerald-600',
    chip: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
    tileBg: 'bg-emerald-50 ring-emerald-200',
    tileText: 'text-emerald-700',
    dot: 'bg-emerald-500',
    text: 'text-emerald-600',
  },
  pending: {
    label: 'Processing',
    rail: 'bg-slate-300',
    chip: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200',
    tileBg: 'bg-slate-50 ring-slate-200',
    tileText: 'text-slate-600',
    dot: 'bg-slate-300',
    text: 'text-slate-500',
  },
};

const IN_PROGRESS = ['uploading', 'uploaded', 'processing', 'classifying', 'checking'];

const PENDING_LABELS = {
  uploading: 'Uploading',
  uploaded: 'Queued',
  processing: 'Processing',
  classifying: 'Classifying',
  checking: 'Checking',
};

// Map a deal row to a single severity "kind" used for color, label, and sort.
export function dealKind(deal) {
  if (deal.status === 'failed') return 'failed';
  if (IN_PROGRESS.includes(deal.status)) return 'pending';
  const overall = deal.report?.overall_status || deal.overall_status;
  if (overall === 'fail') return 'fail';
  if (overall === 'warnings') return 'warn';
  if (overall === 'pass') return 'pass';
  return 'pending';
}

// Full presentation meta for a deal: kind, styles, and a precise label.
export function dealMeta(deal) {
  const kind = dealKind(deal);
  const styles = KIND_STYLES[kind];
  let label = styles.label;
  if (kind === 'pending') label = PENDING_LABELS[deal.status] || 'Processing';
  return { kind, label, ...styles };
}

export function dealRank(deal) {
  return SEVERITY_RANK[dealKind(deal)];
}

// Sort deals fail -> error -> warn -> pass -> pending, newest first within a tier.
export function sortDeals(deals) {
  return [...deals].sort((a, b) => {
    const r = dealRank(a) - dealRank(b);
    if (r !== 0) return r;
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

// ---- Check-level meta (individual compliance line items) --------------------

export const CHECK_RANK = { fail: 0, warn: 1, pass: 2 };

export const CHECK_STYLES = {
  fail: { label: 'Fail', rail: 'border-l-rose-500', text: 'text-rose-700', dot: 'bg-rose-500' },
  warn: { label: 'Warn', rail: 'border-l-amber-500', text: 'text-amber-700', dot: 'bg-amber-500' },
  pass: { label: 'Pass', rail: 'border-l-emerald-500', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

// Sort checks so failures sit at the top, then cautions, then passes.
export function sortChecks(checks) {
  return [...(checks || [])].sort(
    (a, b) => (CHECK_RANK[a.status] ?? 9) - (CHECK_RANK[b.status] ?? 9)
  );
}

// ---- Rule priority meta (admin compliance rules) ----------------------------
//
// The three admin priorities ride the SAME severity spine as deals/checks, so a
// rule reads at a glance like the verdict it can produce. Colors are sourced
// from KIND_STYLES/CHECK_STYLES here — never re-hand-rolled in components — so a
// brand retune propagates everywhere. soft_check is neutral slate (it never
// penalizes a deal), deliberately NOT green, which would read as "passing".
//   hard_fail → rose (a violation fails the deal)
//   cautious  → amber (a violation warns)
//   soft_check → slate (informational only)
export const PRIORITY_STYLES = {
  hard_fail: {
    label: 'Hard fail',
    kind: 'fail',
    chip: KIND_STYLES.fail.chip,
    rail: CHECK_STYLES.fail.rail,
    hint: 'A violation fails the deal',
  },
  cautious: {
    label: 'Cautious',
    kind: 'warn',
    chip: KIND_STYLES.warn.chip,
    rail: CHECK_STYLES.warn.rail,
    hint: 'A violation is a warning',
  },
  soft_check: {
    label: 'Soft check',
    kind: 'soft',
    chip: KIND_STYLES.pending.chip,
    rail: 'border-l-slate-300',
    hint: 'Informational only',
  },
};

export function priorityMeta(priority) {
  return PRIORITY_STYLES[priority] || PRIORITY_STYLES.cautious;
}

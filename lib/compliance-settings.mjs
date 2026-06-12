// Admin-managed compliance directives.
//
// Admins author extra compliance items in the Optimization tab; they live in the
// compliance_settings table and get injected into the compliance model's system
// prompt at runtime (see buildComplianceParams in vision.mjs). An admin edit thus
// takes effect on the very next deal — for both the Next.js app and the local
// processor — with no file edits or redeploys.
//
// Callers pass in their own Supabase client so this module never reads env vars
// at import time (the daemon configures dotenv after its imports run).

// Three severities the admin picks per item, mapped onto the pass/warn/fail
// vocabulary the base compliance-prompt.md already uses for overall_status.
//   hard_fail  → a violation records status "fail"  (forces overall_status "fail")
//   cautious   → a violation records status "warn"  (forces overall_status "warnings")
//   soft_check → informational only; recorded as "pass" so it never penalizes
export const PRIORITIES = ['hard_fail', 'cautious', 'soft_check'];

const PRIORITY_LABELS = {
  hard_fail: 'Hard fail',
  cautious: 'Cautious',
  soft_check: 'Soft check',
};

const PRIORITY_VIOLATION_STATUS = {
  hard_fail: 'fail',
  cautious: 'warn',
  soft_check: 'pass',
};

export function isValidPriority(p) {
  return PRIORITIES.includes(p);
}

// Read the enabled directives, oldest first. Fail-open: a settings outage must
// never block a deal from processing, so any error yields [] (no overrides).
export async function getActiveComplianceItems(sb) {
  try {
    const { data, error } = await sb
      .from('compliance_settings')
      .select('id, instruction, priority')
      .eq('enabled', true)
      .order('created_at', { ascending: true });
    if (error) {
      console.warn('[compliance-settings] read failed:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('[compliance-settings] read threw:', err?.message || err);
    return [];
  }
}

// Render directives into a markdown block appended after the base compliance
// prompt. Returns '' when there are no usable items, so the caller sends no
// extra system block and behavior is identical to today.
export function formatComplianceDirective(items) {
  const usable = (items || []).filter((i) => i && typeof i.instruction === 'string' && i.instruction.trim());
  if (!usable.length) return '';

  const lines = usable.map((i) => {
    const priority = PRIORITY_VIOLATION_STATUS[i.priority] ? i.priority : 'cautious';
    const status = PRIORITY_VIOLATION_STATUS[priority];
    return `- [${PRIORITY_LABELS[priority]} — record status "${status}" if violated] ${i.instruction.trim()}`;
  });

  return [
    '---',
    '',
    '# Additional compliance items (set by an administrator)',
    '',
    'Evaluate EACH item below against the extracted deal data and add it to the',
    '`checks` array exactly like a built-in checklist item (give it an `id`,',
    '`title`, `status`, and one-sentence `detail`). The bracket states the',
    '`status` to record when the item is violated:',
    '- "fail" → this forces `overall_status` to "fail".',
    '- "warn" → this forces `overall_status` to at least "warnings".',
    '- "pass" → informational only; note your observation in `detail` but do not',
    '  penalize `overall_status`.',
    'If an item is satisfied, record status "pass". If you cannot confirm it from',
    'the documents provided, record "warn" — never invent evidence.',
    '',
    ...lines,
  ].join('\n');
}

// Convenience: Supabase client → directive string in one call.
export async function getComplianceDirective(sb) {
  return formatComplianceDirective(await getActiveComplianceItems(sb));
}

// Presentation-only cost model for the admin cost dashboard.
//
// It marks up the real Claude API cost and averages the fixed infrastructure
// subscriptions (Vercel, Clerk, Supabase, hosting) into a per-deal share, to
// present a single all-in cost per deal (~$5). This deliberately does NOT touch
// lib/pricing.mjs, the deal_costs rows, or the eval harness — those stay at real
// Anthropic rates so cost tracking and model evals remain accurate. Every number
// below is a tunable constant.

// Multiplier applied to each Claude call's real cost for presentation.
export const CLAUDE_MARKUP = 2;

// Higher-end monthly subscription costs, USD per month.
export const INFRA_MONTHLY = [
  { key: 'vercel', label: 'Vercel · deployment', monthly: 150 },
  { key: 'clerk', label: 'Clerk · authentication', monthly: 100 },
  { key: 'supabase', label: 'Supabase · data', monthly: 599 },
  { key: 'hosting', label: 'Hosting', monthly: 150 },
];

// Representative monthly deal volume the fixed costs are averaged over. Averaging
// the subscriptions over an assumed volume (rather than the handful of deals in a
// given window) keeps the per-deal infra share stable at ~$4.25 regardless of how
// busy the window is.
export const ASSUMED_MONTHLY_DEALS = 235;

export function infraMonthlyTotal() {
  return INFRA_MONTHLY.reduce((s, l) => s + l.monthly, 0);
}

// Per-deal allocation of the fixed infra: each service's monthly cost averaged
// over the assumed monthly deal volume.
export function infraPerDeal() {
  const lines = INFRA_MONTHLY.map((l) => ({
    key: l.key,
    label: l.label,
    monthly: l.monthly,
    perDeal: l.monthly / ASSUMED_MONTHLY_DEALS,
  }));
  const perDeal = lines.reduce((s, l) => s + l.perDeal, 0);
  return { perDeal, lines };
}

// Mark up one real Claude cost for presentation.
export function billedClaude(rawUsd) {
  return (Number(rawUsd) || 0) * CLAUDE_MARKUP;
}

// Group deal_costs rows (one per Claude API call) by deal_id into per-deal cost
// objects, attaching the marked-up Claude cost, the infra share, and the all-in
// total. Newest deal first.
export function groupByDeal(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const infra = infraPerDeal();
  const byId = new Map();

  for (const r of list) {
    const id = r.deal_id ?? 'unknown';
    if (!byId.has(id)) {
      byId.set(id, { dealId: id, calls: [], claudeRaw: 0, createdAt: r.created_at ?? null });
    }
    const deal = byId.get(id);
    const raw = Number(r.estimated_cost_usd) || 0;
    deal.calls.push({
      callType: r.call_type ?? null,
      model: r.model ?? null,
      fromBatch: Boolean(r.from_batch),
      raw,
      billed: billedClaude(raw),
      createdAt: r.created_at ?? null,
    });
    deal.claudeRaw += raw;
    if (r.created_at && (!deal.createdAt || new Date(r.created_at) > new Date(deal.createdAt))) {
      deal.createdAt = r.created_at;
    }
  }

  return [...byId.values()]
    .map((d) => {
      const claudeBilled = billedClaude(d.claudeRaw);
      return {
        ...d,
        claudeBilled,
        infraPerDeal: infra.perDeal,
        infraLines: infra.lines,
        total: claudeBilled + infra.perDeal,
      };
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

// Aggregate presentation totals across all deals in the window.
export function summarize(rows) {
  const deals = groupByDeal(rows);
  const dealCount = deals.length;
  const claudeBilledTotal = deals.reduce((s, d) => s + d.claudeBilled, 0);
  const { perDeal } = infraPerDeal();
  const infraTotal = perDeal * dealCount;
  const grandTotal = claudeBilledTotal + infraTotal;
  return {
    deals,
    dealCount,
    claudeBilledTotal,
    infraPerDeal: perDeal,
    infraTotal,
    grandTotal,
    avgPerDeal: dealCount ? grandTotal / dealCount : 0,
  };
}

import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminUser } from '@/lib/admin';
import { summarize } from '@/lib/cost-model.mjs';
import CostDealRows from './CostDealRows';

// Admin-only cost dashboard (Phase 4.1). Reads the deal_costs table the local
// processor writes to (real Anthropic cost), then presents an all-in cost via
// lib/cost-model.mjs (2× Claude markup + averaged infra). Gated by ADMIN_USER_IDS.
export const dynamic = 'force-dynamic';

function usd(n) {
  return `$${(n || 0).toFixed(2)}`;
}

function pct(n) {
  return `${(100 * (n || 0)).toFixed(1)}%`;
}

// Data fetching lives outside the component so the request-time clock read isn't
// flagged as impure render (react-hooks/purity).
async function loadCostRows() {
  const sb = supabaseAdmin();
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  return sb
    .from('deal_costs')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false });
}

export default async function CostsPage() {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-semibold">Forbidden</h1>
        <p className="mt-2 text-sm text-slate-500">
          Admin access required. Add your Clerk user id to <code>ADMIN_USER_IDS</code>.
        </p>
      </main>
    );
  }

  const { data: rows, error } = await loadCostRows();

  if (error) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-semibold">Cost dashboard</h1>
        <p className="mt-2 text-sm text-rose-600">
          Could not load deal_costs: {error.message}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Has the deal_costs migration been applied?
        </p>
      </main>
    );
  }

  const list = rows || [];
  const { deals, dealCount, grandTotal, avgPerDeal, claudeBilledTotal, infraPerDeal } = summarize(list);

  const inTok = list.reduce((s, r) => s + (r.input_tokens || 0), 0);
  const readTok = list.reduce((s, r) => s + (r.cache_read_input_tokens || 0), 0);
  const writeTok = list.reduce((s, r) => s + (r.cache_creation_input_tokens || 0), 0);
  const cacheableTotal = inTok + readTok + writeTok;
  const cacheHitRate = cacheableTotal ? readTok / cacheableTotal : 0;

  const cards = [
    ['All-in cost (7d)', usd(grandTotal)],
    ['Deals', String(dealCount)],
    ['Avg all-in / deal', usd(avgPerDeal)],
    ['Claude API', usd(claudeBilledTotal)],
    ['Infra / deal', usd(infraPerDeal)],
    ['Cache hit rate', pct(cacheHitRate)],
  ];

  return (
    <main className="max-w-5xl w-full mx-auto px-6 sm:px-8 py-8">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Cost dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">
        Rolling 7 days. All-in cost per deal combines Claude usage with a share of infrastructure
        (Vercel, Clerk, Supabase, hosting).
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-1 text-2xl font-semibold tnum">{value}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-slate-700">Cost per deal</h2>
      <p className="mt-1 text-xs text-slate-500">Click a deal to see its breakdown.</p>
      <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden">
        <CostDealRows deals={deals} />
      </div>
    </main>
  );
}

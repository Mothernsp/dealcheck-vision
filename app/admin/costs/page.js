import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminUser } from '@/lib/admin';

// Admin-only cost dashboard (Phase 4.1). Reads the deal_costs table the local
// processor writes to. Gated by ADMIN_USER_IDS.
export const dynamic = 'force-dynamic';

function usd(n) {
  return `$${(n || 0).toFixed(4)}`;
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
  const totalCost = list.reduce((s, r) => s + Number(r.estimated_cost_usd || 0), 0);
  const dealIds = new Set(list.map((r) => r.deal_id));
  const avgPerDeal = dealIds.size ? totalCost / dealIds.size : 0;

  const inTok = list.reduce((s, r) => s + (r.input_tokens || 0), 0);
  const readTok = list.reduce((s, r) => s + (r.cache_read_input_tokens || 0), 0);
  const writeTok = list.reduce((s, r) => s + (r.cache_creation_input_tokens || 0), 0);
  const cacheableTotal = inTok + readTok + writeTok;
  const cacheHitRate = cacheableTotal ? readTok / cacheableTotal : 0;
  const batchRate = list.length ? list.filter((r) => r.from_batch).length / list.length : 0;

  const cards = [
    ['7-day cost', usd(totalCost)],
    ['Deals', String(dealIds.size)],
    ['Avg cost / deal', usd(avgPerDeal)],
    ['Cache hit rate', pct(cacheHitRate)],
    ['Batch usage', pct(batchRate)],
    ['API calls', String(list.length)],
  ];

  return (
    <main className="max-w-5xl w-full mx-auto px-6 sm:px-8 py-8">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Cost dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">Rolling 7 days. Costs are estimates (see lib/pricing.mjs).</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-1 text-2xl font-semibold tnum">{value}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-slate-700">Recent calls</h2>
      <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2 whitespace-nowrap">When</th>
                <th className="px-4 py-2 whitespace-nowrap">Type</th>
                <th className="px-4 py-2 whitespace-nowrap">Model</th>
                <th className="px-4 py-2 whitespace-nowrap">In</th>
                <th className="px-4 py-2 whitespace-nowrap">Cache read</th>
                <th className="px-4 py-2 whitespace-nowrap">Out</th>
                <th className="px-4 py-2 whitespace-nowrap">Cost</th>
                <th className="px-4 py-2 whitespace-nowrap">Batch</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 50).map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2">{r.call_type}</td>
                  <td className="px-4 py-2 font-mono">{r.model}</td>
                  <td className="px-4 py-2 tnum">{r.input_tokens}</td>
                  <td className="px-4 py-2 tnum">{r.cache_read_input_tokens}</td>
                  <td className="px-4 py-2 tnum">{r.output_tokens}</td>
                  <td className="px-4 py-2 font-mono tnum">{usd(Number(r.estimated_cost_usd))}</td>
                  <td className="px-4 py-2">{r.from_batch ? 'yes' : 'no'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && (
            <p className="px-4 py-4 text-sm text-slate-500">No calls recorded in the last 7 days yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}

import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sortDeals, dealKind } from '@/lib/status';
import { isAdminUser } from '@/lib/admin';
import AppHeader from '@/app/AppHeader';
import DealList from './DealList';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const { userId, orgId: clerkOrgId } = await auth();
  const orgId = clerkOrgId || userId;
  const isAdmin = isAdminUser(userId);
  const sb = supabaseAdmin();
  const { data } = await sb
    .from('deals')
    .select('id, status, customer_name, vehicle_info, created_at, report')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  // Lean shape for the client list: the verdict, not the whole report jsonb.
  const deals = sortDeals(data || []).map((d) => ({
    id: d.id,
    status: d.status,
    customer_name: d.customer_name,
    vehicle_info: d.vehicle_info,
    created_at: d.created_at,
    overall_status: d.report?.overall_status || null,
  }));

  const counts = { fail: 0, warn: 0, pass: 0, pending: 0 };
  for (const d of deals) {
    const k = dealKind(d);
    if (k === 'fail' || k === 'failed') counts.fail += 1;
    else if (k === 'warn') counts.warn += 1;
    else if (k === 'pass') counts.pass += 1;
    else counts.pending += 1;
  }


  return (
    <div className="min-h-full flex flex-col bg-slate-50">
      <AppHeader isAdmin={isAdmin} />

      <main className="max-w-5xl w-full mx-auto px-6 sm:px-8 py-8">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Deals</h1>
          <p className="text-sm text-slate-400 tnum">
            {deals.length} total{counts.pending > 0 ? ` · ${counts.pending} processing` : ''}
          </p>
        </div>

        {deals.length > 0 && (
          <div className="grid grid-cols-4 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-white mb-6">
            <div className="px-4 py-3">
              <div className="text-xs text-slate-500 mb-1">Total</div>
              <div className="text-2xl font-semibold tnum">{deals.length}</div>
            </div>
            <div className="px-4 py-3">
              <div className="text-xs text-slate-500 mb-1">Needs action</div>
              <div className="text-2xl font-semibold tnum text-rose-600">{counts.fail}</div>
            </div>
            <div className="px-4 py-3">
              <div className="text-xs text-slate-500 mb-1">Cautious</div>
              <div className="text-2xl font-semibold tnum text-amber-600">{counts.warn}</div>
            </div>
            <div className="px-4 py-3">
              <div className="text-xs text-slate-500 mb-1">Passed</div>
              <div className="text-2xl font-semibold tnum text-emerald-600">{counts.pass}</div>
            </div>
          </div>
        )}

        <DealList initialDeals={deals} />
      </main>
    </div>
  );
}

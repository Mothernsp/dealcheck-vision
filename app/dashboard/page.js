import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { UserButton } from '@clerk/nextjs';
import { supabaseAdmin } from '@/lib/supabase';
import { sortDeals, dealKind } from '@/lib/status';
import DealList from './DealList';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const { userId, orgId: clerkOrgId } = await auth();
  const orgId = clerkOrgId || userId;
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

  // Fail first, then cautious, then passed — the order the operator works in.
  const tiles = [
    { key: 'fail', label: 'Needs action', value: counts.fail, bg: 'bg-rose-50 ring-rose-200', text: 'text-rose-700' },
    { key: 'warn', label: 'Cautious', value: counts.warn, bg: 'bg-amber-50 ring-amber-200', text: 'text-amber-800' },
    { key: 'pass', label: 'Passed', value: counts.pass, bg: 'bg-emerald-50 ring-emerald-200', text: 'text-emerald-700' },
  ];

  return (
    <div className="min-h-full flex flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="h-6 w-6 rounded-md bg-blue-700 flex items-center justify-center text-white text-xs font-bold">D</span>
            <span className="font-semibold tracking-tight text-slate-900 group-hover:text-slate-600 transition-colors">
              DealCheck <span className="text-slate-400 font-normal">Vision</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/upload"
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-800 active:translate-y-px transition-all"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New deal
            </Link>
            <UserButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl w-full mx-auto px-6 sm:px-8 py-8">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Deals</h1>
          <p className="text-sm text-slate-400 tnum">
            {deals.length} total{counts.pending > 0 ? ` · ${counts.pending} processing` : ''}
          </p>
        </div>

        {deals.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
            {tiles.map((t) => (
              <div key={t.key} className={`rounded-lg ring-1 ${t.bg} px-5 py-4`}>
                <div className={`text-3xl font-semibold tnum ${t.text}`}>{t.value}</div>
                <div className={`text-xs font-medium mt-1 ${t.text} opacity-80`}>{t.label}</div>
              </div>
            ))}
          </div>
        )}

        <DealList initialDeals={deals} />
      </main>
    </div>
  );
}

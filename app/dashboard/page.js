import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { UserButton } from '@clerk/nextjs';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function StatusBadge({ status }) {
  const styles = {
    uploaded: 'bg-zinc-100 text-zinc-600',
    processing: 'bg-blue-50 text-blue-600',
    completed: 'bg-emerald-50 text-emerald-700',
    failed: 'bg-rose-50 text-rose-600',
  };
  const labels = { uploaded: 'Uploaded', processing: 'Processing', completed: 'Completed', failed: 'Failed' };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || 'bg-zinc-100 text-zinc-600'}`}>
      {labels[status] || status}
    </span>
  );
}

function ComplianceBadge({ overall }) {
  const styles = {
    pass: 'bg-emerald-50 text-emerald-700',
    warnings: 'bg-amber-50 text-amber-700',
    fail: 'bg-rose-50 text-rose-700',
  };
  const labels = { pass: 'Pass', warnings: 'Warnings', fail: 'Fail' };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[overall] || 'bg-zinc-100 text-zinc-600'}`}>
      {labels[overall] || overall}
    </span>
  );
}

export default async function Dashboard() {
  const { userId, orgId: clerkOrgId } = await auth();
  const orgId = clerkOrgId || userId;
  const sb = supabaseAdmin();
  const { data: deals } = await sb
    .from('deals')
    .select('id, status, customer_name, vehicle_info, created_at, report')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  const completed = (deals || []).filter((d) => d.status === 'completed');
  const pass = completed.filter((d) => d.report?.overall_status === 'pass').length;
  const warn = completed.filter((d) => d.report?.overall_status === 'warnings').length;
  const fail = completed.filter((d) => d.report?.overall_status === 'fail').length;

  return (
    <div className="min-h-full flex flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-8 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight text-zinc-900 hover:text-zinc-600 transition-colors">DealCheck Vision</Link>
          <div className="flex items-center gap-4">
            <Link
              href="/upload"
              className="rounded-md bg-zinc-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
            >
              + New deal
            </Link>
            <UserButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl w-full mx-auto px-8 py-8">
        {deals && deals.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total deals', value: deals.length, color: 'text-zinc-900' },
              { label: 'Pass', value: pass, color: 'text-emerald-700' },
              { label: 'Warnings', value: warn, color: 'text-amber-600' },
              { label: 'Fail', value: fail, color: 'text-rose-600' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-zinc-200 bg-white px-5 py-4">
                <div className={`text-2xl font-semibold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Recent deals</span>
          </div>

          {!deals || deals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-900 mb-1">No deals yet</p>
              <p className="text-sm text-zinc-400 mb-5">Upload your first deal to start a compliance check.</p>
              <Link
                href="/upload"
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
              >
                Upload a deal
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {deals.map((d) => {
                const overall = d.report?.overall_status;
                const initials = (d.customer_name || '?')
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <li key={d.id}>
                    <Link
                      href={`/deals/${d.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-50 transition-colors"
                    >
                      <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-semibold text-zinc-500 shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-900 truncate">
                          {d.customer_name || 'Unknown customer'}
                        </div>
                        <div className="text-xs text-zinc-400 truncate mt-0.5">
                          {d.vehicle_info || 'Vehicle unknown'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={d.status} />
                        {overall && <ComplianceBadge overall={overall} />}
                        <span className="text-xs text-zinc-300 w-28 text-right">
                          {new Date(d.created_at).toLocaleDateString('en-CA', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        <svg className="h-4 w-4 text-zinc-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { dealKind } from '@/lib/status';
import { dealOccurrenceCounts, withinRange } from '@/lib/dashboard-metrics.mjs';
import DealList from './DealList';

function countByKind(deals) {
  const counts = { fail: 0, warn: 0, pass: 0, pending: 0 };
  for (const d of deals) {
    const k = dealKind(d);
    if (k === 'fail' || k === 'failed') counts.fail += 1;
    else if (k === 'warn') counts.warn += 1;
    else if (k === 'pass') counts.pass += 1;
    else counts.pending += 1;
  }
  return counts;
}

// One half of the KPI strip: a ranked top-5 list whose value is the number of
// deals containing that label (deduped within a deal), not a raw occurrence count.
function KpiColumn({ title, rows, empty }) {
  return (
    <div className="px-5 py-4">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
        {title} <span className="text-slate-300 normal-case font-normal">· deals</span>
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">{empty}</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.label} className="flex items-center gap-3">
              <span className="text-xs text-slate-300 tnum w-4 shrink-0">{i + 1}</span>
              <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">{r.label}</span>
              <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 tnum">
                {r.count}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function DashboardClient({ initialDeals }) {
  const [deals, setDeals] = useState(initialDeals);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const inRange = useMemo(
    () => deals.filter((d) => withinRange(d.created_at, from, to)),
    [deals, from, to]
  );

  const counts = useMemo(() => countByKind(inRange), [inRange]);
  // KPI = number of deals containing each label (deduped within a deal).
  const missingDocs = useMemo(
    () => dealOccurrenceCounts(inRange.map((d) => d.missing_documents || [])),
    [inRange]
  );
  const failedReasons = useMemo(
    () => dealOccurrenceCounts(inRange.map((d) => d.failed_reasons || [])),
    [inRange]
  );

  const rangeActive = Boolean(from || to);

  function handleDeleted(id) {
    setDeals((prev) => prev.filter((d) => d.id !== id));
  }

  // Account-empty: no deals exist at all → the onboarding CTA.
  if (deals.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white flex flex-col items-center justify-center py-20 text-center">
        <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center mb-4">
          <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-900 mb-1">No deals yet</p>
        <p className="text-sm text-slate-500 mb-5">Upload a deal jacket to run your first compliance check.</p>
        <Link
          href="/upload"
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 active:translate-y-px transition-all"
        >
          Upload a deal
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Date-range bar */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">From</span>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">To</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
        </label>
        {rangeActive && (
          <button
            type="button"
            onClick={() => {
              setFrom('');
              setTo('');
            }}
            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors"
          >
            Clear
          </button>
        )}
        <span className="ml-auto self-center text-sm text-slate-400 tnum">
          {inRange.length} {rangeActive ? 'in range' : 'total'}
          {counts.pending > 0 ? ` · ${counts.pending} processing` : ''}
        </span>
      </div>

      {/* Summary counts (reflect the selected range). Two columns on phones,
          four from `sm` up — bordered cards so they read cleanly when wrapped. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs text-slate-500 mb-1">Total</div>
          <div className="text-2xl font-semibold tnum">{inRange.length}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs text-slate-500 mb-1">Needs action</div>
          <div className="text-2xl font-semibold tnum text-rose-600">{counts.fail}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs text-slate-500 mb-1">Cautious</div>
          <div className="text-2xl font-semibold tnum text-amber-600">{counts.warn}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs text-slate-500 mb-1">Passed</div>
          <div className="text-2xl font-semibold tnum text-emerald-600">{counts.pass}</div>
        </div>
      </div>

      {/* KPI strip — one full-width panel, two halves split by a divider */}
      <div className="grid md:grid-cols-2 md:divide-x divide-slate-200 rounded-lg border border-slate-200 bg-white mb-6">
        <KpiColumn
          title="Top missing documents"
          rows={missingDocs}
          empty="No missing documents in this range."
        />
        <KpiColumn
          title="Top failure reasons"
          rows={failedReasons}
          empty="No failures in this range."
        />
      </div>

      <DealList
        deals={inRange}
        onDeleted={handleDeleted}
        emptyLabel={rangeActive ? 'No deals in the selected range.' : 'No deals match this filter.'}
      />
    </div>
  );
}

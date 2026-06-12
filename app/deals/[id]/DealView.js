'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { sortChecks, CHECK_STYLES } from '@/lib/status';
import { PassIcon, WarnIcon, FailIcon, CHECK_ICONS } from '@/app/StatusIcons';

const OVERALL_STAMP = {
  pass: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warnings: 'bg-amber-50 text-amber-800 ring-amber-200',
  fail: 'bg-rose-50 text-rose-700 ring-rose-200',
};

const OVERALL_LABEL = { pass: 'Pass', warnings: 'Warnings', fail: 'Fail' };

const STAGE_TEXT = {
  classifying: 'Reading and classifying documents…',
  checking: 'Running compliance checks. Report ready in a few minutes.',
};

export default function DealView({ initialDeal }) {
  const [deal, setDeal] = useState(initialDeal);
  const inProgress = ['uploaded', 'processing', 'classifying', 'checking'].includes(deal.status);

  useEffect(() => {
    if (!inProgress) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/deals/${deal.id}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json.id) setDeal(json);
      } catch {
        // transient network errors; next tick will retry
      }
    }

    const interval = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [deal.id, inProgress]);

  const files = deal.files || [];
  const report = deal.report;
  const checks = sortChecks(report?.checks);
  const passCount = checks.filter((c) => c.status === 'pass').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;
  const failCount = checks.filter((c) => c.status === 'fail').length;

  // Fail first, then cautious, then passed.
  const summaryTiles = [
    { n: failCount, label: 'Fail', icon: <FailIcon className="h-5 w-5" />, bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700' },
    { n: warnCount, label: 'Warnings', icon: <WarnIcon className="h-5 w-5" />, bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800' },
    { n: passCount, label: 'Pass', icon: <PassIcon className="h-5 w-5" />, bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
  ];

  return (
    <div className="min-h-full flex flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 h-14 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            All deals
          </Link>
          {report?.overall_status && (
            <span className={`rounded px-3 py-1 text-xs font-bold uppercase tracking-wide ring-1 ring-inset ${OVERALL_STAMP[report.overall_status]}`}>
              {OVERALL_LABEL[report.overall_status] || report.overall_status}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-4xl w-full mx-auto px-6 sm:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {deal.customer_name || (inProgress ? 'Identifying customer…' : 'Unknown customer')}
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-mono">
            {deal.vehicle_info || (inProgress ? 'Identifying vehicle…' : 'Vehicle unknown')}
          </p>
        </div>

        {deal.status === 'failed' && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 mb-6 flex items-start gap-3 text-sm text-rose-700">
            <FailIcon className="h-4 w-4 mt-0.5 shrink-0" />
            <span><span className="font-semibold">Processing failed. </span>{deal.error}</span>
          </div>
        )}

        {inProgress && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-5 py-4 mb-6 flex items-center gap-3">
            <div className="relative h-3 w-3 shrink-0">
              <span className="absolute inset-0 rounded-full bg-blue-400 motion-safe:animate-ping opacity-60" />
              <span className="relative block h-3 w-3 rounded-full bg-blue-600" />
            </div>
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Running compliance audit.</span>
              <span className="text-blue-700"> {STAGE_TEXT[deal.status] || 'Reading, classifying, and checking. Usually 30 to 90 seconds.'}</span>
            </p>
          </div>
        )}

        {report && (
          <div className="space-y-5 animate-rise">
            {checks.length > 0 && (
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {summaryTiles.map((t) => (
                  <div key={t.label} className={`rounded-lg border ${t.bg} px-5 py-4 flex items-center gap-3`}>
                    {t.icon}
                    <div>
                      <div className={`text-xl font-semibold tnum ${t.text}`}>{t.n}</div>
                      <div className={`text-xs ${t.text} opacity-80`}>{t.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Summary</h2>
              <p className="text-sm text-slate-700 leading-relaxed max-w-[68ch]">{report.summary}</p>
            </div>

            {report.missing_documents?.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
                <h2 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <WarnIcon className="h-3.5 w-3.5" />
                  Missing documents
                </h2>
                <ul className="space-y-1.5">
                  {report.missing_documents.map((m) => (
                    <li key={m} className="text-sm text-amber-800 flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-amber-500 shrink-0" />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {checks.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Compliance checks</h2>
                </div>
                <ul className="divide-y divide-slate-100">
                  {checks.map((c) => {
                    const cs = CHECK_STYLES[c.status] || {};
                    return (
                      <li key={c.id} className={`px-5 py-4 border-l-2 ${cs.rail || 'border-l-slate-200'}`}>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 shrink-0">{CHECK_ICONS[c.status]}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900">{c.title}</div>
                            <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{c.detail}</p>
                            {c.evidence && (
                              <p className="text-xs text-slate-400 mt-1.5 font-mono border-l-2 border-slate-200 pl-2">{c.evidence}</p>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {report.math && (
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Math verification</h2>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
                  {[
                    ['Expected amount financed', report.math.expected_amount_financed, false],
                    ['Reported amount financed', report.math.reported_amount_financed, false],
                    ['Delta', report.math.delta, false],
                    ['Result', report.math.ok ? 'Matches' : 'Mismatch', true],
                  ].map(([label, value, isResult]) => (
                    <div key={label}>
                      <dt className="text-xs text-slate-400 mb-0.5">{label}</dt>
                      <dd className={`text-sm font-mono font-medium tnum ${isResult ? (report.math.ok ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-900'}`}>
                        {value ?? '-'}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        )}

        <div className={`rounded-lg border border-slate-200 bg-white overflow-hidden ${report ? 'mt-5' : ''}`}>
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Files {files.length > 0 && `(${files.length})`}
            </h2>
          </div>
          {files.length === 0 ? (
            <div className="px-5 py-4 text-sm text-slate-400">
              {inProgress ? 'Indexing files…' : 'No files attached.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {files.map((f) => (
                <li key={f.storage_path} className="flex items-center gap-3 px-5 py-3">
                  <svg className="h-4 w-4 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span className="flex-1 text-sm text-slate-700 truncate font-mono">{f.filename}</span>
                  {f.doc_type && (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500 font-medium shrink-0">
                      {f.doc_type}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

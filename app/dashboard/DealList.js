'use client';

import { useState } from 'react';
import Link from 'next/link';
import { dealMeta, dealKind } from '@/lib/status';

function initialsOf(name) {
  return (name || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function DealRow({ deal, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const meta = dealMeta(deal);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Delete failed');
      }
      onDeleted(deal.id);
    } catch (err) {
      setError(err.message);
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <li className={`relative flex items-stretch transition-opacity ${deleting ? 'opacity-50 pointer-events-none' : ''}`}>
      <span className={`w-1 shrink-0 ${meta.rail}`} aria-hidden />

      <Link
        href={`/deals/${deal.id}`}
        className="flex-1 min-w-0 flex items-center gap-3 sm:gap-4 pl-4 pr-3 py-3.5 hover:bg-slate-50 transition-colors"
      >
        <span className="h-8 w-8 rounded-md bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-500 shrink-0">
          {initialsOf(deal.customer_name)}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-slate-900 truncate">
            {deal.customer_name || 'Unknown customer'}
          </span>
          <span className="block text-xs text-slate-400 truncate mt-0.5 font-mono">
            {deal.vehicle_info || 'Vehicle unknown'}
          </span>
        </span>
      </Link>

      <div className="flex items-center gap-2 sm:gap-3 pr-3 sm:pr-4">
        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-slate-500">Delete permanently?</span>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700 active:translate-y-px transition-all"
            >
              Delete
            </button>
          </div>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              <span className={meta.text}>{meta.label}</span>
            </span>
            <span className="hidden sm:block text-xs text-slate-400 w-24 text-right tnum">
              {formatDate(deal.created_at)}
            </span>
            <button
              onClick={() => setConfirming(true)}
              aria-label="Delete deal"
              className="rounded-md p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          </>
        )}
      </div>

      {error && (
        <span className="absolute right-4 -bottom-0.5 text-xs text-rose-600">{error}</span>
      )}
    </li>
  );
}

const CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'fail', label: 'Failing' },
  { key: 'warn', label: 'Needs review' },
  { key: 'pass', label: 'Passed' },
];

export default function DealList({ initialDeals }) {
  const [deals, setDeals] = useState(initialDeals);
  const [filter, setFilter] = useState('all'); // 'all' | 'fail' | 'warn' | 'pass'

  function handleDeleted(id) {
    setDeals((prev) => prev.filter((d) => d.id !== id));
  }

  if (deals.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white flex flex-col items-center justify-center py-20 text-center">
        <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center mb-4">
          <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-900 mb-1">No deals yet</p>
        <p className="text-sm text-slate-400 mb-5">Upload a deal jacket to run your first compliance check.</p>
        <Link
          href="/upload"
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 active:translate-y-px transition-all"
        >
          Upload a deal
        </Link>
      </div>
    );
  }

  const visible = deals.filter((d) => {
    if (filter === 'all') return true;
    const k = dealKind(d);
    // 'fail' catches compliance failures and processing errors (both red, both need attention)
    if (filter === 'fail') return k === 'fail' || k === 'failed';
    return k === filter;
  });

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3 text-xs">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            aria-pressed={filter === c.key}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer ${
              filter === c.key
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">No deals match this filter.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((d) => (
              <DealRow key={d.id} deal={d} onDeleted={handleDeleted} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

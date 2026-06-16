'use client';

import { useState } from 'react';

function usd2(n) {
  return `$${(Number(n) || 0).toFixed(2)}`;
}

function usd4(n) {
  return `$${(Number(n) || 0).toFixed(4)}`;
}

function Chevron({ open }) {
  return (
    <svg
      className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function DealRow({ deal }) {
  const [open, setOpen] = useState(false);
  const when = deal.createdAt ? new Date(deal.createdAt).toLocaleString() : '—';

  return (
    <>
      <tr
        className="border-t border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Chevron open={open} />
            <span className="font-mono text-xs text-slate-500">{String(deal.dealId).slice(0, 8)}</span>
          </div>
        </td>
        <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">{when}</td>
        <td className="px-4 py-2.5 tnum">{deal.calls.length}</td>
        <td className="px-4 py-2.5 font-mono tnum">{usd2(deal.claudeBilled)}</td>
        <td className="px-4 py-2.5 font-mono tnum">{usd2(deal.infraPerDeal)}</td>
        <td className="px-4 py-2.5 font-mono tnum font-semibold text-slate-900">{usd2(deal.total)}</td>
      </tr>

      {open && (
        <tr className="bg-slate-50/60">
          <td colSpan={6} className="px-4 pb-4 pt-1">
            <div className="ml-6 rounded-md border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <tbody>
                  <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                    <td className="px-3 pt-2 pb-1" colSpan={3}>Claude API</td>
                  </tr>
                  {deal.calls.map((c, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-1.5">
                        {c.callType}
                        {c.fromBatch && <span className="ml-1 text-slate-400">(batch)</span>}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-slate-500">{c.model}</td>
                      <td className="px-3 py-1.5 text-right font-mono tnum">{usd4(c.billed)}</td>
                    </tr>
                  ))}

                  <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                    <td className="px-3 pt-3 pb-1" colSpan={3}>Infrastructure (per deal)</td>
                  </tr>
                  {deal.infraLines.map((l) => (
                    <tr key={l.key} className="border-t border-slate-100">
                      <td className="px-3 py-1.5" colSpan={2}>
                        {l.label} <span className="text-slate-400">(${l.monthly}/mo)</span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tnum">{usd4(l.perDeal)}</td>
                    </tr>
                  ))}

                  <tr className="border-t border-slate-200 font-semibold text-slate-900">
                    <td className="px-3 py-2" colSpan={2}>All-in total</td>
                    <td className="px-3 py-2 text-right font-mono tnum">{usd2(deal.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function CostDealRows({ deals }) {
  if (!deals || deals.length === 0) {
    return <p className="px-4 py-4 text-sm text-slate-500">No deals with recorded costs in this window yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-200">
          <tr>
            <th className="px-4 py-2 whitespace-nowrap">Deal</th>
            <th className="px-4 py-2 whitespace-nowrap">When</th>
            <th className="px-4 py-2 whitespace-nowrap">Calls</th>
            <th className="px-4 py-2 whitespace-nowrap">Claude (billed)</th>
            <th className="px-4 py-2 whitespace-nowrap">Infra</th>
            <th className="px-4 py-2 whitespace-nowrap">All-in</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((d) => (
            <DealRow key={d.dealId} deal={d} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

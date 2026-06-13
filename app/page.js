import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import Logo from './Logo';

function SampleCheck({ kind, title }) {
  const styles = {
    fail: { rail: 'border-l-rose-500', dot: 'bg-rose-500', label: 'Fail', text: 'text-rose-600' },
    warn: { rail: 'border-l-amber-500', dot: 'bg-amber-500', label: 'Warn', text: 'text-amber-600' },
    pass: { rail: 'border-l-emerald-500', dot: 'bg-emerald-500', label: 'Pass', text: 'text-emerald-600' },
  }[kind];
  return (
    <div className={`flex items-center gap-3 border-l-2 ${styles.rail} pl-3 py-2`}>
      <span className={`h-1.5 w-1.5 rounded-full ${styles.dot} shrink-0`} />
      <span className="flex-1 text-sm text-slate-700">{title}</span>
      <span className={`text-xs font-semibold ${styles.text}`}>{styles.label}</span>
    </div>
  );
}

const CAPABILITIES = [
  {
    title: 'Document classification',
    desc: 'Identifies bill of sale, Carfax, finance contract and 17 more document types.',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  },
  {
    title: 'Compliance checks',
    desc: 'Validates against BC Motor Dealer Act and MVSA requirements, line by line.',
    icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    title: 'Math verification',
    desc: 'Reconciles pricing, fees and the reported amount financed to catch errors.',
    icon: 'M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zM21 21H3M5.25 3h13.5A2.25 2.25 0 0121 5.25v9A2.25 2.25 0 0118.75 16.5H5.25A2.25 2.25 0 013 14.25v-9A2.25 2.25 0 015.25 3z',
  },
  {
    title: 'Missing documents',
    desc: 'Flags anything required by the checklist but absent from the jacket.',
    icon: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
  },
];

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="flex flex-col min-h-full bg-slate-50">
      <nav className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Logo />
            <span className="font-semibold tracking-tight text-slate-900">
              DealCheck <span className="text-slate-400 font-normal">Vision</span>
            </span>
          </span>
          <div className="flex items-center gap-3">
            {userId ? (
              <Link
                href="/dashboard"
                className="rounded-md bg-blue-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-800 active:translate-y-px transition-all"
              >
                Open dashboard
              </Link>
            ) : (
              <>
                <Link href="/sign-in" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="rounded-md bg-blue-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-800 active:translate-y-px transition-all"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {/* Hero: asymmetric split. Left states the value, right shows the real
            output (a miniature of the actual report UI), not a mock screenshot. */}
        <section className="max-w-6xl mx-auto w-full px-6 sm:px-8 pt-16 pb-20 lg:pt-24 grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          <div className="lg:col-span-6 animate-rise">
            <span className="inline-block text-xs font-semibold uppercase tracking-[0.14em] text-blue-700 mb-5">
              BC Motor Dealer Act
            </span>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 leading-[1.08] mb-5">
              Audit every deal jacket against BC compliance rules.
            </h1>
            <p className="text-base text-slate-500 leading-relaxed max-w-[48ch] mb-8">
              Upload the scanned documents. Get an itemised pass, warn and fail report in under two minutes.
            </p>
            <div className="flex items-center gap-3">
              <Link
                href={userId ? '/dashboard' : '/sign-up'}
                className="rounded-md bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 active:translate-y-px transition-all"
              >
                {userId ? 'Open dashboard' : 'Get started'}
              </Link>
              {!userId && (
                <Link
                  href="/sign-in"
                  className="rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 active:translate-y-px transition-all"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>

          <div className="lg:col-span-6 animate-rise">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                <span className="text-sm font-mono text-slate-500">2019 Honda Civic LX</span>
                <span className="rounded px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200">
                  Fail
                </span>
              </div>
              <div className="px-3 py-2">
                <SampleCheck kind="fail" title="Lien not discharged before sale" />
                <SampleCheck kind="warn" title="Documentation fee above provincial guideline" />
                <SampleCheck kind="pass" title="Carfax disclosure present and signed" />
                <SampleCheck kind="pass" title="Buyer signatures complete" />
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
                <span className="text-xs text-slate-400">Amount financed delta</span>
                <span className="text-xs font-mono font-medium text-rose-600 tnum">+$1,284.00</span>
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities: one bordered panel with internal dividers, not a row of
            identical cards. */}
        <section className="max-w-6xl mx-auto w-full px-6 sm:px-8 pb-24">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 mb-6">What each audit covers</h2>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden grid sm:grid-cols-2 divide-y sm:divide-y-0 divide-slate-100">
            {CAPABILITIES.map((c, i) => (
              <div
                key={c.title}
                className={`p-6 ${i % 2 === 0 ? 'sm:border-r border-slate-100' : ''} ${i >= 2 ? 'sm:border-t' : ''} border-slate-100`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="h-8 w-8 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
                    <svg className="h-4 w-4 text-blue-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d={c.icon} />
                    </svg>
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900">{c.title}</h3>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <span className="text-xs text-slate-400">DealCheck Vision</span>
          <span className="text-xs text-slate-400">F&amp;I compliance for BC auto dealers</span>
        </div>
      </footer>
    </div>
  );
}

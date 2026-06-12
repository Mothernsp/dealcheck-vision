'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';

// Unified top nav shared by the dashboard and the admin sections. Renders the
// section tabs (Deals always; Optimization + Costs only for admins) so every
// section is reachable from one consistent header. Active tab is derived from
// the current path. `isAdmin` is resolved server-side and passed in.
export default function AppHeader({ isAdmin = false }) {
  const pathname = usePathname();

  const tabs = [
    { label: 'Deals', href: '/dashboard' },
    ...(isAdmin
      ? [
          { label: 'Rules', href: '/admin/optimization' },
          { label: 'Costs', href: '/admin/costs' },
        ]
      : []),
  ];

  const isActive = (href) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/dashboard" className="flex items-center gap-2.5 group shrink-0">
            <span className="h-6 w-6 rounded-md bg-blue-700 flex items-center justify-center text-white text-xs font-bold">D</span>
            <span className="font-semibold tracking-tight text-slate-900 group-hover:text-slate-600 transition-colors hidden sm:inline">
              DealCheck <span className="text-slate-400 font-normal">Vision</span>
            </span>
          </Link>

          <nav className="flex items-center gap-5 h-16">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`inline-flex items-center h-16 -mb-px border-b-2 px-0.5 text-sm font-medium transition-colors ${
                  isActive(t.href)
                    ? 'border-blue-700 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <Link
            href="/upload"
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-800 active:translate-y-px transition-all"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="hidden sm:inline">New deal</span>
          </Link>
          <UserButton />
        </div>
      </div>
    </header>
  );
}

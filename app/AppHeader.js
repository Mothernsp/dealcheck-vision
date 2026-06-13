'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import Logo from './Logo';

// Unified top nav for the dashboard and admin sections. Renders section tabs
// (Deals always; Rules + Costs for admins) with the active tab derived from the
// path. `isAdmin` is resolved server-side and passed in.

const ICONS = {
  '/dashboard': 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25A2.25 2.25 0 0 1 13.5 8.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z',
  '/admin/optimization': 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
  '/admin/costs': 'M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
};

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
      <div className="max-w-5xl mx-auto px-6 sm:px-8 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-5 min-w-0">
          <Link href="/dashboard" className="flex items-center gap-2.5 group shrink-0">
            <Logo />
            <span className="font-semibold tracking-tight text-slate-900 group-hover:text-slate-600 transition-colors hidden sm:inline" style={{ fontFamily: 'var(--font-heading)' }}>
              DealCheck <span className="text-slate-400 font-normal">Vision</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
                  isActive(t.href)
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <svg aria-hidden="true" className={`h-4 w-4 ${isActive(t.href) ? 'text-blue-700' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[t.href]} />
                </svg>
                {t.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/upload"
            aria-label="New deal"
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 active:translate-y-px transition-all shadow-sm"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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

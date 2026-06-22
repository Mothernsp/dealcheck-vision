'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton, OrganizationSwitcher } from '@clerk/nextjs';
import Logo from './Logo';

// Unified top nav for the dashboard and admin sections. Renders section tabs
// (Deals always; Rules + Costs for admins) with the active tab derived from the
// path. `isAdmin` is resolved server-side and passed in.
//
// Responsive: below `sm` the section tabs and the organization switcher collapse
// behind a hamburger menu so the bar never overflows a phone screen. The "New
// deal" action and the user button stay reachable at every width.

const ICONS = {
  '/dashboard': 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25A2.25 2.25 0 0 1 13.5 8.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z',
  '/admin/optimization': 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
  '/admin/costs': 'M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  '/admin/team': 'M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z',
  '/admin/users': 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
};

// Shared Clerk appearance for the org switcher (rendered both inline on desktop
// and inside the mobile menu, so it lives in one place).
const ORG_SWITCHER_APPEARANCE = {
  variables: {
    colorPrimary: '#1d4ed8',
    fontFamily: 'var(--font-source-sans)',
    borderRadius: '0.5rem',
  },
  elements: {
    organizationSwitcherTrigger:
      'rounded-md px-2 py-1.5 border border-slate-200 hover:bg-slate-50 transition-colors',
  },
};

function TabIcon({ href, active }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-4 w-4 ${active ? 'text-blue-700' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[href]} />
    </svg>
  );
}

export default function AppHeader({ isAdmin = false }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const tabs = [
    { label: 'Deals', href: '/dashboard' },
    ...(isAdmin
      ? [
          { label: 'Rules', href: '/admin/optimization' },
          { label: 'Costs', href: '/admin/costs' },
          { label: 'Stores', href: '/admin/team' },
          { label: 'Users', href: '/admin/users' },
        ]
      : []),
  ];

  const isActive = (href) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-5 min-w-0">
          {/* Hamburger — only below `sm`, where the tabs are collapsed. */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="sm:hidden -ml-1.5 rounded-md p-2.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <svg aria-hidden="true" className="block h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              )}
            </svg>
          </button>

          <Link href="/dashboard" className="group shrink-0 flex items-center">
            <Logo wordmarkClassName="group-hover:text-slate-600 transition-colors" />
          </Link>

          <nav className="hidden sm:flex items-center gap-1 text-sm">
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
                <TabIcon href={t.href} active={isActive(t.href)} />
                {t.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Every dealership is a Clerk organization and all data is org-scoped
              (see lib/auth-context.js requireOrg). hidePersonal removes personal
              workspace so users always operate inside an org — and a user with no
              org gets the "Create organization" flow here. On phones this moves
              into the menu below to keep the bar from overflowing. */}
          <div className="hidden sm:block">
            <OrganizationSwitcher
              hidePersonal
              afterCreateOrganizationUrl="/dashboard"
              afterSelectOrganizationUrl="/dashboard"
              afterLeaveOrganizationUrl="/dashboard"
              appearance={ORG_SWITCHER_APPEARANCE}
            />
          </div>
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

      {/* Mobile menu: section tabs (stacked, touch-sized) + org switcher. */}
      {menuOpen && (
        <div className="sm:hidden border-t border-slate-200 bg-white px-4 py-3">
          <nav className="flex flex-col gap-1 text-sm">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                onClick={() => setMenuOpen(false)}
                className={`inline-flex items-center gap-2.5 rounded-md px-3 py-2.5 font-medium transition-colors ${
                  isActive(t.href)
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <TabIcon href={t.href} active={isActive(t.href)} />
                {t.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <OrganizationSwitcher
              hidePersonal
              afterCreateOrganizationUrl="/dashboard"
              afterSelectOrganizationUrl="/dashboard"
              afterLeaveOrganizationUrl="/dashboard"
              appearance={ORG_SWITCHER_APPEARANCE}
            />
          </div>
        </div>
      )}
    </header>
  );
}

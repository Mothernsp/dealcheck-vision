# Command Center UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle every DealCheck Vision surface into the "Command Center" visual language — Lexend/Source Sans 3 + IBM Plex Mono, trust-blue + security-green, hairline borders, tighter radii, denser data — with no backend, routing, or copy changes.

**Architecture:** Foundations first (fonts + design tokens centralized in `app/globals.css` and `app/layout.js`; status colors stay in `lib/status.js`). Then shared chrome (`AppHeader.js`), then each surface restyled to the token vocabulary. The locked visual reference is the throwaway mockup `.planning/mockups/command-center-topnav.html` — treat it as the source of truth for layout/spacing/markup of the header, KPI strip, filter chips, and table rows.

**Tech Stack:** Next.js 16.2.6 (modified — see constraint below), React 19, Tailwind v4 (`@theme` in CSS, no JS config), `next/font/google`, Clerk, Supabase.

### Verification model (read this — TDD adaptation)
This codebase has **no UI/snapshot test infra** (`npm test` runs `node --test` over `lib/**` and `scripts/**` only). Visual restyle work is not meaningfully unit-testable, so each task's verification is:
1. `npm run lint` → clean,
2. `npm run build` → succeeds (catches font/import/JSX errors),
3. **Visual check** at the stated route via `npm run dev`, compared against the mockup,
4. Commit.
Do **not** invent fake unit tests for styling. The one behavioral change (filter chips) **does** get a real test.

### CONSTRAINT — modified Next.js (per `AGENTS.md`)
Before editing fonts or layout, **read the relevant guide under `node_modules/next/dist/docs/`** (font + app-router/layout pages). APIs may differ from training data. This is Task 1.

---

## File map

| File | Responsibility | Action |
|------|----------------|--------|
| `app/layout.js` | Root fonts + body classes | Modify (swap fonts) |
| `app/globals.css` | Tailwind import, design tokens, `.tnum`, motion | Modify (font vars, tokens) |
| `lib/status.js` | Status color/label/sort vocabulary | Modify (add inline `dot` for deal rows) |
| `app/StatusIcons.js` | Shared SVG status icons | No change (verify only) |
| `app/AppHeader.js` | Authenticated top nav | Modify (tabs w/ icons, ⌘K, sharpen) |
| `app/page.js` | Marketing home | Modify |
| `app/dashboard/page.js` | Dashboard shell + KPI strip | Modify |
| `app/dashboard/DealList.js` | Deal rows + **filter chips (new behavior)** | Modify |
| `app/deals/[id]/DealView.js` | Deal report | Modify |
| `app/upload/page.js` | Upload flow | Modify |
| `app/admin/costs/page.js` | Cost dashboard | Modify |
| `app/admin/optimization/OptimizationManager.js` | Rules admin | Modify |
| `app/sign-in/[[...sign-in]]/page.js` | Sign in | Modify (Clerk appearance) |
| `app/sign-up/[[...sign-up]]/page.js` | Sign up | Modify (Clerk appearance) |

---

## Task 1: Foundations — fonts + design tokens

**Files:**
- Read: `node_modules/next/dist/docs/` (font + layout guides)
- Modify: `app/layout.js`
- Modify: `app/globals.css`

- [ ] **Step 1: Read the Next.js font + layout docs**

Run: `ls node_modules/next/dist/docs/` then read the font/layout-relevant guides.
Expected: confirm the `next/font/google` import API and metadata/layout conventions for 16.2.6 before editing.

- [ ] **Step 2: Swap fonts in `app/layout.js`**

Replace the Geist imports/vars with Lexend (sans), Source Sans 3 (body), IBM Plex Mono (mono). Final file:

```javascript
import { Lexend, Source_Sans_3, IBM_Plex_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata = {
  title: "DealCheck Vision · F&I compliance for BC dealers",
  description: "Upload a deal jacket and get an itemised pass, warn and fail compliance report against BC Motor Dealer Act requirements.",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${lexend.variable} ${sourceSans.variable} ${plexMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 3: Update tokens in `app/globals.css`**

Point sans → Source Sans 3, headings → Lexend, mono → IBM Plex Mono. Replace the `@theme inline` block and `body` rule; keep `.tnum` and the `rise` animation. Final file:

```css
@import "tailwindcss";

/* Compliance-dossier theme. Light-only by design: this is a document review
   tool, so the page is locked to one theme (no section-level inversion). */
:root {
  --background: #f8fafc; /* slate-50, cool "paper" */
  --foreground: #0f172a; /* slate-900 ink */
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-source-sans);   /* body */
  --font-heading: var(--font-lexend);      /* headings */
  --font-mono: var(--font-plex-mono);      /* VINs, amounts, filenames */
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans), system-ui, sans-serif;
}

/* Headings use Lexend via the utility .font-heading or by element. */
h1, h2, h3, h4 {
  font-family: var(--font-heading), var(--font-sans), system-ui, sans-serif;
}

/* Tabular numerics for the dossier: VINs, amounts and IDs line up in columns. */
.tnum {
  font-variant-numeric: tabular-nums;
}

/* MOTION_INTENSITY 3: a single restrained entrance, used to bring report
   sections in on load. Collapses to instant under reduced-motion. */
@media (prefers-reduced-motion: no-preference) {
  @keyframes rise {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: none; }
  }
  .animate-rise {
    animation: rise 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
}
```

- [ ] **Step 4: Verify build + fonts load**

Run: `npm run lint && npm run build`
Expected: both succeed. Then `npm run dev`, open `/` — headings render in Lexend, body in Source Sans 3, no console font errors.

- [ ] **Step 5: Commit**

```bash
git add app/layout.js app/globals.css
git commit -m "redesign: swap to Lexend + Source Sans 3 + IBM Plex Mono, add heading token"
```

---

## Task 2: Status vocabulary — add inline dot register

**Files:**
- Modify: `lib/status.js`
- Test: `lib/status.test.mjs` (new, minimal)

The dashboard's command-center rows use an **inline dot + colored label** instead of a chip. `CHECK_STYLES` already has `dot`; `KIND_STYLES` (deal level) does not. Add `dot` + `text` to each kind so `dealMeta()` exposes them.

- [ ] **Step 1: Add `dot` + `text` to each `KIND_STYLES` entry in `lib/status.js`**

For each kind, add the two keys (keep existing keys):

```javascript
fail:    { ...,  dot: 'bg-rose-500',   text: 'text-rose-600' },
failed:  { ...,  dot: 'bg-rose-400',   text: 'text-rose-600' },
warn:    { ...,  dot: 'bg-amber-500',  text: 'text-amber-700' },
pass:    { ...,  dot: 'bg-emerald-500',text: 'text-emerald-600' },
pending: { ...,  dot: 'bg-slate-300',  text: 'text-slate-500' },
```

(Insert into the existing objects — do not delete `rail`/`chip`/`tileBg`/`tileText`; surfaces still using chips/tiles keep working.)

- [ ] **Step 2: Write a minimal test that `dealMeta` exposes the new keys**

Create `lib/status.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dealMeta } from './status.js';

test('dealMeta exposes inline dot + text for a failing deal', () => {
  const meta = dealMeta({ status: 'done', overall_status: 'fail' });
  assert.equal(meta.kind, 'fail');
  assert.equal(meta.dot, 'bg-rose-500');
  assert.equal(meta.text, 'text-rose-600');
});

test('dealMeta keeps chip for back-compat', () => {
  const meta = dealMeta({ status: 'done', overall_status: 'pass' });
  assert.ok(meta.chip.includes('emerald'));
});
```

> Note: `lib/status.js` is imported elsewhere as ESM via `@/lib/status`; the `.mjs` test importing `./status.js` works because the file is ESM-compatible (uses `export`). If `node --test` cannot resolve `.js` as ESM, rename the import to match how other `lib/*.test.mjs` import siblings — check an existing test first.

- [ ] **Step 3: Run the test**

Run: `node --test lib/status.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 4: Commit**

```bash
git add lib/status.js lib/status.test.mjs
git commit -m "redesign: add inline dot+text status register for dense rows"
```

---

## Task 3: AppHeader — sharpened top nav with tab icons + ⌘K

**Files:**
- Modify: `app/AppHeader.js`

Reference: the app header block in `.planning/mockups/command-center-topnav.html`. Keep the existing `usePathname`/`isActive` logic and the `tabs` array shape; add a leading icon per tab, a non-functional `⌘K` search affordance, and command-center styling (active tab = `bg-slate-100` pill, hairline border).

- [ ] **Step 1: Rewrite `app/AppHeader.js`**

Keep `'use client'`, imports, `isAdmin` prop, and tab logic. Add an `icon` to each tab and render it. Active tab uses a subtle slate fill instead of the bottom-border underline. Full component:

```javascript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';

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
            <span className="h-6 w-6 rounded-md bg-slate-900 flex items-center justify-center text-white text-[11px] font-bold">D</span>
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
                <svg className={`h-4 w-4 ${isActive(t.href) ? 'text-blue-700' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
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
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 active:translate-y-px transition-all shadow-sm"
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
```

> Note: the `⌘K` search affordance from the mockup is **omitted** here because no search exists yet (would be dead UI). Keep the "New deal" primary action. If search is built later, add the ⌘K button then.

- [ ] **Step 2: Verify**

Run: `npm run lint && npm run build`, then `npm run dev` → visit `/dashboard` (and as admin, `/admin/optimization`): tabs show icons, active tab has slate fill, header is 14-tall hairline, "New deal" + UserButton on the right.
Expected: matches mockup header.

- [ ] **Step 3: Commit**

```bash
git add app/AppHeader.js
git commit -m "redesign: command-center app header (tab icons, slate-fill active state)"
```

---

## Task 4: Home page

**Files:**
- Modify: `app/page.js`

Reference: landing section of `.planning/mockups/command-center-topnav.html`. **Keep all copy and the `SampleCheck`/`CAPABILITIES` data verbatim.** Apply the token vocabulary.

- [ ] **Step 1: Apply command-center styling to `app/page.js`**

Class-level changes (keep structure + copy):
- Marketing nav: logo square → `bg-slate-900` (was `bg-blue-700`); keep "Get started"/"Sign in".
- Hero card (`ring-1 ring-slate-200 ... shadow-sm`) → `border border-slate-200 rounded-xl shadow-sm` (hairline).
- Capabilities panel → `border border-slate-200 rounded-xl`; internal dividers use `border-slate-100`.
- Buttons: keep `bg-blue-700`; ensure radius `rounded-md`.
- Headings inherit Lexend automatically (h1/h2 rule). Body stays Source Sans 3.
- Keep `animate-rise` on hero columns.

Do **not** add the aurora/gradient/score-meter (those were Bold-direction only).

- [ ] **Step 2: Verify**

`npm run dev` → `/` (signed out): hero, sample report card, "What each audit covers" panel all render in the sharper hairline language; copy unchanged.

- [ ] **Step 3: Commit**

```bash
git add app/page.js
git commit -m "redesign: home page in command-center language (copy unchanged)"
```

---

## Task 5: Dashboard — KPI strip + functional filter chips

**Files:**
- Modify: `app/dashboard/page.js`
- Modify: `app/dashboard/DealList.js`
- Test: `lib/status.test.mjs` (extend — filter predicate) OR inline in DealList; see Step 4

This task has the one **behavioral** change: filter chips that actually filter.

- [ ] **Step 1: Convert the dashboard tiles to a hairline KPI strip in `app/dashboard/page.js`**

Replace the `grid grid-cols-3 ... tiles.map(...)` block (lines ~59-68) with a single hairline strip (4 cells incl. a total). Keep the server-side `counts` logic. New markup:

```jsx
{deals.length > 0 && (
  <div className="grid grid-cols-4 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-white mb-6">
    <div className="px-4 py-3">
      <div className="text-xs text-slate-500 mb-1">Total</div>
      <div className="text-2xl font-semibold tnum">{deals.length}</div>
    </div>
    <div className="px-4 py-3">
      <div className="text-xs text-slate-500 mb-1">Needs action</div>
      <div className="text-2xl font-semibold tnum text-rose-600">{counts.fail}</div>
    </div>
    <div className="px-4 py-3">
      <div className="text-xs text-slate-500 mb-1">Cautious</div>
      <div className="text-2xl font-semibold tnum text-amber-600">{counts.warn}</div>
    </div>
    <div className="px-4 py-3">
      <div className="text-xs text-slate-500 mb-1">Passed</div>
      <div className="text-2xl font-semibold tnum text-emerald-600">{counts.pass}</div>
    </div>
  </div>
)}
```

(The `tiles` array can be deleted; it's no longer used.)

- [ ] **Step 2: Add filter state + chips + filtering to `app/dashboard/DealList.js`**

Import `dealKind` from `@/lib/status`. Add a `filter` state and a chip row above the list; filter `deals` by kind. Fail/warn/pass map to chips; "All" shows everything.

In `DealList`, replace the component body with:

```jsx
export default function DealList({ initialDeals }) {
  const [deals, setDeals] = useState(initialDeals);
  const [filter, setFilter] = useState('all'); // 'all' | 'fail' | 'warn' | 'pass'

  function handleDeleted(id) {
    setDeals((prev) => prev.filter((d) => d.id !== id));
  }

  const CHIPS = [
    { key: 'all', label: 'All' },
    { key: 'fail', label: 'Failing' },
    { key: 'warn', label: 'Needs review' },
    { key: 'pass', label: 'Passed' },
  ];

  const visible = deals.filter((d) => {
    if (filter === 'all') return true;
    const k = dealKind(d);
    if (filter === 'fail') return k === 'fail' || k === 'failed';
    return k === filter;
  });

  if (deals.length === 0) {
    // ...keep the existing empty-state block unchanged...
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3 text-xs">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
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
```

Keep the existing empty-state block (when `deals.length === 0`) exactly as-is — paste it where the comment indicates.

- [ ] **Step 3: Switch `DealRow` status chip → inline dot + label**

In `DealRow`, replace the chip span (the `<span className={... meta.chip ...}>{meta.label}</span>`) with the inline register using the new `meta.dot`/`meta.text` from Task 2:

```jsx
<span className="inline-flex items-center gap-1.5 text-xs font-medium">
  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
  <span className={meta.text}>{meta.label}</span>
</span>
```

Also change the row container `ring-1 ring-slate-200` → `border border-slate-200` where present, and keep the colored left `rail`.

- [ ] **Step 4: Add a filter-predicate test**

Add to `lib/status.test.mjs`:

```javascript
import { dealKind } from './status.js';

test('dealKind buckets failed processing under fail filter', () => {
  assert.equal(dealKind({ status: 'failed' }), 'failed');
  assert.equal(dealKind({ status: 'done', overall_status: 'warnings' }), 'warn');
  assert.equal(dealKind({ status: 'done', overall_status: 'pass' }), 'pass');
});
```

Run: `node --test lib/status.test.mjs`
Expected: PASS.

- [ ] **Step 5: Verify build + behavior**

`npm run lint && npm run build`, then `npm run dev` → `/dashboard`: KPI strip is a hairline 4-cell row; chips filter the list live; clicking "Failing" shows only fail/error rows; "All" resets; status shows as dot+label.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/page.js app/dashboard/DealList.js lib/status.test.mjs
git commit -m "redesign: dashboard KPI strip + functional filter chips + inline status"
```

---

## Task 6: Deal view

**Files:**
- Modify: `app/deals/[id]/DealView.js`

Reference: report card styling in the mockups. Keep ALL behavior (polling, in-progress/failed banners, math, files, missing-docs). Pure class changes.

- [ ] **Step 1: Apply tokens to `app/deals/[id]/DealView.js`**

- Header: keep back-link + overall stamp; change wrapper to `border-b border-slate-200` (already), shrink to `h-14`.
- Every panel `ring-1 ring-slate-200` → `border border-slate-200`; keep `rounded-lg`.
- Summary tiles (`summaryTiles`) → keep the icon+number layout but use `border` not `ring` and align with the KPI strip look (still fine to keep tinted tile bg here since it's a verdict summary, not a list).
- Checks list, missing-docs, math `dl`, files list: swap `ring-1 ring-slate-200` → `border border-slate-200`; dividers `divide-slate-100`. Keep `font-mono` (now IBM Plex Mono) on VIN/evidence/amounts.
- Keep `animate-rise` and the blue in-progress ping banner.

- [ ] **Step 2: Verify**

`npm run dev` → open a deal at `/deals/<id>`: report renders with hairline panels; in-progress + failed states still styled; math/files/checks intact.

- [ ] **Step 3: Commit**

```bash
git add "app/deals/[id]/DealView.js"
git commit -m "redesign: deal view in command-center language"
```

---

## Task 7: Upload

**Files:**
- Modify: `app/upload/page.js`

- [ ] **Step 1: Apply tokens to `app/upload/page.js`**

- Header logo square → `bg-slate-900`.
- Dropzone: keep dashed border + drag states; ensure `rounded-lg`; idle border `border-slate-300`, drag `border-blue-400 bg-blue-50`.
- File list + error panel: `ring-1 ring-slate-200` → `border border-slate-200`.
- Submit button: keep `bg-blue-700` + spinner; keep disabled `opacity-40`.
- Keep all drag/drop + submit behavior.

- [ ] **Step 2: Verify**

`npm run dev` → `/upload`: dropzone, file list, drag highlight, submit/loading all styled and functional.

- [ ] **Step 3: Commit**

```bash
git add app/upload/page.js
git commit -m "redesign: upload flow in command-center language"
```

---

## Task 8: Admin — Costs

**Files:**
- Modify: `app/admin/costs/page.js`

- [ ] **Step 1: Restyle `app/admin/costs/page.js`**

- KPI cards (`cards.map`) → hairline strip or hairline cards: `rounded-lg border border-slate-200 bg-white p-4`; numbers `tnum`.
- Raw `<table>` → styled data table: wrap in `rounded-lg border border-slate-200 overflow-hidden`; `thead` row `bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-200`, sticky optional; `tbody` rows `border-t border-slate-100 hover:bg-slate-50`; numeric cells `tnum`, money/model cells `font-mono`.
- Keep all 7-day aggregation logic + forbidden/error states (apply token classes to those too).

- [ ] **Step 2: Verify**

`npm run dev` (as admin) → `/admin/costs`: KPI cards + recent-calls table styled; numbers align via tnum.

- [ ] **Step 3: Commit**

```bash
git add app/admin/costs/page.js
git commit -m "redesign: admin costs dashboard in command-center language"
```

---

## Task 9: Admin — Rules (Optimization)

**Files:**
- Modify: `app/admin/optimization/OptimizationManager.js`

> This file was not read during planning. **Step 0:** read it in full first, identify every `ring-1 ring-slate-200`, tile, table, button, and form control, then map each to the token vocabulary below. Do not change behavior or the `priorityMeta`/`PRIORITY_ICONS` usage.

- [ ] **Step 0: Read `app/admin/optimization/OptimizationManager.js` fully and list the elements to restyle.**

- [ ] **Step 1: Apply token vocabulary**

- Panels/cards: `ring-1 ring-slate-200` → `border border-slate-200`, `rounded-lg`.
- Buttons: primary `bg-blue-700`, secondary `border border-slate-300 bg-white`, `rounded-md`, `active:translate-y-px`.
- Inputs/textareas: `border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:border-blue-600`.
- Tables/lists: hairline dividers, hover `bg-slate-50`, `tnum`/`font-mono` where numeric/code.
- Keep priority chips/rails from `priorityMeta` (already centralized) — do not hand-roll colors.

- [ ] **Step 2: Verify**

`npm run dev` (as admin) → `/admin/optimization`: rules list/forms styled; create/edit/save still work; priority icons + colors unchanged.

- [ ] **Step 3: Commit**

```bash
git add app/admin/optimization/OptimizationManager.js
git commit -m "redesign: admin rules manager in command-center language"
```

---

## Task 10: Sign-in / Sign-up — Clerk appearance token pass

**Files:**
- Modify: `app/sign-in/[[...sign-in]]/page.js`
- Modify: `app/sign-up/[[...sign-up]]/page.js`

> **Step 0:** read both files first to see how `<SignIn />`/`<SignUp />` are currently wrapped.

Light token pass only: theme the page wrapper + Clerk's primary accent. Use the `appearance` prop with `variables`.

- [ ] **Step 0: Read both auth page files.**

- [ ] **Step 1: Add a marketing header wrapper + `appearance` to each**

Pass this `appearance` to `<SignIn />` / `<SignUp />` (adjust to match the docs version in `node_modules/@clerk`):

```jsx
appearance={{
  variables: {
    colorPrimary: '#1d4ed8',          // blue-700
    fontFamily: 'var(--font-source-sans)',
    borderRadius: '0.5rem',
  },
  elements: {
    card: 'border border-slate-200 shadow-sm',
    headerTitle: 'tracking-tight',
  },
}}
```

Wrap the page in the slate-50 background + a simple centered container; optionally a small logo above the card. Do not deeply restructure Clerk internals.

- [ ] **Step 2: Verify**

`npm run dev` → `/sign-in` and `/sign-up`: Clerk widget shows blue-700 primary, Source Sans font, hairline card; auth still works.

- [ ] **Step 3: Commit**

```bash
git add "app/sign-in/[[...sign-in]]/page.js" "app/sign-up/[[...sign-up]]/page.js"
git commit -m "redesign: sign-in/up Clerk appearance token pass"
```

---

## Task 11: Final pass — a11y, responsive, cleanup

**Files:**
- Possibly small touch-ups across modified files.

- [ ] **Step 1: Accessibility sweep**

Verify (fix inline if any fail): body text never lighter than slate-600; icon-only buttons have `aria-label` (delete/remove already do); visible `focus-visible` rings on buttons/links/inputs/chips; reduced-motion still collapses `animate-rise`.

- [ ] **Step 2: Responsive sweep**

`npm run dev`, check `/`, `/dashboard`, `/deals/<id>`, `/upload`, `/admin/costs`, `/admin/optimization` at 375 / 768 / 1024 / 1440: no horizontal page scroll; tables scroll within their container; header collapses label as designed.

- [ ] **Step 3: Full build + lint**

Run: `npm run lint && npm run build && npm test`
Expected: all clean.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "redesign: a11y + responsive polish across surfaces"
```

- [ ] **Step 5: (Optional) remove throwaway mockups**

The `.planning/mockups/*.html` are throwaway design artifacts and `.planning/` is untracked — leave them, or delete if you prefer a clean tree. Not committed either way.

---

## Self-review notes (planner)
- **Spec coverage:** §2 fonts/tokens → T1; §2.2 status tokens → T2; §3 header/KPI/chips/rows/cards → T3,T5; §4 per-surface (home T4, dashboard T5, deal T6, upload T7, admin costs T8, rules T9, sign-in/up T10); §5 resolved (chips functional T5, IBM Plex Mono T1, Clerk token pass T10); §6 a11y/responsive → T11; §7 constraints (read Next docs) → T1 Step 1, status centralization → T2. All covered.
- **Non-goals honored:** no dark mode, no score meter, no copy changes (T4 explicit), no backend changes.
- **Behavioral change isolated:** only T5 filter chips; it has a real test.
- **Open risk:** T9/T10 files unread at plan time — both start with a mandatory "read first" Step 0.

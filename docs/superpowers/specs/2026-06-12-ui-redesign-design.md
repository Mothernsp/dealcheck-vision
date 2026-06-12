# DealCheck Vision — UI/UX Redesign Design Spec

**Date:** 2026-06-12
**Status:** Awaiting user review
**Scope:** Full visual redesign of all surfaces. No backend/data-model changes.

---

## 1. Goal

Make DealCheck Vision look "cooler, sleeker, and more premium" while staying
unmistakably professional for a legal/compliance audience (BC auto dealers,
F&I compliance). This is an **elevation of an already-tasteful baseline**, not a
rescue. The redesign adopts a **"Command Center"** visual language: sharp,
precise, dense, and tool-like (in the spirit of Linear / Stripe / Vercel
dashboards) rather than marketing-flashy.

Direction chosen after evaluating three throwaway mockups (Refined Evolution,
Bold Modern, Command Center). Locked variant: **Command Center with top-nav
header and the existing product copy** (`.planning/mockups/command-center-topnav.html`).

### Non-goals (YAGNI)
- **No dark mode.** The app stays light-only by deliberate "document review"
  intent (the current `globals.css` comment). One theme, perfected.
- **No new features.** The compliance "score meter" shown in the Bold mockup is
  explicitly **out of scope** — it implies data we may not have. Pure restyle.
- **No backend, schema, routing, or API changes.** Markup/styling only, plus a
  font swap and design-token centralization.
- **No copy rewrite.** Keep all existing product text verbatim.

---

## 2. Design System (foundations)

### 2.1 Typography
Swap Geist → UI Pro's **"Corporate Trust"** pairing (engineered for readability;
recommended for government/finance/accessibility):
- **Headings:** Lexend
- **Body:** Source Sans 3
- **Mono:** **IBM Plex Mono** for VINs/amounts/filenames (retain current
  `font-mono` usage and `.tnum` tabular numerics). Pairs tightly with Lexend.

Loaded via `next/font/google` (self-hosted, no CDN), wired as CSS variables in
`app/layout.js`, exactly as Geist is today.

### 2.2 Color tokens
Trust-blue identity is **kept** (UI Pro flags gold/purple/"AI gradients" as
anti-patterns for this product). Tokens centralized in `globals.css` via
Tailwind v4 `@theme`:

| Role | Value | Notes |
|------|-------|-------|
| Background | `#f8fafc` (slate-50) | unchanged "paper" |
| Surface | `#ffffff` | cards, header |
| Ink | `#0f172a` (slate-900) | primary text |
| Muted ink | `#475569` (slate-600) | secondary text (min for body, per UI Pro) |
| Hairline | `#e2e8f0` (slate-200) | the signature 1px border |
| Primary / accent | `#1d4ed8` (blue-700) | CTAs, active states (unchanged) |
| Pass | `#059669` (emerald-600) | security-green |
| Warn | `#d97706` (amber-600) |  |
| Fail | `#e11d48` (rose-600) |  |

Status palettes stay the single source of truth in `lib/status.js`
(`CHECK_STYLES`, `dealMeta`) and `StatusIcons.js`. **Retoken there, not per-file.**

### 2.3 Shape, border & density (the "Command Center" signature)
- **Hairline 1px borders** (`border border-slate-200`) as the primary separator,
  replacing most soft shadows. Shadows reserved for genuinely floating elements.
- **Tighter radii:** `rounded-lg` (8px) for cards, `rounded-md` (6px) for
  controls. No large `rounded-2xl/3xl`.
- **Denser spacing** for data surfaces (tables, KPI strips); generous spacing
  preserved for marketing/hero.

### 2.4 Motion
- Keep the single restrained `rise` entrance (already in `globals.css`).
- Micro-interactions 150–300ms, `transition-colors`. No layout-shifting hover
  (no scale transforms on cards). Honor `prefers-reduced-motion`.

### 2.5 Iconography
- Keep the existing Heroicons line set and the shared `StatusIcons.js`. No emoji.
- Consistent 24×24 viewBox, sized with `w-4/w-5`.

---

## 3. Component Vocabulary

These are the reusable pieces the redesign standardizes:

1. **App header (authenticated)** — `AppHeader.js`. Top nav, sharpened:
   logo + section tabs **with leading icons** (Deals / Rules / Costs), active tab
   = subtle slate fill (`bg-slate-100`), `⌘K` search affordance, "New deal"
   primary button, Clerk `UserButton`. Sticky, hairline bottom border.
2. **Marketing header** — simpler logo + Sign in / Get started (home, sign-in).
3. **KPI strip** — hairline bordered row with `divide-x` cells (replaces today's
   separate tinted tiles on the dashboard; tinted accent only on the number).
4. **Filter chips** — All / Failing / Needs review / Passed (dashboard). Active
   = `bg-slate-900 text-white`. *(Visual now; wiring to actual filtering is a
   plan decision — see §5.)*
5. **Data table / list row** — dense, hairline-divided, hover `bg-slate-50`,
   `cursor-pointer`, mono VIN + `.tnum`.
6. **Status indicator** — two registers, both from `lib/status.js`:
   - **Pills/stamps** for emphasis (deal overall verdict, hero card).
   - **Inline dot + label** for scannable lists (dashboard rows).
7. **Cards / panels** — hairline, `rounded-lg`, white surface, optional
   uppercase-tracked section header (`Summary`, `Compliance checks`, etc.).
8. **Buttons** — primary `bg-blue-700`, secondary `border border-slate-300 bg-white`,
   `active:translate-y-px`, disabled `opacity-40`. Loading spinner inline.
9. **Banners** — processing (blue, animated ping), failed (rose) — restyle to
   hairline language, keep semantics.
10. **Empty state & dropzone** — keep structure, apply new tokens.

---

## 4. Per-Surface Application

| Surface | File(s) | Changes |
|---------|---------|---------|
| **Home** | `app/page.js` | Marketing header; hero keeps original copy + asymmetric split + live sample report card; "What each audit covers" panel → hairline grid. Sharpen radii/borders/type. |
| **Sign in / up** | `app/sign-in`, `app/sign-up` | Marketing header + Clerk component themed to blue-700/Lexend; centered, hairline framing. |
| **Dashboard** | `app/dashboard/page.js`, `DealList.js` | New `AppHeader`; KPI **strip** (replaces 3 tinted tiles); **filter chips**; rows → command-center density with inline dot+label status; keep delete-confirm + empty state. |
| **Deal view** | `app/deals/[id]/DealView.js` | Header gains "All deals" back-link in app-header style + overall stamp; summary tiles → consistent KPI treatment; checks list, missing-docs, math, files panels → hairline cards; keep polling + in-progress/failed banners. |
| **Upload** | `app/upload/page.js` | Marketing/app header; dropzone + file list + submit restyled to tokens; keep drag/drop + validation behavior. |
| **Admin · Rules** | `app/admin/optimization/OptimizationManager.js` | Apply tokens; priority icons stay (`PRIORITY_ICONS`); tables/forms → hairline + density. |
| **Admin · Costs** | `app/admin/costs/page.js` | KPI cards → strip; raw `<table>` → styled data table (sticky header, `.tnum`, hover); keep 7-day logic. |

Shared `max-w-*` containers: keep per-surface widths (home `6xl`, dashboard/costs
`5xl`, deal `4xl`, upload `2xl`) — they're intentional and we won't homogenize.

---

## 5. Resolved decisions (locked)
- **Filter chips: functional.** Wire to real client-side filtering of the deal
  list (data already on client). Active chip filters rows by status; "All"
  resets. Empty-filter state shows a brief "No deals match" message.
- **Mono font: IBM Plex Mono.** Replaces Geist Mono everywhere `font-mono` is used.
- **Sign-in / up: light token pass.** Theme the surrounding page + Clerk's main
  accent to blue-700/Lexend via `appearance` tokens — not a deep component restyle.

---

## 6. Accessibility & responsiveness (must-pass)
- Contrast ≥ 4.5:1 (body text uses slate-600+, never slate-400).
- Visible focus rings on all interactive elements; tab order matches visual.
- Touch targets ≥ 44px; `cursor-pointer` on all clickable rows/cards.
- Icon-only buttons keep `aria-label` (already present on delete/remove).
- Responsive at 375 / 768 / 1024 / 1440; no horizontal scroll; tables scroll
  within their container, not the page.
- `prefers-reduced-motion` collapses entrance/micro-motion.

---

## 7. Technical approach & constraints
- **Tailwind v4** `@theme` tokens in `app/globals.css` (current setup) — extend,
  don't introduce a config file unless needed.
- **next/font** for Lexend + Source Sans 3, mirroring the current Geist wiring in
  `app/layout.js`.
- **Centralize status tokens** in `lib/status.js` / `StatusIcons.js`.
- **CONSTRAINT (per AGENTS.md):** this is a modified Next.js (16.2.6). Before
  editing fonts/layout/anything framework-level, **read the relevant guide in
  `node_modules/next/dist/docs/`**. The implementation plan must include this as
  its first step.
- Verify visually with the dev server (`npm run dev`) per surface; no snapshot
  infra exists.

---

## 8. Risks
- **Over-sharpening → cold.** Mitigate: keep warmth via type, spacing, the blue
  accent; hairlines not harsh black.
- **Font swap regressions** (line-height/metrics shift). Mitigate: per-surface
  visual check; adjust leading where Lexend/Source Sans differ from Geist.
- **Clerk theming drift** on sign-in/up. Mitigate: scope to `appearance` tokens.
- **Scope creep into features** (score meter, real filtering). Mitigate: §1
  non-goals + §5 explicit decisions.

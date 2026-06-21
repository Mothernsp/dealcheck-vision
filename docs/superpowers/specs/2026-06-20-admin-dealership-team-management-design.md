# Admin Dealership & Team Management — Design

**Date:** 2026-06-20
**Status:** Approved (pending spec review)
**Author:** wearable.startup@gmail.com (with Claude)

## Problem

DealCheck Vision is an invite-only, org-scoped B2B app: every dealership is a
Clerk Organization, and `requireOrg` (lib/auth-context.js) rejects any request
without an active org. Today, onboarding a dealership means leaving the app to
create an organization and send invitations from the Clerk dashboard — tedious
and context-switching for the operator.

This feature moves onboarding into the app: an admin-only page to create a
dealership (organization) and invite its staff by email, plus a management view
of existing dealerships, their members, and pending invitations.

## Goals

- Operator (admin) can create a dealership organization from inside the app.
- Operator can invite staff to a dealership by email (role: `org:member`).
- Operator can see existing dealerships with their members and pending invites,
  and revoke or resend a pending invite.
- Invited staff complete onboarding with **no "create org" wall** — they join
  the existing dealership org via Clerk's invitation ticket flow.

## Non-Goals (YAGNI)

- Per-invite role selection (all invited staff are `org:member`).
- Editing/renaming or deleting organizations.
- Removing existing members.
- Bulk CSV invitations.
- Self-service org management by dealership managers.

## Decisions

- **Scope:** Manage view — create + invite + list (members & pending invites)
  with revoke/resend.
- **Role:** All invited staff are `org:member`. The admin who creates an org is
  `createdBy`, so Clerk makes them that org's `org:admin` automatically. Accepted
  consequence: the admin is a member of every dealership and sees them all in the
  `OrganizationSwitcher`.

## Architecture

Mirrors the existing Optimization admin section (server page → client manager →
admin API routes).

### Routes & files

| File | Purpose |
|------|---------|
| `app/admin/team/page.js` | Server component. Admin-gated. Loads dealerships + members + pending invitations via `clerkClient()`, renders `TeamManager`. |
| `app/admin/team/TeamManager.js` | Client component. Create-dealership form, dealership cards (expandable: members + pending invites with revoke/resend), per-card invite form. Refetches aggregate after each mutation. |
| `app/api/admin/team/route.js` | `GET` aggregate: `{ dealerships: [{ id, name, members[], pendingInvitations[] }] }`. |
| `app/api/admin/team/organizations/route.js` | `POST` create org. |
| `app/api/admin/team/invitations/route.js` | `POST` invite; `DELETE` revoke. |
| `lib/team-validation.js` | Pure helpers `isValidEmail`, `normalizeOrgName`. |
| `lib/team-validation.test.mjs` | `node --test` unit tests for the helpers. |
| `app/AppHeader.js` (edit) | Add admin-only "Dealerships" tab. |

### Clerk server API (confirmed in @clerk/nextjs 7.3.5 / @clerk/backend)

- `const client = await clerkClient()` (async).
- `client.organizations.createOrganization({ name, createdBy: userId })`
- `client.organizations.getOrganizationList({ limit })`
- `client.organizations.getOrganizationMembershipList({ organizationId })`
- `client.organizations.getOrganizationInvitationList({ organizationId, status: ['pending'] })`
- `client.organizations.createOrganizationInvitation({ organizationId, emailAddress, role: 'org:member', inviterUserId: userId, redirectUrl })`
- `client.organizations.revokeOrganizationInvitation({ organizationId, invitationId, requestingUserId })`

All signatures verified against the installed `@clerk/backend` types: `createOrganization`
takes `{ name, createdBy?, slug?, maxAllowedMemberships? }` (only `name` required);
`revokeOrganizationInvitation` takes `{ organizationId, invitationId, requestingUserId? }`.

### Data flow

1. `page.js` (SSR) → `clerkClient()` lists orgs; for each, fetches members +
   pending invitations → passes initial data to `TeamManager`.
2. Mutations (`create org`, `invite`, `revoke`) → admin API routes → `clerkClient()`.
3. On success, `TeamManager` refetches `GET /api/admin/team`.
4. **Resend** = client calls `DELETE` (revoke) then `POST` (invite) for that email.

### Invitation acceptance flow

`redirectUrl` is set to `<request-origin>/dashboard` (origin derived from the
request URL; no new env var). Clerk emails an invitation link carrying a
`__clerk_ticket`. The existing `app/sign-up/[[...sign-up]]/page.js` already
renders `<SignUp>` when a ticket is present, so the invited user sets a password,
joins the dealership org, and lands on `/dashboard` — no create-org step.

## Authorization

- `app/admin/team/page.js` gated by `admin/layout.js` (ADMIN_USER_IDS) + its own
  `isAdminUser` check (defense in depth), matching existing admin pages.
- API routes use the `gate(userId)` pattern (401 if unauthenticated, 403 if not
  admin) + `isAdminUser`.
- These routes intentionally do **not** call `requireOrg`: the operator is
  managing organizations, not acting inside one (same exemption as `/api/admin/*`
  and `/api/test`).
- Mutation routes are rate-limited via `lib/rate-limit.js`.

## Input validation & error handling

- Org name: trim, reject empty, cap length (e.g. 100 chars) via `normalizeOrgName`.
- Email: validate shape via `isValidEmail` before any Clerk call.
- Surface Clerk's actionable errors verbatim (e.g. "already a member",
  "invitation already pending"); log unexpected errors server-side and return a
  generic message. Never return stack traces.
- N+1 Clerk calls in the aggregate GET are acceptable at current scale; cap org
  listing with `limit` (e.g. 100) and note the cap in code.

## Testing

- Unit tests (`lib/team-validation.test.mjs`, `node --test`): `isValidEmail`
  accepts/rejects representative cases; `normalizeOrgName` trims, rejects empty,
  enforces length cap.
- Clerk-backed route handlers stay thin around the SDK calls; verified manually
  via the smoke test (create dealership → invite self at a second email → accept
  link → land in app within that org).

## Rollout / manual steps (unchanged prerequisites)

- Clerk: Organizations enabled; Restrictions → Restricted (invite-only).
- Admin's Clerk user id present in `ADMIN_USER_IDS`.

import { clerkClient } from '@clerk/nextjs/server';

// Server-side helpers for the admin store/team feature. Shared by the server
// pages (initial render) and the GET aggregate route so the shapes stay in one
// place. (Internally a "store" is a Clerk organization.)

const ORG_LIMIT = 100; // cap the store list; revisit if an operator exceeds this
const USER_LIMIT = 200; // cap the user roster; revisit at scale

// List every store (Clerk organization) with its members and pending
// invitations. N+1 calls to Clerk, fine at current scale.
export async function listStores() {
  const client = await clerkClient();
  const { data: orgs } = await client.organizations.getOrganizationList({ limit: ORG_LIMIT });

  return Promise.all(
    orgs.map(async (org) => {
      const [members, invites] = await Promise.all([
        client.organizations.getOrganizationMembershipList({ organizationId: org.id, limit: 100 }),
        client.organizations.getOrganizationInvitationList({
          organizationId: org.id,
          status: ['pending'],
          limit: 100,
        }),
      ]);

      return {
        id: org.id,
        name: org.name,
        members: members.data.map((m) => ({
          id: m.id,
          userId: m.publicUserData?.userId ?? null,
          email: m.publicUserData?.identifier ?? null,
          role: m.role,
        })),
        pendingInvitations: invites.data.map((i) => ({
          id: i.id,
          emailAddress: i.emailAddress,
          status: i.status,
          createdAt: i.createdAt,
        })),
      };
    })
  );
}

// List every user who already has an account, so an admin can add an existing
// person to another store without re-inviting by email.
export async function listUsers() {
  const client = await clerkClient();
  const { data: users } = await client.users.getUserList({ limit: USER_LIMIT });
  return users.map((u) => ({
    id: u.id,
    email: u.primaryEmailAddress?.emailAddress ?? u.emailAddresses?.[0]?.emailAddress ?? null,
    name: [u.firstName, u.lastName].filter(Boolean).join(' ') || null,
  }));
}

// Everything the Stores and Users admin pages need, in one call.
export async function loadTeamData() {
  const [stores, users] = await Promise.all([listStores(), listUsers()]);
  return { stores, users };
}

// Extract a safe, user-actionable message from a Clerk API error (e.g.
// "already a member", "duplicate invitation"). Returns null when there's no
// clean message to surface, so callers fall back to a generic string.
export function clerkErrorMessage(err) {
  const first = err?.errors?.[0];
  const msg = first?.longMessage || first?.message;
  return typeof msg === 'string' && msg.length <= 200 ? msg : null;
}

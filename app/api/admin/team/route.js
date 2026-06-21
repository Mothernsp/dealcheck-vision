import { auth } from '@clerk/nextjs/server';
import { isAdminUser } from '@/lib/admin';
import { loadTeamData } from '@/lib/team';

// Admin-only aggregate read for the Stores and Users pages: every store with its
// members and pending invitations, plus the full user roster. The clients
// refetch this after each mutation. Not org-scoped (the operator manages orgs,
// doesn't act inside one), so it deliberately does NOT use requireOrg.
export const dynamic = 'force-dynamic';

function gate(userId) {
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminUser(userId)) return Response.json({ error: 'Forbidden' }, { status: 403 });
  return null;
}

export async function GET() {
  const { userId } = await auth();
  const denied = gate(userId);
  if (denied) return denied;

  try {
    const { stores, users } = await loadTeamData();
    return Response.json({ stores, users });
  } catch (err) {
    console.error('[admin/team] list failed:', err);
    return Response.json(
      { error: 'Failed to load stores. Is Organizations enabled in Clerk?' },
      { status: 500 }
    );
  }
}

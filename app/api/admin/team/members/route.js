import { auth, clerkClient } from '@clerk/nextjs/server';
import { isAdminUser } from '@/lib/admin';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { clerkErrorMessage } from '@/lib/team';

// Admin-only: add an EXISTING user (someone who already has an account) to a
// store as org:member — no email round-trip. Used by the per-store picker and
// the Users tab. Inviting a brand-new person by email still goes through
// /api/admin/team/invitations.
function gate(userId) {
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminUser(userId)) return Response.json({ error: 'Forbidden' }, { status: 403 });
  return null;
}

export async function POST(request) {
  const { userId } = await auth();
  const denied = gate(userId);
  if (denied) return denied;

  const limit = rateLimit(`team-member:${userId}`, { limit: 40, windowMs: 60_000 });
  if (!limit.ok) return tooManyRequests(limit);

  const body = await request.json().catch(() => ({}));
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId : '';
  const targetUserId = typeof body.userId === 'string' ? body.userId : '';
  if (!organizationId || !targetUserId) {
    return Response.json({ error: 'organizationId and userId are required' }, { status: 400 });
  }

  try {
    const client = await clerkClient();
    await client.organizations.createOrganizationMembership({
      organizationId,
      userId: targetUserId,
      role: 'org:member',
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error('[admin/team] add member failed:', err);
    return Response.json(
      { error: clerkErrorMessage(err) || 'Failed to add user to store' },
      { status: 400 }
    );
  }
}

// Remove a user from a store. Clerk rejects removing the last admin of an org;
// that error is surfaced verbatim so the operator knows why.
export async function DELETE(request) {
  const { userId } = await auth();
  const denied = gate(userId);
  if (denied) return denied;

  const limit = rateLimit(`team-member:${userId}`, { limit: 40, windowMs: 60_000 });
  if (!limit.ok) return tooManyRequests(limit);

  const body = await request.json().catch(() => ({}));
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId : '';
  const targetUserId = typeof body.userId === 'string' ? body.userId : '';
  if (!organizationId || !targetUserId) {
    return Response.json({ error: 'organizationId and userId are required' }, { status: 400 });
  }

  try {
    const client = await clerkClient();
    await client.organizations.deleteOrganizationMembership({
      organizationId,
      userId: targetUserId,
    });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[admin/team] remove member failed:', err);
    return Response.json(
      { error: clerkErrorMessage(err) || 'Failed to remove user from store' },
      { status: 400 }
    );
  }
}

import { auth, clerkClient } from '@clerk/nextjs/server';
import { isAdminUser } from '@/lib/admin';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { isValidEmail } from '@/lib/team-validation';
import { clerkErrorMessage } from '@/lib/team';

// Admin-only: invite a staffer to a dealership (POST) or revoke a pending
// invitation (DELETE). Invited staff always get the org:member role. The invite
// email carries Clerk's ticket; the existing /sign-up page completes the join
// and the user lands on /dashboard. "Resend" is handled client-side as a revoke
// followed by a fresh invite, so there is no separate endpoint.
function gate(userId) {
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminUser(userId)) return Response.json({ error: 'Forbidden' }, { status: 403 });
  return null;
}

export async function POST(request) {
  const { userId } = await auth();
  const denied = gate(userId);
  if (denied) return denied;

  const limit = rateLimit(`team-invite:${userId}`, { limit: 30, windowMs: 60_000 });
  if (!limit.ok) return tooManyRequests(limit);

  const body = await request.json().catch(() => ({}));
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId : '';
  const emailAddress = typeof body.emailAddress === 'string' ? body.emailAddress.trim() : '';
  if (!organizationId) return Response.json({ error: 'organizationId is required' }, { status: 400 });
  if (!isValidEmail(emailAddress)) {
    return Response.json({ error: 'A valid email is required' }, { status: 400 });
  }

  const origin = new URL(request.url).origin;

  try {
    const client = await clerkClient();
    const inv = await client.organizations.createOrganizationInvitation({
      organizationId,
      emailAddress,
      role: 'org:member',
      inviterUserId: userId,
      redirectUrl: `${origin}/dashboard`,
    });
    return Response.json(
      { invitation: { id: inv.id, emailAddress: inv.emailAddress, status: inv.status } },
      { status: 201 }
    );
  } catch (err) {
    console.error('[admin/team] invite failed:', err);
    return Response.json(
      { error: clerkErrorMessage(err) || 'Failed to send invitation' },
      { status: 400 }
    );
  }
}

export async function DELETE(request) {
  const { userId } = await auth();
  const denied = gate(userId);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId : '';
  const invitationId = typeof body.invitationId === 'string' ? body.invitationId : '';
  if (!organizationId || !invitationId) {
    return Response.json({ error: 'organizationId and invitationId are required' }, { status: 400 });
  }

  try {
    const client = await clerkClient();
    await client.organizations.revokeOrganizationInvitation({
      organizationId,
      invitationId,
      requestingUserId: userId,
    });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[admin/team] revoke failed:', err);
    return Response.json(
      { error: clerkErrorMessage(err) || 'Failed to revoke invitation' },
      { status: 400 }
    );
  }
}

import { auth, clerkClient } from '@clerk/nextjs/server';
import { isAdminUser } from '@/lib/admin';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { normalizeOrgName } from '@/lib/team-validation';
import { clerkErrorMessage } from '@/lib/team';

// Admin-only: create a dealership (Clerk organization). The creating admin is
// set as `createdBy`, so Clerk makes them the org's org:admin automatically.
function gate(userId) {
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminUser(userId)) return Response.json({ error: 'Forbidden' }, { status: 403 });
  return null;
}

export async function POST(request) {
  const { userId } = await auth();
  const denied = gate(userId);
  if (denied) return denied;

  const limit = rateLimit(`team-org:${userId}`, { limit: 20, windowMs: 60_000 });
  if (!limit.ok) return tooManyRequests(limit);

  const body = await request.json().catch(() => ({}));
  const name = normalizeOrgName(body.name);
  if (!name) return Response.json({ error: 'Dealership name is required' }, { status: 400 });

  try {
    const client = await clerkClient();
    const org = await client.organizations.createOrganization({ name, createdBy: userId });
    return Response.json({ organization: { id: org.id, name: org.name } }, { status: 201 });
  } catch (err) {
    console.error('[admin/team] create org failed:', err);
    return Response.json(
      { error: clerkErrorMessage(err) || 'Failed to create dealership' },
      { status: 400 }
    );
  }
}

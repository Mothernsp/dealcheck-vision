import { auth } from '@clerk/nextjs/server';

// Resolve the org context for a request.
//
// This is a B2B app where every dealership is a Clerk Organization and all data
// is org-scoped, so an ACTIVE organization is required. We deliberately do NOT
// fall back to personal (userId) scope: that fallback silently placed a user's
// deals outside their dealership's tenant boundary, blurring the isolation line.
// Requiring an org makes the boundary explicit and mandatory.
//
// Returns { userId, orgId } on success, or { error } holding a ready-to-return
// Response for the unauthenticated (401) or no-active-org (403) cases. Use it as:
//
//   const { userId, orgId, error } = await requireOrg();
//   if (error) return error;
//
// Admin/diagnostic routes that operate outside any single org (e.g. /api/admin/*,
// /api/test) should keep using auth() + isAdminUser() directly — they must NOT
// require an active org.
export async function requireOrg() {
  const { userId, orgId } = await auth();
  if (!userId) {
    return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!orgId) {
    return {
      error: Response.json(
        {
          error:
            'No active store selected. Select or create your store to continue.',
        },
        { status: 403 }
      ),
    };
  }
  return { userId, orgId };
}

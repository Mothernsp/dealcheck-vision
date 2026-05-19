import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { processDeal } from '@/lib/process-deal';

// Runs the full pipeline synchronously for a deal that is stuck in
// 'uploaded' or 'failed' status. Errors surface directly in the HTTP
// response instead of being swallowed by after().
export const maxDuration = 300;

export async function POST(request, { params }) {
  const { userId, orgId: clerkOrgId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: dealId } = await params;
  const sb = supabaseAdmin();

  const { data: deal, error: fetchErr } = await sb
    .from('deals')
    .select('id, org_id, status')
    .eq('id', dealId)
    .single();

  if (fetchErr || !deal) {
    return Response.json({ error: 'Deal not found' }, { status: 404 });
  }

  // Only allow re-running deals owned by this user's org
  const orgId = clerkOrgId || userId;
  if (deal.org_id !== orgId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await processDeal(dealId, deal.org_id);
    return Response.json({ ok: true, result });
  } catch (err) {
    return Response.json(
      { ok: false, error: err.message, stack: err.stack },
      { status: 500 }
    );
  }
}

import { supabaseAdmin } from '@/lib/supabase';
import { processDeal } from '@/lib/process-deal';
import { isUuid } from '@/lib/validate';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { requireOrg } from '@/lib/auth-context';

// Runs the full pipeline synchronously for a deal that is stuck in
// 'uploaded' or 'failed' status. Errors surface directly in the HTTP
// response instead of being swallowed by after().
export const maxDuration = 300;

export async function POST(request, { params }) {
  const { userId, orgId, error: authError } = await requireOrg();
  if (authError) return authError;

  // Re-running invokes the full Claude pipeline; throttle it hard.
  const limit = rateLimit(`run:${userId}`, { limit: 10, windowMs: 60_000 });
  if (!limit.ok) return tooManyRequests(limit);

  const { id: dealId } = await params;
  if (!isUuid(dealId)) {
    return Response.json({ error: 'Invalid deal id' }, { status: 400 });
  }
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
  if (deal.org_id !== orgId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await processDeal(dealId, deal.org_id);
    return Response.json({ ok: true, result });
  } catch (err) {
    // Log the full error server-side; never leak stack traces / internal
    // paths to the client.
    console.error(`[run] deal ${dealId} failed:`, err);
    return Response.json(
      { ok: false, error: 'Processing failed. Please try again.' },
      { status: 500 }
    );
  }
}

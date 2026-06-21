import { after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { processDeal } from '@/lib/process-deal';
import { isUuid } from '@/lib/validate';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { requireOrg } from '@/lib/auth-context';

export const maxDuration = 300;

export async function POST(request) {
  const { userId, orgId, error: authError } = await requireOrg();
  if (authError) return authError;

  // Each check kicks off the Claude pipeline; throttle per user.
  const limit = rateLimit(`check:${userId}`, { limit: 20, windowMs: 60_000 });
  if (!limit.ok) return tooManyRequests(limit);

  const { dealId } = await request.json().catch(() => ({}));
  if (!isUuid(dealId)) return Response.json({ error: 'Valid dealId required' }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: deal, error } = await sb
    .from('deals')
    .select('id')
    .eq('id', dealId)
    .eq('org_id', orgId)
    .single();

  if (error || !deal) return Response.json({ error: 'Deal not found' }, { status: 404 });

  after(() => processDeal(dealId, orgId));

  return Response.json({ ok: true });
}

import { after } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { processDeal } from '@/lib/process-deal';

export const maxDuration = 300;

export async function POST(request) {
  const { userId, orgId: clerkOrgId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = clerkOrgId || userId;
  const { dealId } = await request.json();
  if (!dealId) return Response.json({ error: 'dealId required' }, { status: 400 });

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

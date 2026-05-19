import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(_request, { params }) {
  const { userId, orgId: clerkOrgId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = clerkOrgId || userId;
  const { id } = await params;

  const sb = supabaseAdmin();
  const { data: deal, error: dbError } = await sb
    .from('deals')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (dbError) {
    console.error('[api/deals] supabase error:', dbError.message);
    return Response.json({ error: dbError.message }, { status: 500 });
  }
  if (!deal) return Response.json({ error: 'Deal not found' }, { status: 404 });

  return Response.json(deal);
}

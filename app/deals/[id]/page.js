import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import DealView from './DealView';

export const dynamic = 'force-dynamic';

export default async function DealPage({ params }) {
  const { id } = await params;
  const { userId, orgId: clerkOrgId } = await auth();
  const orgId = clerkOrgId || userId;

  const sb = supabaseAdmin();
  const { data: deal } = await sb
    .from('deals')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (!deal) notFound();

  return <DealView initialDeal={deal} />;
}

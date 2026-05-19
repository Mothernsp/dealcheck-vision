import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  const { userId, orgId: clerkOrgId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const orgId = clerkOrgId || userId;

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('deals')
    .select('id, status, customer_name, vehicle_info, created_at, report')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const deals = data.map((d) => ({
    id: d.id,
    status: d.status,
    customer_name: d.customer_name,
    vehicle_info: d.vehicle_info,
    created_at: d.created_at,
    overall_status: d.report?.overall_status || null,
  }));

  return NextResponse.json({ deals });
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireOrg } from '@/lib/auth-context';

export const runtime = 'nodejs';

export async function GET() {
  const { orgId, error: authError } = await requireOrg();
  if (authError) return authError;

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('deals')
    .select('id, status, customer_name, vehicle_info, created_at, report')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[api/deals] supabase error:', error.message);
    return NextResponse.json({ error: 'Failed to load deals' }, { status: 500 });
  }

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

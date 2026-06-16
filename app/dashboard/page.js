import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminUser } from '@/lib/admin';
import AppHeader from '@/app/AppHeader';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const { userId, orgId: clerkOrgId } = await auth();
  const orgId = clerkOrgId || userId;
  const isAdmin = isAdminUser(userId);
  const sb = supabaseAdmin();
  const { data } = await sb
    .from('deals')
    .select('id, status, customer_name, vehicle_info, created_at, report')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  // Lean shape for the client: the verdict plus only the fields the KPI panels
  // aggregate (missing documents + failure reasons), never the whole report jsonb.
  const deals = (data || []).map((d) => ({
    id: d.id,
    status: d.status,
    customer_name: d.customer_name,
    vehicle_info: d.vehicle_info,
    created_at: d.created_at,
    overall_status: d.report?.overall_status || null,
    missing_documents: d.report?.missing_documents ?? [],
    failed_reasons: (d.report?.checks ?? []).filter((c) => c.status === 'fail').map((c) => c.title),
  }));

  return (
    <div className="min-h-full flex flex-col bg-slate-50">
      <AppHeader isAdmin={isAdmin} />

      <main className="max-w-5xl w-full mx-auto px-6 sm:px-8 py-8">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Deals</h1>
        </div>

        <DashboardClient initialDeals={deals} />
      </main>
    </div>
  );
}

import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminUser } from '@/lib/admin';
import OptimizationManager from './OptimizationManager';

// Admin-only Optimization tab: manage the extra compliance items the model checks
// on every deal. Items are stored in compliance_settings and injected into the
// compliance system prompt at run time (lib/compliance-settings.mjs).
export const dynamic = 'force-dynamic';

export default async function OptimizationPage() {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-semibold">Forbidden</h1>
        <p className="mt-2 text-sm text-slate-500">Admin access required.</p>
      </main>
    );
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('compliance_settings')
    .select('id, instruction, priority, enabled, created_at, updated_at')
    .order('created_at', { ascending: true });

  if (error) {
    return (
      <main className="mx-auto max-w-5xl w-full px-6 sm:px-8 py-8">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Compliance rules</h1>
        <p className="mt-2 text-sm text-rose-600">Could not load compliance rules: {error.message}</p>
        <p className="mt-2 text-sm text-slate-500">
          Has the <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">compliance_settings</code> migration been applied?
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl w-full px-6 sm:px-8 py-8">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Compliance rules</h1>
      <p className="mt-1 text-sm text-slate-500 max-w-[68ch]">
        Extra checks the AI runs on every deal. Each rule is injected into the model&apos;s
        instructions on the next run; priority sets how a violation is scored.
      </p>
      <OptimizationManager initialItems={data || []} />
    </main>
  );
}

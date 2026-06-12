import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminUser } from '@/lib/admin';
import { isValidPriority } from '@/lib/compliance-settings.mjs';

// Admin-only CRUD for the compliance directives shown in the Optimization tab.
// Each row is injected into the compliance model's system prompt at run time.
//
//   GET  /api/admin/optimization        → list all items (incl. disabled)
//   POST /api/admin/optimization        → create { instruction, priority }

function gate(userId) {
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminUser(userId)) return Response.json({ error: 'Forbidden' }, { status: 403 });
  return null;
}

export async function GET() {
  const { userId } = await auth();
  const denied = gate(userId);
  if (denied) return denied;

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('compliance_settings')
    .select('id, instruction, priority, enabled, created_at, updated_at')
    .order('created_at', { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ items: data || [] });
}

export async function POST(request) {
  const { userId } = await auth();
  const denied = gate(userId);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : '';
  const priority = body.priority;
  if (!instruction) return Response.json({ error: 'instruction is required' }, { status: 400 });
  if (!isValidPriority(priority)) return Response.json({ error: 'invalid priority' }, { status: 400 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('compliance_settings')
    .insert({ instruction, priority, created_by: userId })
    .select('id, instruction, priority, enabled, created_at, updated_at')
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ item: data }, { status: 201 });
}

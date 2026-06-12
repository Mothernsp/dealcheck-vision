import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminUser } from '@/lib/admin';
import { isValidPriority } from '@/lib/compliance-settings.mjs';

// Admin-only edit/delete for a single compliance directive.
//
//   PATCH  /api/admin/optimization/:id  → update { instruction?, priority?, enabled? }
//   DELETE /api/admin/optimization/:id  → remove

function gate(userId) {
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminUser(userId)) return Response.json({ error: 'Forbidden' }, { status: 403 });
  return null;
}

export async function PATCH(request, { params }) {
  const { userId } = await auth();
  const denied = gate(userId);
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const patch = { updated_at: new Date().toISOString() };
  if (body.instruction !== undefined) {
    const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : '';
    if (!instruction) return Response.json({ error: 'instruction cannot be empty' }, { status: 400 });
    patch.instruction = instruction;
  }
  if (body.priority !== undefined) {
    if (!isValidPriority(body.priority)) return Response.json({ error: 'invalid priority' }, { status: 400 });
    patch.priority = body.priority;
  }
  if (body.enabled !== undefined) {
    patch.enabled = Boolean(body.enabled);
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('compliance_settings')
    .update(patch)
    .eq('id', id)
    .select('id, instruction, priority, enabled, created_at, updated_at')
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: 'Not found' }, { status: 404 });

  return Response.json({ item: data });
}

export async function DELETE(_request, { params }) {
  const { userId } = await auth();
  const denied = gate(userId);
  if (denied) return denied;

  const { id } = await params;
  const sb = supabaseAdmin();
  const { error } = await sb.from('compliance_settings').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ deleted: id });
}

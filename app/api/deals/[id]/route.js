import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin, BUCKET } from '@/lib/supabase';

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

// Hard-delete a deal: storage files, cost rows, then the row itself.
// Scoped to the caller's org so a deal can never be deleted across tenants.
export async function DELETE(_request, { params }) {
  const { userId, orgId: clerkOrgId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = clerkOrgId || userId;
  const { id } = await params;

  const sb = supabaseAdmin();

  // Confirm ownership before touching anything.
  const { data: deal, error: lookupErr } = await sb
    .from('deals')
    .select('id, files')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (lookupErr || !deal) {
    return Response.json({ error: 'Deal not found' }, { status: 404 });
  }

  // Remove every stored file under this deal's folder. List the folder so we
  // catch files even if the `files` jsonb is incomplete, and fall back to the
  // recorded storage paths.
  const folder = `${orgId}/${id}`;
  const { data: listed } = await sb.storage.from(BUCKET).list(folder);
  const paths = listed?.length
    ? listed.map((f) => `${folder}/${f.name}`)
    : (deal.files || []).map((f) => f.storage_path).filter(Boolean);

  if (paths.length > 0) {
    const { error: removeErr } = await sb.storage.from(BUCKET).remove(paths);
    if (removeErr) {
      console.error('[api/deals DELETE] storage remove error:', removeErr.message);
      return Response.json({ error: 'Failed to delete files' }, { status: 500 });
    }
  }

  // Cost rows reference the deal; clear them so nothing is orphaned.
  await sb.from('deal_costs').delete().eq('deal_id', id);

  const { error: delErr } = await sb
    .from('deals')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId);

  if (delErr) {
    console.error('[api/deals DELETE] supabase error:', delErr.message);
    return Response.json({ error: delErr.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}

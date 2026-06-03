import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';

// Admin-only: clear a cached deal-set result so the next upload of that file set
// re-runs the Opus pipeline. Use this if a cache entry holds bad output.
//
// Gated by Clerk auth + an allowlist of admin Clerk user IDs in env:
//   ADMIN_USER_IDS=user_abc123,user_def456
// If ADMIN_USER_IDS is unset, every request is denied (safe default).
//
//   DELETE /api/admin/cache?deal_set_hash=<hash>

function isAdmin(userId) {
  const allow = (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return allow.includes(userId);
}

export async function DELETE(request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(userId)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const dealSetHash = searchParams.get('deal_set_hash');
  if (!dealSetHash) {
    return Response.json({ error: 'deal_set_hash query param required' }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { error } = await sb
    .from('classification_cache')
    .delete()
    .eq('deal_set_hash', dealSetHash);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ cleared: dealSetHash });
}

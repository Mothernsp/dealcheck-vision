import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin, BUCKET } from '@/lib/supabase';
import { isAdminUser } from '@/lib/admin';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 30;

// Admin-only diagnostics.
//
// This endpoint previously leaked backend recon to ANY signed-in user: the
// Anthropic key prefix, env var names, which AWS creds were set, Supabase row
// counts / schema columns / bucket name, plus a billed Claude call on every
// request (loopable to drain budget). It is now (1) admin-gated, (2) reduced to
// boolean connectivity/presence signals — never secret material, env names, or
// raw error strings — and (3) the billed round-trip is opt-in via ?live=1 and
// rate-limited.
export async function GET(request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminUser(userId)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const limit = rateLimit(`test:${userId}`, { limit: 10, windowMs: 60_000 });
  if (!limit.ok) return tooManyRequests(limit);

  const { searchParams } = new URL(request.url);
  const live = searchParams.get('live') === '1';

  const results = {};

  // Supabase connectivity — boolean only.
  try {
    const sb = supabaseAdmin();
    const { error } = await sb.from('deals').select('id').limit(1);
    results.supabase = { ok: !error };
  } catch {
    results.supabase = { ok: false };
  }

  // Storage connectivity — boolean only.
  try {
    const sb = supabaseAdmin();
    const { error } = await sb.storage.from(BUCKET).list('', { limit: 1 });
    results.storage = { ok: !error };
  } catch {
    results.storage = { ok: false };
  }

  // Required config present — booleans only, never values/prefixes/names.
  results.config = {
    anthropic_key: Boolean(process.env.ANTHROPIC_API_KEY),
    supabase_service_key: Boolean(process.env.SUPABASE_SERVICE_KEY),
    clerk_secret: Boolean(process.env.CLERK_SECRET_KEY),
  };

  // Billed Anthropic round-trip only when an admin explicitly opts in.
  if (live) {
    try {
      const client = new Anthropic();
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Reply with just: ok' }],
      });
      results.anthropic = { ok: Boolean(msg.content?.[0]?.text) };
    } catch {
      results.anthropic = { ok: false };
    }
  }

  const allOk =
    results.supabase.ok && results.storage.ok && (!live || results.anthropic?.ok);
  return Response.json({ allOk, results }, { status: allOk ? 200 : 500 });
}

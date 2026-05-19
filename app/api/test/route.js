import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin, BUCKET } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 30;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const results = {};

  // ── 1. Supabase connection ────────────────────────────────────────────────
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.from('deals').select('id').limit(1);
    if (error) throw error;
    results.supabase = { ok: true, note: `connected, ${data.length} row(s) returned` };
  } catch (err) {
    results.supabase = { ok: false, error: err.message };
  }

  // ── 2. Supabase schema — check which columns exist on deals ───────────────
  try {
    const sb = supabaseAdmin();
    const probeColumns = ['files', 'error', 'updated_at'];
    const colResults = {};
    for (const col of probeColumns) {
      const { error: colErr } = await sb
        .from('deals')
        .select(col)
        .limit(0);
      colResults[col] = colErr
        ? { exists: false, detail: colErr.message }
        : { exists: true };
    }
    results.schema = { ok: true, columns: colResults };
  } catch (err) {
    results.schema = { ok: false, error: err.message };
  }

  // ── 3. Supabase storage — list bucket ─────────────────────────────────────
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.storage.from(BUCKET).list('', { limit: 1 });
    if (error) throw error;
    results.storage = { ok: true, bucket: BUCKET };
  } catch (err) {
    results.storage = { ok: false, error: err.message };
  }

  // ── 4. Anthropic API ──────────────────────────────────────────────────────
  try {
    const key = process.env.ANTHROPIC_API_KEY;
    // Search for any env key containing ANTHRO (catches typos / encoding variants)
    const anthropicLike = Object.keys(process.env).filter((k) =>
      k.toUpperCase().includes('ANTHRO')
    );
    results.anthropic_env = {
      key_present: !!key,
      key_prefix: key ? key.slice(0, 10) + '...' : null,
      matching_env_keys: anthropicLike,
    };

    const client = new Anthropic();
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Reply with just: ok' }],
    });
    results.anthropic = {
      ok: true,
      response: msg.content?.[0]?.text || '(empty)',
    };
  } catch (err) {
    results.anthropic = { ok: false, error: err.message };
  }

  // ── 5. AWS env vars present ───────────────────────────────────────────────
  results.aws_env = {
    AWS_REGION: !!process.env.AWS_REGION,
    AWS_ACCESS_KEY_ID: !!process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: !!process.env.AWS_SECRET_ACCESS_KEY,
    AWS_S3_BUCKET: !!process.env.AWS_S3_BUCKET,
  };

  const allOk = results.supabase.ok && results.anthropic.ok && results.storage.ok;
  return Response.json({ allOk, results }, { status: allOk ? 200 : 500 });
}

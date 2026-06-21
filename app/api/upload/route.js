import { v4 as uuid } from 'uuid';
import { supabaseAdmin, BUCKET } from '@/lib/supabase';
import {
  validateFile,
  MAX_FILES,
  MAX_TOTAL_BYTES,
} from '@/lib/file-validation';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { requireOrg } from '@/lib/auth-context';

export const maxDuration = 300;

export async function POST(request) {
  const { userId, orgId, error: authError } = await requireOrg();
  if (authError) return authError;

  // Cap deal creation per user: the pipeline is expensive, so stop bursts.
  const limit = rateLimit(`upload:${userId}`, { limit: 20, windowMs: 60_000 });
  if (!limit.ok) return tooManyRequests(limit);

  const dealId = uuid();

  const formData = await request.formData();
  const files = formData.getAll('files');

  if (!files || files.length === 0) {
    return Response.json({ error: 'No files provided' }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return Response.json(
      { error: `Too many files (max ${MAX_FILES} per deal).` },
      { status: 400 }
    );
  }

  // Buffer + validate every file BEFORE creating the deal row, so a rejected
  // upload never leaves a half-written deal or any bytes in storage.
  const validated = [];
  let totalBytes = 0;
  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    totalBytes += bytes.length;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return Response.json(
        { error: 'Upload too large.' },
        { status: 413 }
      );
    }
    const check = validateFile(file.name, bytes);
    if (!check.ok) {
      return Response.json(
        { error: `Rejected "${file.name}": ${check.reason}` },
        { status: 400 }
      );
    }
    validated.push({ bytes, mime: check.mime, safeName: check.safeName });
  }

  const sb = supabaseAdmin();

  // Insert with 'uploading' first so Realtime doesn't fire until files are ready.
  const { error: insertErr } = await sb.from('deals').insert({
    id: dealId,
    org_id: orgId,
    created_by: userId,
    status: 'uploading',
    created_at: new Date().toISOString(),
  });
  if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 });

  for (const file of validated) {
    const storagePath = `${orgId}/${dealId}/${uuid()}-${file.safeName}`;
    const { error: uploadErr } = await sb.storage
      .from(BUCKET)
      .upload(storagePath, file.bytes, { contentType: file.mime });
    if (uploadErr) return Response.json({ error: uploadErr.message }, { status: 500 });
  }

  // Now all files are in storage — flip to 'uploaded' to trigger the local daemon.
  const { error: updateErr } = await sb.from('deals')
    .update({ status: 'uploaded' })
    .eq('id', dealId);
  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 });

  return Response.json({ dealId });
}

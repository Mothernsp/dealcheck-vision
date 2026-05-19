import { after } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { v4 as uuid } from 'uuid';
import { supabaseAdmin, BUCKET } from '@/lib/supabase';
import { processDeal } from '@/lib/process-deal';

export const maxDuration = 300;

export async function POST(request) {
  const { userId, orgId: clerkOrgId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = clerkOrgId || userId;
  const dealId = uuid();

  const formData = await request.formData();
  const files = formData.getAll('files');

  if (!files || files.length === 0) {
    return Response.json({ error: 'No files provided' }, { status: 400 });
  }

  const sb = supabaseAdmin();

  const { error: insertErr } = await sb.from('deals').insert({
    id: dealId,
    org_id: orgId,
    created_by: userId,
    status: 'uploaded',
    created_at: new Date().toISOString(),
  });
  if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 });

  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const storagePath = `${orgId}/${dealId}/${uuid()}-${file.name}`;
    const { error: uploadErr } = await sb.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: file.type });
    if (uploadErr) return Response.json({ error: uploadErr.message }, { status: 500 });
  }

  after(() => processDeal(dealId, orgId));

  return Response.json({ dealId });
}

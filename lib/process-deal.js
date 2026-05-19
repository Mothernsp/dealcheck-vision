import { supabaseAdmin, BUCKET } from '@/lib/supabase';
import { classifyDocument, runComplianceCheck, mimeFromFilename } from '@/lib/vision';

export async function processDeal(dealId, orgId) {
  const sb = supabaseAdmin();

  const { error: processingErr } = await sb
    .from('deals')
    .update({ status: 'processing' })
    .eq('id', dealId);
  if (processingErr) throw new Error(`status update failed: ${processingErr.message}`);

  try {
    const prefix = `${orgId}/${dealId}`;
    const { data: storageList, error: listErr } = await sb.storage
      .from(BUCKET)
      .list(prefix);
    if (listErr) throw new Error(listErr.message);
    if (!storageList || storageList.length === 0) {
      throw new Error('no files in storage for deal');
    }

    // Download + classify all files in parallel via Claude Vision — no Textract
    const perFile = await Promise.all(
      storageList.map(async (entry) => {
        const storagePath = `${prefix}/${entry.name}`;
        const originalName = entry.name.replace(/^[0-9a-f-]{36}-/, '');

        const { data: blob, error: dlErr } = await sb.storage
          .from(BUCKET)
          .download(storagePath);
        if (dlErr) throw new Error(`download failed for ${originalName}: ${dlErr.message}`);

        const bytes = Buffer.from(await blob.arrayBuffer());
        const extracted = await classifyDocument(bytes, originalName);

        // TEMP: dump Claude's classification so we can spot wrong guesses.
        // Remove once accuracy is good.
        console.log(
          `\n========== VISION DUMP: ${originalName} ==========\n` +
            `--- CLAUDE GUESSED ---\n${JSON.stringify(extracted, null, 2)}\n` +
            `========== END DUMP ==========\n`
        );

        return {
          filename: originalName,
          storage_path: storagePath,
          mime_type: mimeFromFilename(originalName),
          doc_type: extracted.doc_type || null,
          signed_by_customer: extracted.signed_by_customer ?? false,
          signed_by_dealer: extracted.signed_by_dealer ?? false,
          fields: extracted.fields || null,
        };
      })
    );

    const report = await runComplianceCheck(perFile);

    const { error: updateErr } = await sb
      .from('deals')
      .update({
        status: 'completed',
        report,
        files: perFile,
        customer_name: report.customer_name || null,
        vehicle_info: report.vehicle_info || null,
      })
      .eq('id', dealId);
    if (updateErr) throw new Error(`final update failed: ${updateErr.message}`);

    return { report, files: perFile };
  } catch (err) {
    await sb
      .from('deals')
      .update({
        status: 'failed',
        error: String(err?.message || err),
      })
      .eq('id', dealId);
    throw err;
  }
}

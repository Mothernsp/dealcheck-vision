import { supabaseAdmin, BUCKET } from '@/lib/supabase';
import { classifyAllDocuments, runComplianceCheck, mimeFromFilename } from '@/lib/vision';

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

    // Step 1: download all files in parallel (network I/O only, no API calls).
    const downloaded = await Promise.all(
      storageList.map(async (entry) => {
        const storagePath = `${prefix}/${entry.name}`;
        const originalName = entry.name.replace(/^[0-9a-f-]{36}-/, '');

        const { data: blob, error: dlErr } = await sb.storage
          .from(BUCKET)
          .download(storagePath);
        if (dlErr) throw new Error(`download failed for ${originalName}: ${dlErr.message}`);

        const bytes = Buffer.from(await blob.arrayBuffer());
        return { originalName, storagePath, bytes };
      })
    );

    // Step 2: classify all documents in ONE Claude Vision call.
    // This gives Claude full deal-jacket context (CARFAX VIN ↔ BOS VIN matching,
    // cross-document discrepancy detection, etc.) and eliminates parallel rate-limit
    // failures that occurred when each file was its own API call.
    const extractions = await classifyAllDocuments(
      downloaded.map((f) => ({ bytes: f.bytes, filename: f.originalName }))
    );

    // TEMP: dump Claude's classifications so we can spot wrong guesses.
    // Remove once accuracy is good.
    console.log('\n========== VISION DUMP ==========');
    for (const ext of extractions) {
      console.log(`\n--- ${ext.filename} ---\n${JSON.stringify(ext, null, 2)}`);
    }
    console.log('========== END DUMP ==========\n');

    // Step 3: merge download metadata with extracted data.
    const perFile = downloaded.map((f) => {
      const ext = extractions.find((e) => e.filename === f.originalName) || {};
      return {
        filename: f.originalName,
        storage_path: f.storagePath,
        mime_type: mimeFromFilename(f.originalName),
        doc_type: ext.doc_type || null,
        signed_by_customer: ext.signed_by_customer ?? false,
        signed_by_dealer: ext.signed_by_dealer ?? false,
        fields: ext.fields || null,
      };
    });

    // Step 4: compliance check (receives extracted JSON, not raw documents).
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

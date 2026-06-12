import { supabaseAdmin, BUCKET } from '@/lib/supabase';
import { classifyAllDocuments, runComplianceCheck, mimeFromFilename } from '@/lib/vision';
import { getComplianceDirective } from '@/lib/compliance-settings.mjs';

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

    // Step 3: build perFile from extractions.
    // extractions may have MORE entries than downloaded files — a single
    // multi-page PDF scan can contain several distinct documents, each
    // returned as a separate object by the classifier.
    const storageByName = Object.fromEntries(
      downloaded.map((f) => [f.originalName, f])
    );

    const perFile = extractions.map((ext) => {
      const src = storageByName[ext.source_file] || downloaded[0];
      return {
        filename: ext.filename,
        source_file: ext.source_file,
        storage_path: src?.storagePath || null,
        mime_type: mimeFromFilename(src?.originalName || ''),
        doc_type: ext.doc_type || null,
        signed_by_customer: ext.signed_by_customer ?? false,
        signed_by_dealer: ext.signed_by_dealer ?? false,
        fields: ext.fields || null,
      };
    });

    // Step 4: compliance check (receives extracted JSON, not raw documents).
    // Admin-authored directives are folded into the system prompt at run time.
    const overrides = await getComplianceDirective(sb);
    const report = await runComplianceCheck(perFile, { overrides });

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

// Anthropic Message Batches helpers. The client is injected so these are unit
// testable with a mock (no real API calls).

// Submit a batch of { custom_id, params } requests; returns the batch id.
export async function submitBatch(client, requests) {
  const batch = await client.messages.batches.create({ requests });
  return batch.id;
}

// Poll a batch until it ends or the deadline passes.
// Returns { status: 'ended' } or { status: 'timeout' }.
export async function pollBatchUntilDone(client, batchId, {
  maxWaitMs,
  intervalMs = 30_000,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  now = () => Date.now(),
} = {}) {
  const start = now();
  for (;;) {
    const batch = await client.messages.batches.retrieve(batchId);
    if (batch.processing_status === 'ended') return { status: 'ended' };
    if (now() - start >= maxWaitMs) return { status: 'timeout' };
    await sleep(intervalMs);
  }
}

// Read all results into an object keyed by custom_id.
// Each value is the SDK result: { type: 'succeeded'|'errored'|'canceled'|'expired', message?, error? }.
export async function collectResults(client, batchId) {
  const out = {};
  for await (const item of await client.messages.batches.results(batchId)) {
    out[item.custom_id] = item.result;
  }
  return out;
}

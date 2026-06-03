import test from 'node:test';
import assert from 'node:assert';
import { submitBatch, pollBatchUntilDone, collectResults } from './batch.mjs';

// Minimal mock of client.messages.batches.
function mockClient({ statuses = [], resultsList = [] } = {}) {
  let i = 0;
  return {
    messages: {
      batches: {
        create: async () => ({ id: 'batch_123' }),
        retrieve: async () => ({ processing_status: statuses[Math.min(i++, statuses.length - 1)] }),
        cancel: async () => ({ processing_status: 'canceling' }),
        results: async () => (async function* () { for (const r of resultsList) yield r; })(),
      },
    },
  };
}

test('submitBatch returns the batch id', async () => {
  assert.equal(await submitBatch(mockClient(), []), 'batch_123');
});

test('pollBatchUntilDone returns ended when the batch ends', async () => {
  const client = mockClient({ statuses: ['in_progress', 'ended'] });
  const res = await pollBatchUntilDone(client, 'batch_123', {
    maxWaitMs: 60_000, intervalMs: 0, sleep: async () => {}, now: () => 0,
  });
  assert.equal(res.status, 'ended');
});

test('pollBatchUntilDone returns timeout past the deadline', async () => {
  const client = mockClient({ statuses: ['in_progress'] });
  let t = 0;
  const res = await pollBatchUntilDone(client, 'batch_123', {
    maxWaitMs: 100, intervalMs: 0, sleep: async () => {}, now: () => (t += 1000),
  });
  assert.equal(res.status, 'timeout');
});

test('collectResults maps custom_id to result', async () => {
  const client = mockClient({ resultsList: [
    { custom_id: 'deal-a', result: { type: 'succeeded' } },
    { custom_id: 'deal-b', result: { type: 'errored' } },
  ] });
  const out = await collectResults(client, 'batch_123');
  assert.equal(out['deal-a'].type, 'succeeded');
  assert.equal(out['deal-b'].type, 'errored');
});

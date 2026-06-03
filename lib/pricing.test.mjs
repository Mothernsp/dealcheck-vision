import test from 'node:test';
import assert from 'node:assert';
import { estimateCostUsd } from './pricing.mjs';

test('estimateCostUsd: fresh input + output at Opus rates', () => {
  // 1M fresh input @ $15 + 1M output @ $75 = $90
  const cost = estimateCostUsd('claude-opus-4-7', {
    input_tokens: 1_000_000,
    output_tokens: 1_000_000,
  });
  assert.ok(Math.abs(cost - 90) < 1e-6, `expected 90, got ${cost}`);
});

test('estimateCostUsd: cached reads are ~10% of input price', () => {
  // 1M cache-read @ 10% of $15 = $1.50
  const cost = estimateCostUsd('claude-opus-4-7', { cache_read_input_tokens: 1_000_000 });
  assert.ok(Math.abs(cost - 1.5) < 1e-6, `expected 1.5, got ${cost}`);
});

test('estimateCostUsd: unknown model returns 0', () => {
  assert.equal(estimateCostUsd('made-up-model', { input_tokens: 1_000_000 }), 0);
});

test('estimateCostUsd: null usage returns 0', () => {
  assert.equal(estimateCostUsd('claude-opus-4-7', null), 0);
});

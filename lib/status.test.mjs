import test from 'node:test';
import assert from 'node:assert';
import { dealMeta, dealKind } from './status.js';

test('dealMeta exposes inline dot + text for a failing deal', () => {
  const meta = dealMeta({ status: 'done', overall_status: 'fail' });
  assert.equal(meta.kind, 'fail');
  assert.equal(meta.dot, 'bg-rose-500');
  assert.equal(meta.text, 'text-rose-600');
});

test('dealMeta keeps chip for back-compat', () => {
  const meta = dealMeta({ status: 'done', overall_status: 'pass' });
  assert.ok(meta.chip.includes('emerald'));
});

test('dealKind buckets statuses correctly for filtering', () => {
  assert.equal(dealKind({ status: 'failed' }), 'failed');
  assert.equal(dealKind({ status: 'done', overall_status: 'warnings' }), 'warn');
  assert.equal(dealKind({ status: 'done', overall_status: 'pass' }), 'pass');
});

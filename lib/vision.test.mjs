import test from 'node:test';
import assert from 'node:assert';
import {
  buildClassifyParams,
  buildComplianceParams,
  normalizeClassification,
  messageText,
  MODEL,
} from './vision.mjs';

const files = [{ bytes: Buffer.from('fake-png'), filename: 'scan.png' }];

test('buildClassifyParams: shape, default model, cached system block', () => {
  const p = buildClassifyParams(files);
  assert.equal(p.model, MODEL);
  assert.equal(p.max_tokens, 16000);
  assert.equal(p.system[0].cache_control.type, 'ephemeral');
  assert.equal(p.messages[0].role, 'user');
  assert.ok(p.messages[0].content.some((b) => b.type === 'image'));
  assert.ok(p.messages[0].content.some((b) => b.type === 'text' && b.text.includes('scan.png')));
});

test('buildClassifyParams: model override', () => {
  assert.equal(buildClassifyParams(files, { model: 'claude-sonnet-4-6' }).model, 'claude-sonnet-4-6');
});

test('buildComplianceParams: shape + cached system block', () => {
  const p = buildComplianceParams([{ filename: 'x', doc_type: 'bill_of_sale', fields: {} }]);
  assert.equal(p.model, MODEL);
  assert.equal(p.max_tokens, 16000);
  assert.equal(p.system[0].cache_control.type, 'ephemeral');
  assert.equal(p.messages[0].role, 'user');
});

test('normalizeClassification: defaults + indexed filename', () => {
  const out = normalizeClassification([{ doc_type: 'carfax_report', fields: { vin: 'X' } }], files);
  assert.equal(out[0].doc_type, 'carfax_report');
  assert.equal(out[0].source_file, 'scan.png');
  assert.ok(out[0].filename.includes('doc 1'));
  assert.equal(normalizeClassification([{ fields: {} }], files)[0].doc_type, 'other');
});

test('messageText: concatenates text blocks only', () => {
  const text = messageText([
    { type: 'text', text: 'a' },
    { type: 'image' },
    { type: 'text', text: 'b' },
  ]);
  assert.equal(text, 'ab');
});

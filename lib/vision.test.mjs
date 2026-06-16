import test from 'node:test';
import assert from 'node:assert';
import {
  buildClassifyParams,
  buildComplianceParams,
  normalizeClassification,
  messageText,
  CLASSIFY_MODEL,
  COMPLIANCE_MODEL,
} from './vision.mjs';

const files = [{ bytes: Buffer.from('fake-png'), filename: 'scan.png' }];

test('buildClassifyParams: shape, default model, cached system block', () => {
  const p = buildClassifyParams(files);
  assert.equal(p.model, CLASSIFY_MODEL);
  assert.equal(CLASSIFY_MODEL, 'claude-sonnet-4-6'); // classification runs on Sonnet
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
  assert.equal(p.model, COMPLIANCE_MODEL);
  assert.equal(COMPLIANCE_MODEL, 'claude-opus-4-8'); // compliance/judgment stays on Opus
  assert.equal(p.max_tokens, 16000);
  assert.equal(p.system[0].cache_control.type, 'ephemeral');
  assert.equal(p.messages[0].role, 'user');
});

test('buildComplianceParams: overrides append a second cached system block', () => {
  const perFile = [{ filename: 'x', doc_type: 'bill_of_sale', fields: {} }];
  // No overrides → single base block (unchanged behavior).
  assert.equal(buildComplianceParams(perFile).system.length, 1);
  assert.equal(buildComplianceParams(perFile, { overrides: '' }).system.length, 1);
  // With overrides → base block stays first, admin directive rides in block 2.
  const p = buildComplianceParams(perFile, { overrides: 'ADMIN DIRECTIVE TEXT' });
  assert.equal(p.system.length, 2);
  assert.equal(p.system[1].text, 'ADMIN DIRECTIVE TEXT');
  assert.equal(p.system[1].cache_control.type, 'ephemeral');
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

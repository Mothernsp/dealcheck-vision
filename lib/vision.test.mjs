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

test('buildComplianceParams: attaches renderable grounding scan for a flagged comparison', () => {
  const perFile = [
    { filename: 'bos', doc_type: 'bill_of_sale', source_file: 'bos.png', fields: { vin: '1HGCM82633A004352' } },
    { filename: 'fc', doc_type: 'finance_contract', source_file: 'fc.png', fields: { vin: '2HGCM82633A999999' } },
  ];
  const images = {
    'bos.png': { bytes: Buffer.from('img'), mimeType: 'image/png' },
    'fc.png': { bytes: Buffer.from('img'), mimeType: 'image/png' },
  };
  const content = buildComplianceParams(perFile, { images }).messages[0].content;
  assert.ok(content.some((b) => b.type === 'image'));
  assert.ok(content.some((b) => b.type === 'text' && b.text.includes('SOURCE SCAN: bos.png')));
});

test('buildComplianceParams: unrenderable grounding scan is skipped, not fatal', () => {
  const perFile = [
    { filename: 'bos', doc_type: 'bill_of_sale', source_file: 'bos.xyz', fields: { vin: '1HGCM82633A004352' } },
    { filename: 'fc', doc_type: 'finance_contract', source_file: 'fc.xyz', fields: { vin: '2HGCM82633A999999' } },
  ];
  const images = {
    'bos.xyz': { bytes: Buffer.from('x'), mimeType: 'application/octet-stream' },
    'fc.xyz': { bytes: Buffer.from('x'), mimeType: 'application/octet-stream' },
  };
  let params;
  assert.doesNotThrow(() => { params = buildComplianceParams(perFile, { images }); });
  const content = params.messages[0].content;
  assert.ok(!content.some((b) => b.type === 'image' || b.type === 'document'));
  assert.ok(!content.some((b) => b.type === 'text' && b.text.includes('SOURCE SCAN')));
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

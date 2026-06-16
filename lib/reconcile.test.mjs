import test from 'node:test';
import assert from 'node:assert';
import { reconcileDocuments } from './reconcile.mjs';

// Build a document in the uniform per-file shape the engine consumes.
function doc(doc_type, fields, source_file = `${doc_type}.pdf`) {
  return { doc_type, source_file, filename: `${source_file} — doc 1`, fields };
}

const find = (comparisons, id) => comparisons.find((c) => c.id === id);

test('VIN consensus: passes case- and spacing-insensitively', () => {
  const { comparisons } = reconcileDocuments([
    doc('bill_of_sale', { vin: '1HGCM82633A004352' }),
    doc('finance_contract', { vin: '1hg cm826-33a004352' }),
  ]);
  const vin = find(comparisons, 'vin');
  assert.equal(vin.status, 'pass');
  assert.equal(vin.operands.length, 2);
});

test('VIN consensus: mismatch fails and flags both source docs', () => {
  const { comparisons, discrepancies } = reconcileDocuments([
    doc('bill_of_sale', { vin: '1HGCM82633A004352' }, 'bos.pdf'),
    doc('finance_contract', { vin: '2HGCM82633A999999' }, 'contract.pdf'),
  ]);
  const vin = find(comparisons, 'vin');
  assert.equal(vin.status, 'fail');
  const sources = vin.operands.map((o) => o.source_file).sort();
  assert.deepEqual(sources, ['bos.pdf', 'contract.pdf']);
  assert.ok(discrepancies.some((d) => d.id === 'vin'));
});

test('cross-rule price: matching BOS and contract passes', () => {
  const { comparisons } = reconcileDocuments([
    doc('bill_of_sale', { sale_price: 35000 }),
    doc('finance_contract', { sale_price: 35000 }),
  ]);
  assert.equal(find(comparisons, 'bos_price_vs_contract').status, 'pass');
});

test('cross-rule price: mismatch fails with both values in the note', () => {
  const { comparisons } = reconcileDocuments([
    doc('bill_of_sale', { sale_price: 35000 }),
    doc('finance_contract', { sale_price: 34000 }),
  ]);
  const c = find(comparisons, 'bos_price_vs_contract');
  assert.equal(c.status, 'fail');
  assert.ok(c.note.includes('35000'));
  assert.ok(c.note.includes('34000'));
});

test('cross-rule price: one side missing is inconclusive', () => {
  const { comparisons, discrepancies } = reconcileDocuments([
    doc('bill_of_sale', { sale_price: 35000 }),
    doc('carfax_report', { vin: '1HGCM82633A004352' }),
  ]);
  const c = find(comparisons, 'bos_price_vs_contract');
  assert.equal(c.status, 'inconclusive');
  assert.equal(c.operands.length, 1);
  assert.ok(discrepancies.some((d) => d.id === 'bos_price_vs_contract'));
});

test('cross-rule price: neither side present is skipped (no false lease warning)', () => {
  const { comparisons } = reconcileDocuments([
    doc('carfax_report', { vin: '1HGCM82633A004352' }),
    doc('driver_license', { customer_name: 'Jane Doe' }),
  ]);
  assert.equal(find(comparisons, 'bos_price_vs_contract'), undefined);
});

test('cross-rule price: lease_agreement satisfies the contract alternative', () => {
  const { comparisons } = reconcileDocuments([
    doc('bill_of_sale', { sale_price: 28000 }),
    doc('lease_agreement', { sale_price: 28000 }),
  ]);
  assert.equal(find(comparisons, 'bos_price_vs_contract').status, 'pass');
});

test('consolidated: takes the majority value across documents', () => {
  const { consolidated } = reconcileDocuments([
    doc('bill_of_sale', { vin: '1HGCM82633A004352' }, 'a.pdf'),
    doc('finance_contract', { vin: '1HGCM82633A004352' }, 'b.pdf'),
    doc('carfax_report', { vin: '9XXXXXXXXXXXXXXXX' }, 'c.pdf'),
  ]);
  assert.equal(consolidated.vin, '1HGCM82633A004352');
});

test('odometer: within 1-unit tolerance passes, large gap fails', () => {
  const near = reconcileDocuments([
    doc('odometer_disclosure', { odometer_km: 50000 }),
    doc('carfax_report', { odometer_km: 50001 }),
  ]);
  assert.equal(find(near.comparisons, 'odometer').status, 'pass');

  const far = reconcileDocuments([
    doc('odometer_disclosure', { odometer_km: 50000 }),
    doc('carfax_report', { odometer_km: 60000 }),
  ]);
  assert.equal(find(far.comparisons, 'odometer').status, 'fail');
});

test('consensus: a single reporting document passes', () => {
  const { comparisons } = reconcileDocuments([
    doc('bill_of_sale', { vin: '1HGCM82633A004352' }),
  ]);
  const vin = find(comparisons, 'vin');
  assert.equal(vin.status, 'pass');
  assert.equal(vin.operands.length, 1);
});

test('consensus: a field no document reports produces no comparison entry', () => {
  const { comparisons } = reconcileDocuments([
    doc('bill_of_sale', { vin: '1HGCM82633A004352' }),
  ]);
  assert.equal(find(comparisons, 'trade_in_vin'), undefined);
});

test('empty or malformed input never throws and returns the standard shape', () => {
  for (const input of [null, undefined, [], 'nope', 42, [null, {}, { fields: null }, 7, 'x']]) {
    const r = reconcileDocuments(input);
    assert.ok(r && typeof r === 'object');
    assert.ok(r.consolidated && typeof r.consolidated === 'object');
    assert.ok(Array.isArray(r.comparisons));
    assert.ok(Array.isArray(r.discrepancies));
  }
});

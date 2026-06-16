import test from 'node:test';
import assert from 'node:assert';
import { topCounts, dealOccurrenceCounts, withinRange } from './dashboard-metrics.mjs';

test('topCounts: counts occurrences and sorts by count descending', () => {
  const result = topCounts(['a', 'b', 'a', 'a', 'b', 'c']);
  assert.deepEqual(result, [
    { label: 'a', count: 3 },
    { label: 'b', count: 2 },
    { label: 'c', count: 1 },
  ]);
});

test('topCounts: caps at n (default 5)', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  assert.equal(topCounts(items).length, 5);
  assert.equal(topCounts(items, 3).length, 3);
});

test('topCounts: ties break by first-seen order', () => {
  // all count 1 — insertion order decides
  const result = topCounts(['banana', 'apple', 'cherry']);
  assert.deepEqual(result.map((r) => r.label), ['banana', 'apple', 'cherry']);
});

test('topCounts: a higher count still outranks an earlier-seen lower count', () => {
  const result = topCounts(['apple', 'banana', 'banana']);
  assert.deepEqual(result, [
    { label: 'banana', count: 2 },
    { label: 'apple', count: 1 },
  ]);
});

test('topCounts: empty / non-array input returns []', () => {
  assert.deepEqual(topCounts([]), []);
  assert.deepEqual(topCounts(null), []);
  assert.deepEqual(topCounts(undefined), []);
});

test('topCounts: skips empty and non-string entries', () => {
  const result = topCounts(['a', '', null, undefined, '   ', 'a']);
  assert.deepEqual(result, [{ label: 'a', count: 2 }]);
});

test('dealOccurrenceCounts: counts deals, not total occurrences', () => {
  const perDeal = [
    ['Safety inspection', 'Lien search'],
    ['Safety inspection'],
    ['Odometer disclosure'],
  ];
  assert.deepEqual(dealOccurrenceCounts(perDeal), [
    { label: 'Safety inspection', count: 2 },
    { label: 'Lien search', count: 1 },
    { label: 'Odometer disclosure', count: 1 },
  ]);
});

test('dealOccurrenceCounts: a label repeated within one deal counts once', () => {
  const perDeal = [['Lien search', 'Lien search', ' Lien search ']];
  assert.deepEqual(dealOccurrenceCounts(perDeal), [{ label: 'Lien search', count: 1 }]);
});

test('dealOccurrenceCounts: empty / malformed input is safe', () => {
  assert.deepEqual(dealOccurrenceCounts([]), []);
  assert.deepEqual(dealOccurrenceCounts(null), []);
  assert.deepEqual(dealOccurrenceCounts([[], null, ['x'], 'nope']), [{ label: 'x', count: 1 }]);
});

const MID = '2026-03-15T12:00:00.000Z';

test('withinRange: no bounds includes everything', () => {
  assert.equal(withinRange(MID, null, null), true);
  assert.equal(withinRange(MID, '', ''), true);
});

test('withinRange: inclusive lower bound (start of the from day)', () => {
  assert.equal(withinRange('2026-03-15T00:00:00.000Z', '2026-03-15', null), true);
  assert.equal(withinRange('2026-03-14T23:59:59.000Z', '2026-03-15', null), false);
});

test('withinRange: inclusive upper bound (end of the to day)', () => {
  assert.equal(withinRange('2026-03-15T23:59:59.000Z', null, '2026-03-15'), true);
  assert.equal(withinRange('2026-03-16T00:00:00.000Z', null, '2026-03-15'), false);
});

test('withinRange: both bounds — inside passes, outside fails', () => {
  assert.equal(withinRange(MID, '2026-03-01', '2026-03-31'), true);
  assert.equal(withinRange('2026-02-15T12:00:00Z', '2026-03-01', '2026-03-31'), false);
  assert.equal(withinRange('2026-04-15T12:00:00Z', '2026-03-01', '2026-03-31'), false);
});

test('withinRange: a single-day range (from === to) covers that whole day', () => {
  assert.equal(withinRange('2026-03-15T08:30:00Z', '2026-03-15', '2026-03-15'), true);
});

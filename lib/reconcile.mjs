// Deterministic cross-document comparison engine.
//
// The unreliable part of compliance was never reading the numbers off the scans
// — it was the model inferring WHICH number on WHICH document to compare against
// which. Every document shares one uniform `fields` shape, so that inference is
// just code: a cross-document check is "field on doc_type A vs field on doc_type
// B". This module resolves those comparisons in code and hands the model the
// finished results to adjudicate (see lib/vision.mjs buildComplianceParams).

import { DOLLAR_FIELDS, normVin, vinEq, moneyEq, numEq, textEq } from './normalize.mjs';

const COMPARERS = {
  vin: vinEq,
  num: (a, b) => numEq(a, b),
  money: moneyEq,
  text: textEq,
};

// Consensus rules: one field that must be identical across EVERY document that
// reports it (vin, odometer, vehicle identity, customer name).
export const CONSENSUS_RULES = [
  { id: 'vin', label: 'VIN consistency', field: 'vin', compare: 'vin' },
  { id: 'trade_in_vin', label: 'Trade-in VIN consistency', field: 'trade_in_vin', compare: 'vin' },
  { id: 'odometer', label: 'Odometer consistency', field: 'odometer_km', compare: 'num' },
  { id: 'year', label: 'Vehicle year consistency', field: 'year', compare: 'text' },
  { id: 'make', label: 'Vehicle make consistency', field: 'make', compare: 'text' },
  { id: 'model', label: 'Vehicle model consistency', field: 'model', compare: 'text' },
  { id: 'customer_name', label: 'Customer name consistency', field: 'customer_name', compare: 'text' },
];

// Cross rules: a field on one document compared against a field on another. A
// `doc_type` may be an ordered array of alternatives — the first present one
// wins (so a financed deal doesn't get a false "missing lease agreement").
export const CROSS_RULES = [
  {
    id: 'bos_price_vs_contract',
    label: 'Selling price: bill of sale vs financing contract',
    compare: 'money',
    left: { doc_type: 'bill_of_sale', field: 'sale_price' },
    right: { doc_type: ['finance_contract', 'lease_agreement'], field: 'sale_price' },
  },
  {
    id: 'lien_payout_vs_finance',
    label: 'Lien payout: lien search vs financing contract',
    compare: 'money',
    left: { doc_type: 'lien_search', field: 'lien_amount' },
    right: { doc_type: ['finance_contract', 'lease_agreement'], field: 'lien_amount' },
  },
];

// Does this document actually report a usable value for the field?
function hasValue(v, compare) {
  if (v == null) return false;
  if (typeof v === 'string' && v.trim() === '') return false;
  if (compare === 'text') return String(v).trim() !== '';
  if (compare === 'vin') return Boolean(normVin(v));
  return Number.isFinite(Number(v)); // num / money
}

function operand(doc, field) {
  return {
    value: doc.fields[field],
    doc_type: doc.doc_type ?? null,
    field,
    source_file: doc.source_file ?? null,
    filename: doc.filename ?? null,
  };
}

function fmt(v) {
  return v == null ? 'null' : String(v);
}

// Normalize a value to a grouping key so "majority" counts spacing/case/cent
// variants as the same value.
function keyFor(compare, v) {
  if (compare === 'vin') return normVin(v);
  if (compare === 'text') return String(v).trim().toLowerCase().replace(/\s+/g, ' ');
  return String(Number(v)); // num / money
}

// Most-common reported value for a field (first-seen wins ties). Returns
// undefined when no document reports it.
function majorityValue(docs, field, compare) {
  const groups = new Map(); // key -> { value, count }
  for (const d of docs) {
    const v = d.fields?.[field];
    if (!hasValue(v, compare)) continue;
    const key = keyFor(compare, v);
    const g = groups.get(key);
    if (g) g.count += 1;
    else groups.set(key, { value: v, count: 1 });
  }
  let best;
  for (const g of groups.values()) {
    if (!best || g.count > best.count) best = g;
  }
  return best ? best.value : undefined;
}

function evalConsensus(rule, docs) {
  const operands = [];
  for (const d of docs) {
    if (hasValue(d.fields?.[rule.field], rule.compare)) operands.push(operand(d, rule.field));
  }
  if (operands.length === 0) return null; // no document reports it → not applicable

  let status;
  let note;
  if (operands.length === 1) {
    status = 'pass';
    note = `Only ${operands[0].doc_type ?? 'one document'} reports ${rule.field}; nothing to cross-check.`;
  } else {
    const cmp = COMPARERS[rule.compare];
    const ref = operands[0].value;
    const agree = operands.every((o) => cmp(o.value, ref));
    if (agree) {
      status = 'pass';
      note = `All ${operands.length} documents agree on ${rule.field}.`;
    } else {
      status = 'fail';
      const detail = operands.map((o) => `${o.doc_type ?? '?'}=${fmt(o.value)}`).join(', ');
      note = `${rule.field} disagrees across documents: ${detail}.`;
    }
  }
  return { id: rule.id, label: rule.label, kind: 'consensus', compare: rule.compare, status, operands, note };
}

// Resolve a cross-rule operand: scan the ordered doc_type alternatives and
// return the first document that actually reports the field, or null.
function resolveOperand(spec, compare, docs) {
  const alts = Array.isArray(spec.doc_type) ? spec.doc_type : [spec.doc_type];
  for (const alt of alts) {
    const d = docs.find((doc) => doc.doc_type === alt && hasValue(doc.fields?.[spec.field], compare));
    if (d) return operand(d, spec.field);
  }
  return null;
}

function describeTypes(doc_type) {
  return Array.isArray(doc_type) ? doc_type.join(' or ') : doc_type;
}

function evalCross(rule, docs) {
  const left = resolveOperand(rule.left, rule.compare, docs);
  const right = resolveOperand(rule.right, rule.compare, docs);

  if (!left && !right) return null; // neither side present → not applicable to this deal

  if (!left || !right) {
    const present = left || right;
    const missing = left ? rule.right : rule.left;
    return {
      id: rule.id,
      label: rule.label,
      kind: 'cross',
      compare: rule.compare,
      status: 'inconclusive',
      operands: [present],
      note: `${present.doc_type} reports ${present.field}=${fmt(present.value)}, but no ${describeTypes(missing.doc_type)} ${missing.field} was found to compare against.`,
    };
  }

  const cmp = COMPARERS[rule.compare];
  const match = cmp(left.value, right.value);
  return {
    id: rule.id,
    label: rule.label,
    kind: 'cross',
    compare: rule.compare,
    status: match ? 'pass' : 'fail',
    operands: [left, right],
    note: match
      ? `Match: ${left.doc_type} ${left.field}=${fmt(left.value)} vs ${right.doc_type} ${right.field}=${fmt(right.value)}.`
      : `Mismatch: ${left.doc_type} ${left.field}=${fmt(left.value)} vs ${right.doc_type} ${right.field}=${fmt(right.value)}.`,
  };
}

const CONSENSUS_FIELDS = [
  { field: 'vin', compare: 'vin' },
  { field: 'trade_in_vin', compare: 'vin' },
  { field: 'odometer_km', compare: 'num' },
  { field: 'year', compare: 'text' },
  { field: 'make', compare: 'text' },
  { field: 'model', compare: 'text' },
  { field: 'customer_name', compare: 'text' },
];

function buildConsolidated(docs) {
  const out = {};
  for (const { field, compare } of CONSENSUS_FIELDS) {
    const v = majorityValue(docs, field, compare);
    if (v !== undefined) out[field] = v;
  }
  for (const field of DOLLAR_FIELDS) {
    const v = majorityValue(docs, field, 'money');
    if (v !== undefined) out[field] = v;
  }
  return out;
}

// Reconcile a deal's documents into: a `consolidated` record (consensus value
// per shared/dollar field), every evaluated `comparisons` rule, and the
// `discrepancies` subset (fail + inconclusive) worth the model's attention.
export function reconcileDocuments(docs) {
  const valid = Array.isArray(docs)
    ? docs.filter((d) => d && typeof d === 'object' && d.fields && typeof d.fields === 'object')
    : [];

  const comparisons = [];
  for (const rule of CONSENSUS_RULES) {
    const c = evalConsensus(rule, valid);
    if (c) comparisons.push(c);
  }
  for (const rule of CROSS_RULES) {
    const c = evalCross(rule, valid);
    if (c) comparisons.push(c);
  }

  const consolidated = buildConsolidated(valid);
  const discrepancies = comparisons.filter((c) => c.status === 'fail' || c.status === 'inconclusive');

  return { consolidated, comparisons, discrepancies };
}

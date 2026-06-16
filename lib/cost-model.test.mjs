import test from 'node:test';
import assert from 'node:assert';
import {
  CLAUDE_MARKUP,
  ASSUMED_MONTHLY_DEALS,
  billedClaude,
  infraMonthlyTotal,
  infraPerDeal,
  groupByDeal,
  summarize,
} from './cost-model.mjs';

test('billedClaude: applies the markup and is null-safe', () => {
  assert.equal(billedClaude(0.5), 0.5 * CLAUDE_MARKUP);
  assert.equal(billedClaude(0), 0);
  assert.equal(billedClaude(null), 0);
  assert.equal(billedClaude(undefined), 0);
});

test('infraPerDeal: lines sum to the per-deal total and equal monthly ÷ assumed volume', () => {
  const { perDeal, lines } = infraPerDeal();
  const lineSum = lines.reduce((s, l) => s + l.perDeal, 0);
  assert.ok(Math.abs(lineSum - perDeal) < 1e-9);
  assert.ok(Math.abs(perDeal - infraMonthlyTotal() / ASSUMED_MONTHLY_DEALS) < 1e-9);
  assert.ok(lines.length >= 4); // vercel, clerk, supabase, hosting
});

test('groupByDeal: groups rows by deal_id and marks up Claude cost', () => {
  const rows = [
    { deal_id: 'a', call_type: 'classification', model: 'claude-sonnet-4-6', estimated_cost_usd: 0.10, created_at: '2026-06-01T10:00:00Z' },
    { deal_id: 'a', call_type: 'compliance', model: 'claude-opus-4-8', estimated_cost_usd: 0.30, created_at: '2026-06-01T10:01:00Z' },
    { deal_id: 'b', call_type: 'classification', model: 'claude-sonnet-4-6', estimated_cost_usd: 0.20, created_at: '2026-06-02T09:00:00Z' },
  ];
  const deals = groupByDeal(rows);
  assert.equal(deals.length, 2);

  const a = deals.find((d) => d.dealId === 'a');
  assert.equal(a.calls.length, 2);
  assert.ok(Math.abs(a.claudeRaw - 0.40) < 1e-9);
  assert.ok(Math.abs(a.claudeBilled - 0.80) < 1e-9); // 0.40 × 2
  assert.ok(Math.abs(a.total - (a.claudeBilled + a.infraPerDeal)) < 1e-9);
});

test('groupByDeal: newest deal first', () => {
  const rows = [
    { deal_id: 'old', estimated_cost_usd: 0.1, created_at: '2026-06-01T00:00:00Z' },
    { deal_id: 'new', estimated_cost_usd: 0.1, created_at: '2026-06-05T00:00:00Z' },
  ];
  const deals = groupByDeal(rows);
  assert.equal(deals[0].dealId, 'new');
});

test('summarize: empty input is all zeros, never divides by zero', () => {
  const s = summarize([]);
  assert.equal(s.dealCount, 0);
  assert.equal(s.grandTotal, 0);
  assert.equal(s.avgPerDeal, 0);
});

test('a typical deal presents at roughly $5 all-in', () => {
  // ~$0.375 real Claude → $0.75 billed; + infra share (~$4.25) ≈ $5.00
  const [deal] = groupByDeal([
    { deal_id: 'x', call_type: 'classification', model: 'claude-sonnet-4-6', estimated_cost_usd: 0.075, created_at: '2026-06-01T00:00:00Z' },
    { deal_id: 'x', call_type: 'compliance', model: 'claude-opus-4-8', estimated_cost_usd: 0.30, created_at: '2026-06-01T00:01:00Z' },
  ]);
  assert.ok(Math.abs(deal.total - 5) < 0.1, `expected ≈ $5, got ${deal.total}`);
});

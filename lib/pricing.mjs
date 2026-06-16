// Estimated Anthropic token pricing, shared by the eval harness and the
// processor's cost logging. VERIFY against https://www.anthropic.com/pricing —
// the cost numbers are only as accurate as this table.
//
// USD per million tokens.
export const PRICING = {
  'claude-opus-4-7':   { input: 5, output: 25 },
  'claude-opus-4-8':   { input: 5, output: 25 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
};

const CACHE_READ_MULT = 0.1;   // cached-input read ≈ 10% of input price
const CACHE_WRITE_MULT = 1.25; // 5-min ephemeral cache write ≈ 125% of input price

export const BATCH_DISCOUNT = 0.5; // Message Batches API is 50% off

// Estimate the USD cost of one Anthropic call from its usage object.
export function estimateCostUsd(model, usage, { batch = false } = {}) {
  const p = PRICING[model];
  if (!p || !usage) return 0;
  const fresh = usage.input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const out = usage.output_tokens ?? 0;
  const base = (
    fresh * p.input +
    cacheRead * p.input * CACHE_READ_MULT +
    cacheWrite * p.input * CACHE_WRITE_MULT +
    out * p.output
  ) / 1_000_000;
  return batch ? base * BATCH_DISCOUNT : base;
}

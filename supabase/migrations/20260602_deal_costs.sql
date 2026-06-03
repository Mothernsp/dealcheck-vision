-- Phase 4.1: per-deal API cost tracking.
-- One row per Anthropic call, written by the local processor. Powers /admin/costs.
--
-- Apply via the Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run).

create table if not exists public.deal_costs (
  id                          bigint generated always as identity primary key,
  deal_id                     text        not null,
  call_type                   text        not null,   -- 'classification' | 'compliance'
  model                       text        not null,
  input_tokens                int         not null default 0,
  output_tokens               int         not null default 0,
  cache_read_input_tokens     int         not null default 0,
  cache_creation_input_tokens int         not null default 0,
  estimated_cost_usd          numeric     not null default 0,
  from_batch                  boolean     not null default false,
  created_at                  timestamptz not null default now()
);

create index if not exists deal_costs_created_at_idx on public.deal_costs (created_at);
create index if not exists deal_costs_deal_id_idx on public.deal_costs (deal_id);

-- Written by the processor (service role) and read by /admin/costs (service role).
-- RLS on with no public policies; the service role bypasses it.
alter table public.deal_costs enable row level security;

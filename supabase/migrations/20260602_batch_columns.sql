-- Phase 3.1: batch-processing state on deals.
-- Apply via Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).

alter table public.deals add column if not exists batch_id text;
alter table public.deals add column if not exists batch_stage text; -- 'classifying' | 'checking'

create index if not exists deals_batch_id_idx on public.deals (batch_id);

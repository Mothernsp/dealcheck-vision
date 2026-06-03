-- Phase 1.2: deal-set deduplication cache.
-- Stores the classification + compliance results for a given set of uploaded
-- files, keyed by a content hash of that file set. Lets the processor skip both
-- Opus calls when the exact same files are re-uploaded with the same model.
--
-- Apply via the Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run).

create table if not exists public.classification_cache (
  deal_set_hash        text        primary key,
  classification_result jsonb      not null,
  compliance_result    jsonb       not null,
  model_used           text        not null,
  created_at           timestamptz not null default now()
);

-- Only the processor (service role) and the admin endpoint (service role) touch
-- this table. Enable RLS with no public policies so it is never readable/writable
-- by anon/authenticated clients; the service role bypasses RLS.
alter table public.classification_cache enable row level security;

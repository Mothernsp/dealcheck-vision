-- Run this in the Supabase SQL editor.

create extension if not exists "uuid-ossp";

create table if not exists deals (
  id uuid primary key default uuid_generate_v4(),
  org_id text not null,
  created_by text not null,
  status text not null default 'uploaded',
  customer_name text,
  vehicle_info text,
  report jsonb,
  files jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If `deals` already exists, run this once to add the per-file metadata column:
alter table deals add column if not exists files jsonb;

create index if not exists deals_org_idx on deals (org_id, created_at desc);

-- Files live in Supabase Storage (private bucket below), not a database table.
insert into storage.buckets (id, name, public)
values ('deal-files', 'deal-files', false)
on conflict (id) do nothing;

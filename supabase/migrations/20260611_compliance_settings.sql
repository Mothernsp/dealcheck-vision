-- Admin-managed compliance directives.
-- Each row is one extra compliance item an admin authored in the Optimization
-- tab: free-text instruction + a priority that maps onto pass/warn/fail. The
-- enabled rows are injected into the compliance model's system prompt at runtime
-- (see lib/compliance-settings.mjs), so an admin edit takes effect on the very
-- next deal for both the web app and the local processor.
--
-- Apply via the Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run).

create table if not exists public.compliance_settings (
  id          uuid        primary key default uuid_generate_v4(),
  instruction text        not null,
  priority    text        not null default 'cautious',   -- 'hard_fail' | 'cautious' | 'soft_check'
  enabled     boolean     not null default true,
  created_by  text        not null,                       -- Clerk user id
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists compliance_settings_enabled_idx
  on public.compliance_settings (enabled, created_at);

-- Written and read by the service role (admin API routes + processor); the
-- service role bypasses RLS. No public policies.
alter table public.compliance_settings enable row level security;

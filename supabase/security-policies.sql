-- Row Level Security hardening for DealCheck Vision
-- ===================================================
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- It is idempotent and safe to re-run.
--
-- WHY THIS IS SAFE FOR THIS APP
-- -----------------------------
-- The app reaches Supabase exclusively through the SERVICE ROLE key
-- (see lib/supabase.js -> supabaseAdmin). The service role BYPASSES RLS, so
-- enabling RLS here does NOT change any current code path. Auth is handled by
-- Clerk, not Supabase Auth, so there are no end-user Supabase JWTs and
-- auth.uid()-style policies don't apply.
--
-- What this buys you: if the anon/public key is ever exposed (it ships in the
-- client bundle by design) or someone hits the REST/Realtime API directly,
-- RLS with no permissive policy = deny-all to the anon and authenticated
-- roles. Only the service role (server-side) can read or write.
--
-- classification_cache, deal_costs, and compliance_settings already have RLS
-- enabled with no public policies. This brings `deals` to the same posture.

-- 1) deals: enable RLS, no permissive policies -> anon/authenticated denied,
--    service role still has full access.
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals FORCE ROW LEVEL SECURITY;

-- 2) Belt-and-suspenders: confirm the other tables are locked down too.
ALTER TABLE public.classification_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_costs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_settings  ENABLE ROW LEVEL SECURITY;

-- 3) Storage: the `deal-files` bucket must NOT be public. Verify and fix.
UPDATE storage.buckets SET public = false WHERE id = 'deal-files';

-- ---------------------------------------------------------------------------
-- VERIFY (run these SELECTs after applying; each should confirm the lockdown)
-- ---------------------------------------------------------------------------
-- All four tables should show rowsecurity = true:
--   SELECT relname, relrowsecurity
--   FROM pg_class
--   WHERE relname IN ('deals','classification_cache','deal_costs','compliance_settings');
--
-- deals should have ZERO permissive policies (deny-all to non-service roles):
--   SELECT policyname FROM pg_policies WHERE tablename = 'deals';
--
-- The bucket should be private:
--   SELECT id, public FROM storage.buckets WHERE id = 'deal-files';

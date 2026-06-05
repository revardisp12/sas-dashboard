-- ============================================================================
-- Security hardening migration
-- Run this in the Supabase SQL editor (production) AFTER reviewing.
-- Addresses two findings from the 2026-06-05 code review:
--   (5) user_profiles_with_email view had no committed DDL and (if created
--       without a role guard) leaked every staff email/role/brand to ANY
--       authenticated user via a direct PostgREST call.
--   (6) Blanket GRANT SELECT ... TO anon on every table — currently masked by
--       RLS, but a fail-open posture the moment any new table forgets RLS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- (5) Re-create user_profiles_with_email with a caller role guard.
--
-- The view must run with the view owner's privileges (security_invoker = off)
-- because it reads auth.users, which the `authenticated` role cannot select
-- directly. To stop that from leaking all emails, the WHERE clause re-applies
-- the SAME visibility rule as the user_profiles RLS policy:
--   - super_admin / admin  -> see all rows
--   - everyone else        -> see only their own row
-- get_my_role() / auth.uid() resolve against the *caller's* JWT even though the
-- view body runs as definer, so the guard is per-caller.
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.user_profiles_with_email;

CREATE VIEW public.user_profiles_with_email
WITH (security_invoker = off, security_barrier = true) AS
  SELECT
    p.id,
    p.full_name,
    p.role,
    p.brand,
    p.created_at,
    u.email
  FROM public.user_profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = auth.uid()
     OR public.get_my_role() IN ('super_admin', 'admin');

-- Only authenticated users may read the view; anon gets nothing.
REVOKE ALL ON public.user_profiles_with_email FROM anon;
GRANT SELECT ON public.user_profiles_with_email TO authenticated;

-- ----------------------------------------------------------------------------
-- (6) Remove anon's blanket SELECT on data tables.
--
-- anon never legitimately reads application data (login uses Supabase Auth, not
-- table reads; get_my_role()/get_my_brand() return NULL for anon, so every RLS
-- USING clause already fails). Revoking the grant makes the posture fail-closed:
-- a future table without RLS is no longer instantly world-readable.
-- Keep schema USAGE (harmless) but drop table SELECT.
-- ----------------------------------------------------------------------------
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;

-- Belt-and-suspenders: stop future tables from auto-granting SELECT to anon.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM anon;

-- ----------------------------------------------------------------------------
-- Verification (run these after applying; eyeball the results)
-- ----------------------------------------------------------------------------
-- a) anon should have ZERO table grants in public:
--    SELECT table_name, privilege_type
--    FROM information_schema.role_table_grants
--    WHERE grantee = 'anon' AND table_schema = 'public';
--
-- b) The view should exist and be owned by a privileged role:
--    SELECT table_name FROM information_schema.views
--    WHERE table_schema = 'public' AND table_name = 'user_profiles_with_email';
--
-- c) Smoke test as a non-admin user from the app: opening Settings > Users must
--    return only that user's own row (not the whole staff list). As super_admin
--    it must still return everyone. The admin UI calls
--    supabase.from('user_profiles_with_email').select('*').
-- ============================================================================

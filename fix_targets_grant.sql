-- ============================================================================
-- Fix: 403 on the `targets` table (Monthly Target feature)
-- Run in the Supabase SQL editor (production).
--
-- Symptom: GET /rest/v1/targets?... returns 403 (not an empty result) for a
-- logged-in user. The dashboard's getTarget()/upsertTarget() calls fail.
--
-- Root cause: `targets` was added after the original
--   GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
-- ran, so that blanket grant never covered it (GRANT ALL ON ALL TABLES only
-- applies to tables existing at grant time — new tables don't inherit). RLS is
-- enabled and policies exist (targets_select / targets_write), but PostgREST
-- returns 403 when the JWT-mapped role lacks the table GRANT outright.
--
-- Fix: give `authenticated` the same privileges its sibling data tables have.
-- RLS still gates rows (select = same brand, write = manager+ same brand).
-- ============================================================================

GRANT ALL ON public.targets TO authenticated;

-- Verify afterwards:
--   SELECT privilege_type FROM information_schema.role_table_grants
--   WHERE grantee = 'authenticated' AND table_name = 'targets';
-- Expect: SELECT, INSERT, UPDATE, DELETE (and more).

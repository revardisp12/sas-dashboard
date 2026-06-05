-- ============================================================================
-- Permanent fix for the recurring "missing GRANT on new tables" → 403 pattern.
-- Run in the Supabase SQL editor (production).
--
-- Symptom: a data source fails to load on login, e.g.
--   "Gagal load 1 sumber data (facebook_organic)..."
-- and GET /rest/v1/<table> returns 403 (not an empty result).
--
-- Root cause: the original `GRANT ALL ON ALL TABLES IN SCHEMA public TO
-- authenticated` only covers tables that exist at grant time. Tables added
-- later via the Supabase dashboard (targets, facebook_organic, ...) never
-- inherited it, so PostgREST blocks them with 403 even though RLS + policies
-- exist. This has bitten digest_log, targets, and facebook_organic so far.
--
-- Safe because every table in this schema has RLS enabled — granting the
-- `authenticated` role does not over-expose data; RLS still enforces the
-- per-brand / per-role row filter.
-- ============================================================================

-- 1) Re-grant on every existing table (idempotent — covers any currently-403 table).
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 2) Auto-grant on every FUTURE table/sequence so this never recurs.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

-- Verify (should return ZERO rows — every public table now has an authenticated grant):
--   SELECT t.tablename
--   FROM pg_tables t
--   WHERE t.schemaname = 'public'
--     AND NOT EXISTS (
--       SELECT 1 FROM information_schema.role_table_grants g
--       WHERE g.table_schema = 'public' AND g.table_name = t.tablename
--         AND g.grantee = 'authenticated'
--     )
--   ORDER BY t.tablename;
-- ============================================================================

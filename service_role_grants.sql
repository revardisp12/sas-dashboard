-- Grant service_role read access to brand-scoped tables.
-- service_role is used by Vercel Cron endpoints (e.g. weekly-digest) for
-- direct SELECTs that bypass RLS. Default Postgres grants don't include
-- service_role automatically when tables are created via dashboard SQL —
-- we need explicit grants for cron jobs to work.
--
-- Idempotent: GRANT is a no-op if the privilege is already present.

GRANT SELECT ON public.sales            TO service_role;
GRANT SELECT ON public.crm              TO service_role;
GRANT SELECT ON public.google_ads       TO service_role;
GRANT SELECT ON public.meta_ads         TO service_role;
GRANT SELECT ON public.tiktok_shop      TO service_role;
GRANT SELECT ON public.shopee           TO service_role;
GRANT SELECT ON public.instagram        TO service_role;
GRANT SELECT ON public.tiktok_organic   TO service_role;
GRANT SELECT ON public.facebook_organic TO service_role;
GRANT SELECT ON public.user_profiles    TO service_role;  -- needed if cron looks up user roles
GRANT SELECT ON public.digest_log       TO service_role;
GRANT INSERT, UPDATE ON public.digest_log TO service_role; -- upsert via RPC needs this too

-- Set default privileges so future tables created in public schema
-- automatically grant SELECT to service_role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO service_role;

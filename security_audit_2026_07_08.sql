-- security_audit_2026_07_08.sql — run in Supabase SQL editor (production) after review.
-- Fixes 4 RLS gaps found by the 2026-07-08 audit (see docs/superpowers or session memory
-- for the full report). Non-destructive: only tightens SELECT/INSERT policies + adds a
-- nullable column. Companion code fix: src/app/api/wms/sync/route.ts now also enforces
-- brand scoping server-side — these RLS changes are the defense-in-depth layer for the
-- same class of bug (a non-super admin reading/touching another brand's data).

-- ============================================================
-- 1) user_profiles: SELECT was any-admin-sees-all-brands. Scope admin to their own brand;
--    super_admin still sees everyone.
-- ============================================================
DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
CREATE POLICY "user_profiles_select" ON user_profiles FOR SELECT
  USING (
    id = auth.uid()
    OR get_my_role() = 'super_admin'
    OR (get_my_role() = 'admin' AND brand = get_my_brand())
  );

-- ============================================================
-- 2) user_profiles: INSERT only checked id = auth.uid(), so a client-side insert (bypassing
--    the handle_new_user trigger, which runs SECURITY DEFINER and is unaffected by this)
--    could in principle set an arbitrary role/brand for the caller's own row. Restrict a
--    direct client insert to the same harmless default the trigger itself uses — any real
--    role/brand assignment must go through admin_update_user_profile() (already the only
--    way to UPDATE). Verified: no application code path performs a direct client-side
--    insert into user_profiles (only the trigger and the service-role admin/users route do).
-- ============================================================
DROP POLICY IF EXISTS "user_profiles_insert" ON user_profiles;
CREATE POLICY "user_profiles_insert" ON user_profiles FOR INSERT
  WITH CHECK (id = auth.uid() AND role = 'cs' AND brand IS NULL);

-- ============================================================
-- 3) sync_log: SELECT let any admin read every brand's sync history/row-counts. sync_log has
--    no brand column today (a run can span multiple brands), so add one: NULL for multi-brand
--    cron/webhook runs (whose `tables` counts are already a blended total, not attributable to
--    one brand), populated for single-brand manual runs (which, after the route.ts fix above,
--    is now the ONLY kind of run a non-super admin can trigger).
-- ============================================================
ALTER TABLE public.sync_log ADD COLUMN IF NOT EXISTS brand text CHECK (brand IN ('reglow','amura','purela'));

DROP POLICY IF EXISTS sync_log_select ON public.sync_log;
CREATE POLICY sync_log_select ON public.sync_log FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'super_admin'
    OR (public.get_my_role() = 'admin' AND (brand IS NULL OR brand = public.get_my_brand()))
  );

-- ============================================================
-- 4) wms_pull_log: created ad-hoc in a prior session (never committed as DDL — see git
--    history), with no RLS at all, so ANY authenticated user could read every brand's pull
--    history. CREATE TABLE IF NOT EXISTS is a safe no-op if it already exists with these
--    columns (matches the shape used by src/app/api/wms/sync/route.ts and BrandSyncButton.tsx).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wms_pull_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand       text NOT NULL CHECK (brand IN ('reglow','amura','purela')),
  range_start date NOT NULL,
  range_end   date NOT NULL,
  rows        integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wms_pull_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wms_pull_log_select ON public.wms_pull_log;
CREATE POLICY wms_pull_log_select ON public.wms_pull_log FOR SELECT TO authenticated
  USING (public.get_my_role() = 'super_admin' OR brand = public.get_my_brand());

-- The insert (src/app/api/wms/sync/route.ts) runs via the service_role client, which
-- bypasses RLS entirely — this grant just makes that explicit/future-proof.
GRANT SELECT, INSERT ON public.wms_pull_log TO service_role;

-- Verification:
--   -- as a brand-scoped admin (their own JWT), confirm cross-brand rows are now invisible:
--   SELECT brand FROM user_profiles;      -- expect only your own brand's rows (+ your own row)
--   SELECT brand FROM wms_pull_log;       -- expect only your own brand's rows
--   SELECT brand FROM sync_log;           -- expect only your own brand's rows + NULL (cron) rows

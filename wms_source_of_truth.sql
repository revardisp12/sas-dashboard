-- wms_source_of_truth.sql — run in Supabase SQL editor (production) AFTER review.
-- Adds provenance (origin), an idempotent natural key (wms_id) for WMS upserts,
-- and a sync_log observability table. Non-destructive: existing rows become origin='manual'.

-- 1) origin + wms_id on the 5 WMS-sourced tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sales','crm','products','google_ads','meta_ads'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT ''manual''', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS wms_id text', t);
    -- Plain (non-partial) unique index: NULLs are distinct in Postgres, so manual rows
    -- (wms_id IS NULL) still coexist, but PostgREST's upsert ON CONFLICT (brand, wms_id)
    -- — which omits any WHERE predicate — can match this index. A partial index can't.
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (brand, wms_id)', t||'_wms_uniq', t);
  END LOOP;
END $$;

-- 2) sync_log observability table
CREATE TABLE IF NOT EXISTS public.sync_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger      text NOT NULL,        -- 'cron' | 'webhook' | 'manual'
  triggered_by text,                 -- user email when manual
  status       text NOT NULL,        -- 'running' | 'success' | 'partial' | 'failed'
  tables       jsonb,                -- { sales: 142, crm: 30, products: 5, ... }
  error        text,
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz
);
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;

-- Authenticated may read sync_log; only super_admin/admin (via service_role routes) write.
DROP POLICY IF EXISTS sync_log_select ON public.sync_log;
CREATE POLICY sync_log_select ON public.sync_log FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('super_admin','admin'));

-- Grants inherited via existing ALTER DEFAULT PRIVILEGES; make service_role explicit anyway.
GRANT SELECT, INSERT, UPDATE ON public.sync_log TO service_role;
GRANT SELECT ON public.sync_log TO authenticated;

-- Verification:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name='sales' AND column_name IN ('origin','wms_id');  -- expect 2 rows
--   SELECT indexname FROM pg_indexes WHERE indexname='sales_wms_uniq'; -- expect 1 row

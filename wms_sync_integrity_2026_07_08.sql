-- wms_sync_integrity_2026_07_08.sql — run in Supabase SQL editor (production) after review.
-- Adds `synced_at` so WMS scope-replace can upsert the fresh pull FIRST, then delete only
-- the rows a sync run did NOT touch — instead of deleting the whole date range up front.
-- Companion code fix: src/lib/wms/sync.ts + serverPorts.ts. Fixes two bugs from the
-- 2026-07-08 audit:
--   - an empty fresh pull used to skip cleanup too (rows.length===0 short-circuited before
--     the delete), so orders that got cancelled/reclassified upstream kept counting as
--     revenue forever;
--   - delete used to commit BEFORE the upsert, so a failed/partial upsert left a committed
--     data hole for that whole date range. Now the delete only runs after upsert succeeds,
--     and only removes rows this run did not just (re)write.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sales','crm','google_ads','meta_ads'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS synced_at timestamptz', t);
  END LOOP;
END $$;

-- Verification:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name='sales' AND column_name='synced_at';  -- expect 1 row

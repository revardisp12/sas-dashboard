-- wms_sync_log_concurrency_guard.sql — run in Supabase SQL editor (production) AFTER review.
--
-- Closes a residual race in the app-level concurrency guard (LogPort.hasRunningSync in
-- src/lib/wms/sync.ts): that guard's SELECT check and the subsequent INSERT that marks a run
-- 'running' are two separate round-trips, not one atomic operation. Two triggers landing
-- within the same tens-of-milliseconds window (most plausibly two webhook deliveries) can
-- both pass the SELECT before either's INSERT commits, both proceed, and race the
-- scope-replace delete step exactly as before this guard existed.
--
-- This unique index makes the SECOND insert fail instead, with a real DB-level guarantee.
-- The app (src/lib/wms/serverPorts.ts logPort.start) catches that specific unique-violation
-- and turns it into a clean 'skipped' result rather than a hard failure.
--
-- Enforces at most ONE sync_log row with status='running' at a time, globally — not scoped
-- per-brand. This is stricter than the app-level guard (which lets two DIFFERENT single-brand
-- runs overlap), but that parallelism isn't actually exercised today: the cron always syncs
-- all 3 brands in one run, so different-brand runs only ever race by accident (e.g. two
-- admins clicking "Sync Now" for two different brands at the same instant), not by design.
-- Serializing that rare case costs nothing worth optimizing for, and a single global
-- constraint is trivial to reason about — a brand-scoped equivalent needs a Postgres
-- EXCLUDE constraint (to express "a null-brand row conflicts with every brand"), which isn't
-- justified for this window.
--
-- IMPORTANT — this index has NO time dimension of its own: it blocks a second 'running' row
-- forever, not just while the first one is genuinely still in flight. A crashed run that never
-- called finish() would therefore permanently brick every future sync (log.start() would keep
-- hitting this constraint forever) if nothing ever cleared that stuck row. That ongoing
-- clearing is NOT this file's job — logPort.hasRunningSync (src/lib/wms/serverPorts.ts)
-- actively reaps any 'running' row older than its 10-minute staleness cutoff on EVERY sync
-- attempt (every cron run, every webhook delivery, every manual click), so a stuck row
-- self-heals well within the hour, continuously, without needing this script run again.
--
-- 0) Pre-flight cleanup (one-time, for THIS migration only): CREATE UNIQUE INDEX fails
-- outright (not just going forward — the CREATE itself errors) if the table already has 2+
-- 'running' rows, which is exactly the "crashed run" scenario above — don't assume it hasn't
-- already happened before this script runs for the first time. Mark anything stuck in
-- 'running' from more than an hour ago (any legitimate run is long since past its 300s
-- function timeout by then) as 'failed' before creating the index below.
UPDATE public.sync_log
SET status = 'failed', error = COALESCE(error, 'marked failed by wms_sync_log_concurrency_guard.sql pre-flight cleanup — stuck in running past any plausible run duration'), finished_at = now()
WHERE status = 'running' AND started_at < now() - interval '1 hour';

CREATE UNIQUE INDEX IF NOT EXISTS sync_log_one_running
  ON public.sync_log (status)
  WHERE status = 'running';

-- Verification:
--   SELECT indexname FROM pg_indexes WHERE indexname='sync_log_one_running'; -- expect 1 row
--   SELECT count(*) FROM public.sync_log WHERE status='running'; -- expect 0 or 1

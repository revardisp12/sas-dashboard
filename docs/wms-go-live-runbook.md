# WMS Go-Live Runbook

When the WMS API token + docs arrive:

1. Implement `src/lib/wms/httpAdapter.ts` — replace each throwing stub method with a
   `fetch()` to `WMS_API_BASE_URL` using `Authorization: Bearer WMS_API_TOKEN`, mapping
   WMS fields → `WithWmsId<RowType>`. The interface contract in `src/lib/wms/types.ts`
   is the spec; the mappers in `src/lib/wms/mappers.ts` already convert those rows into
   DB records (origin='wms', idempotent wms_id).
2. Set Vercel env (all environments): `WMS_API_BASE_URL`, `WMS_API_TOKEN`,
   `WMS_SYNC_ENABLED=live`, and `NEXT_PUBLIC_WMS_MODE=live` (the page badge).
   Keep `WMS_WEBHOOK_SECRET` if using webhooks.
3. Apply `wms_source_of_truth.sql` in the Supabase SQL editor (if not already), then
   enable Realtime replication for `sales` and `crm` (Database → Replication).
4. Deploy to `dev`, open `/wms`, click "Sync Sekarang", verify a `success` row appears
   in the history with non-zero counts and that the numbers match the WMS.
5. If the WMS supports webhooks: register the dashboard webhook `POST /api/wms/webhook`
   with the shared `WMS_WEBHOOK_SECRET`. **Security hardening:** before production, upgrade
   the webhook auth from plain header equality to an HMAC-SHA256 signature of the request
   body compared with `crypto.timingSafeEqual` (guards against replay + timing leaks).
6. Merge `dev` → `main` after preview verification.

## Rollout for the MOCK phase (before the token exists)
1. Run `wms_source_of_truth.sql` in Supabase.
2. Vercel env (all envs): `WMS_SYNC_ENABLED=mock`, `NEXT_PUBLIC_WMS_MODE=mock`,
   `WMS_WEBHOOK_SECRET=<generate>`. Leave `WMS_API_*` empty.
3. Enable Supabase Realtime replication for `sales`, `crm`.
4. Push branch → dev → verify `/wms` works on mock, hourly cron writes mock rows,
   history populates → merge to main.

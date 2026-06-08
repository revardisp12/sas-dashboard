# WMS Source-of-Truth Integration — Design Spec

**Date:** 2026-06-08
**Status:** Approved (brainstorming), pending implementation plan
**Phase:** Output Engine → **Source of Truth (Phase 2)**

## Goal

Make SAS Dashboard **plug-and-play ready** to consume data from the company's
Warehouse Management System (WMS) the moment the WMS exposes its API token and
documentation. Build the entire ingestion pipeline now (triggers, upsert, dedup,
logging, UI) against a mock adapter, so that going live later requires writing
only one adapter file plus configuration — **zero changes to the pipeline**.

## Context (current state)

- Data layer: `src/lib/db.ts` — every source (sales, crm, products, google_ads,
  meta_ads, tiktok_shop, shopee, instagram, tiktok_organic, facebook_organic)
  has `get` / `append` / `replace` functions writing to Supabase tables.
- Server-side ingest pattern already proven: `src/app/api/cron/weekly-digest/route.ts`
  — `CRON_SECRET` bearer auth, `service_role` client, per-brand loop with
  per-brand error isolation (207 on partial), snake_case→camelCase row mappers.
- Brands: `reglow`, `amura`, `purela`.
- All 14 tables RLS-enabled; `ALTER DEFAULT PRIVILEGES` already grants new tables
  to `authenticated` automatically (no more missing-grant 403s).

## Decisions (from brainstorming)

1. **WMS scope (source of truth for):** Sales/Order, Product Master/SKU,
   CRM/Customer, **and Meta + Google Ads performance**. (Ads-from-WMS is unusual
   for a pure warehouse system — to be confirmed against the WMS API when docs
   arrive; if the WMS does not expose ads, those tables stay on the existing
   platform/CSV path and the adapter simply omits `fetchAds`.)
2. **API knowledge:** None yet. WMS being prepared; token + docs not released.
   → design around a generic adapter seam, fill in WMS specifics later.
3. **Sync model:** Trigger-agnostic. One ingest core fed by (a) scheduled cron
   pull [always works], (b) webhook endpoint [activate when WMS supports push],
   (c) manual "Sync Now" button. Plus Supabase Realtime on the read side for
   live UI updates.
4. **Manual input:** Kept as a fallback (not removed). Requires provenance
   tagging (`origin`) to distinguish WMS vs manual rows and avoid WMS-vs-WMS
   double counting.

## Architecture — the adapter seam

The key to "ready before the token" is separating **what the dashboard needs**
from **how the WMS provides it**, via one interface:

```
3 TRIGGERS ──▶ INGEST CORE (fetch→map→upsert) ──▶ Supabase tables ──▶ Dashboard
 • cron pull        │ calls                          (idempotent         (Realtime
 • webhook          ▼                                 upsert by key)       live update)
 • Sync Now   WmsAdapter (interface)
                fetchSales(brand, range)
                fetchProducts(brand)
                fetchCRM(brand, range)
                fetchAds(brand, range)   ← may be omitted if WMS lacks ads
                    │ implements
        ┌───────────┴────────────┐
   MockWmsAdapter            HttpWmsAdapter
   (fake data, used NOW,     (HTTP + real WMS field
    fully tested)             mapping, written LATER)
```

`WmsAdapter` returns the **dashboard's existing row types** (`SalesRow`,
`ProductMaster`, `CRMRow`, `GoogleAdsRow`, `MetaAdsRow`). Today we implement
`MockWmsAdapter`; the whole pipeline is built and tested against it. When the
token + docs arrive, we write `HttpWmsAdapter` (HTTP calls + WMS-field → row-type
mapping) and flip one env var. Only one new file is WMS-specific.

## Data model changes

Applied via a `wms_source_of_truth.sql` migration (run in Supabase SQL editor).

**1. `origin` column** on `sales`, `crm`, `products`, `google_ads`, `meta_ads`:
```sql
ALTER TABLE sales ADD COLUMN origin TEXT NOT NULL DEFAULT 'manual'; -- 'wms'|'manual'|'csv'
```
Existing rows default to `'manual'` (non-destructive). Powers UI badges + filters.

**2. `wms_id` natural key** for idempotent upsert:
```sql
ALTER TABLE sales ADD COLUMN wms_id TEXT;  -- WMS record id; NULL for manual rows
CREATE UNIQUE INDEX sales_wms_uniq ON sales (brand, wms_id) WHERE wms_id IS NOT NULL;
```
WMS sync uses `upsert ON CONFLICT (brand, wms_id)` → re-pulling the same dates
never double-counts. This also closes the deferred "append double-count" debt for
WMS-sourced data. Manual rows have `wms_id = NULL` and are exempt from the
constraint, so manual and WMS rows coexist.

**3. `sync_log` table** (observability):
```sql
CREATE TABLE sync_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger      text NOT NULL,        -- 'cron' | 'webhook' | 'manual'
  triggered_by text,                 -- user email when manual
  status       text NOT NULL,        -- 'running' | 'success' | 'partial' | 'failed'
  tables       jsonb,                -- { sales: 142, crm: 30, products: 5, ... }
  error        text,
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz
);
```
RLS + grants inherited automatically via existing `ALTER DEFAULT PRIVILEGES`.

**Dedup note:** WMS-vs-WMS is safe (unique key). Manual-vs-WMS share no key, so no
auto-merge — WMS is authoritative, manual rows are tagged `origin='manual'` and
shown separately/badged. A future reconciliation view can clean up manual rows
later covered by WMS. This is the accepted trade-off of keeping manual input.

## Ingest core + triggers

**`src/lib/wms/sync.ts` — `runWmsSync(adapter, supabase, opts)`** (one function,
all triggers reuse it):
1. Insert `sync_log` row `status='running'`.
2. Per brand, per enabled table: `rows = await adapter.fetchX(brand, range)`
   (the only WMS-touching point) → upsert into Supabase
   `ON CONFLICT (brand, wms_id)`, set `origin='wms'`.
3. Update `sync_log` → success/partial/failed + per-table row counts + error.
4. Return summary.

Mirrors `computeForBrand` in the digest cron: per-brand try/catch so one brand's
failure doesn't sink the others (HTTP 207 on partial).

**Three routes, all calling `runWmsSync`:**

| Trigger    | File                                   | Auth                          | When |
|------------|----------------------------------------|-------------------------------|------|
| Cron pull  | `src/app/api/cron/wms-sync/route.ts`   | `CRON_SECRET` bearer          | Vercel Cron, default hourly |
| Webhook    | `src/app/api/wms/webhook/route.ts`     | `WMS_WEBHOOK_SECRET` (HMAC/header) | Idle until WMS supports push |
| Sync Now   | `src/app/api/wms/sync/route.ts`        | Supabase session, super_admin/admin | User clicks button |

**Env vars:**
```
WMS_API_BASE_URL      # WMS endpoint (filled later)
WMS_API_TOKEN         # WMS token (the thing being awaited)
WMS_WEBHOOK_SECRET    # verify pushes from WMS
WMS_SYNC_ENABLED      # 'mock' (now) | 'live' (when token ready) — selects adapter
```
`WMS_SYNC_ENABLED` is the single switch from mock to live.

**Cron interval / Vercel plan:** Vercel Cron granularity + invocation limits depend
on plan. Near-realtime (every few minutes) realistically needs Pro. Default to
hourly; webhook (when available) gives true realtime without hammering cron.
Confirm interval + plan at implementation time.

## Frontend

**1. `/wms` page** (sidebar, gated super_admin/admin):
- Last sync status (from `sync_log`): "Sync terakhir: 5m lalu ✓ · 142 sales, 30 CRM…"
- "Sync Sekarang" button → `/api/wms/sync` → spinner → result.
- Sync history table (from `sync_log`): time, trigger, status, rows, error.
- Mode badge: "MODE: MOCK" now vs "MODE: LIVE" when token is set.

**2. Supabase Realtime** — open dashboards subscribe to changes on the active
brand's tables; on new rows, re-invoke existing `loadData(brand)` → charts update
without refresh. Reuses current state management; one thin realtime hook.

**3. `origin` badges** — Sales/CRM/Product tables show a "WMS" vs "Manual" badge;
optional filter (All / WMS / Manual). Manual forms stay active (per decision) with
a hint that WMS also supplies this data.

No new frontend abstractions beyond the `/wms` page + one realtime hook.

## Built now vs later

**Now (no real WMS):** SQL migration; `WmsAdapter` interface + `MockWmsAdapter`;
`runWmsSync` core; 3 routes; Vercel cron entry (runs on mock); `/wms` page +
Realtime hook + origin badges; full unit tests.

**Later (token + docs):** `HttpWmsAdapter` (~1 file); set `WMS_API_BASE_URL` +
`WMS_API_TOKEN`, flip `WMS_SYNC_ENABLED=live`; optional webhook URL + secret;
live smoke test. Estimated ~half a day to go live.

## Testing strategy

Because the core is tested against `MockWmsAdapter`, we assert behavior that's hard
to test against a live API:
- **Idempotency:** fetch 100 rows → upsert → fetch same → still 100, not 200.
- **Merge:** WMS order + identical manual row → both present, tagged differently.
- **Error isolation:** 1 brand errors → other 2 still sync, status=`partial`.
- **Auth gating:** each route rejects unauthenticated/under-privileged callers.

`HttpWmsAdapter` later only needs to satisfy the same interface contract — all
guarantees already stand.

## Build sequence

1. SQL migration + TS types → data foundation.
2. Interface + MockAdapter + ingest core + tests → pipeline proven via tests.
3. 3 routes + auth + cron entry → end-to-end sync (on mock).
4. `/wms` page + sync_log UI → visible + triggerable sync.
5. Supabase Realtime + origin badges → live UI + provenance.
6. README runbook: "how to go live when the token arrives" (5 steps).

**Estimate:** ~4–6 days for the full scaffolding (smaller than Investor Packet —
no PDF/Puppeteer). Go-live later ≈ half a day.

## Out of scope

- The actual `HttpWmsAdapter` implementation (no API docs yet).
- Reconciliation/cleanup view for manual rows superseded by WMS (future).
- Inventory/stock data (not selected for this phase).

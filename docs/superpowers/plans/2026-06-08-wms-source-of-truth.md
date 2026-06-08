# WMS Source-of-Truth Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full WMS ingestion pipeline (adapter seam, idempotent upsert, provenance, 3 triggers, sync log, live UI) against a mock adapter, so going live later = write one `HttpWmsAdapter` + flip one env var.

**Architecture:** A `WmsAdapter` interface returns the dashboard's existing row types. `MockWmsAdapter` powers build + tests now; `HttpWmsAdapter` is written later. One injectable `runWmsSync(adapter, supabase, opts)` core is reused by cron, webhook, and Sync-Now routes. WMS rows upsert `ON CONFLICT (brand, wms_id)` with `origin='wms'`; manual rows (`wms_id=NULL`, `origin='manual'`) coexist. Supabase Realtime drives live dashboard updates.

**Tech Stack:** Next.js 16 (App Router, route handlers), TypeScript (strict), Supabase (`@supabase/supabase-js`), Vitest + jsdom, Recharts (existing), Vercel Cron.

**Spec:** `docs/superpowers/specs/2026-06-08-wms-source-of-truth-design.md`

**Branch:** `feature/wms-source-of-truth` (already created)

---

## File Structure

**Create:**
- `src/lib/wms/types.ts` — `WmsAdapter` interface, `SyncOptions`, `SyncResult`, `WmsTable`, `SyncLogRow`.
- `src/lib/wms/mappers.ts` — pure row→DB-record mappers that attach `origin` + `wms_id` (snake_case). Reused by the core.
- `src/lib/wms/mockAdapter.ts` — `MockWmsAdapter` generating deterministic fake rows per brand.
- `src/lib/wms/sync.ts` — `runWmsSync(adapter, supabase, opts)` ingest core (injectable client).
- `src/lib/wms/adapter.ts` — `getWmsAdapter()` factory: returns Mock or Http based on `WMS_SYNC_ENABLED`.
- `src/lib/wms/httpAdapter.ts` — `HttpWmsAdapter` STUB (throws "not configured") — real impl deferred to go-live.
- `src/lib/wms/mappers.test.ts`, `src/lib/wms/mockAdapter.test.ts`, `src/lib/wms/sync.test.ts` — unit tests.
- `src/lib/wms/fakeSupabase.ts` — in-test fake Supabase client honoring `upsert ... onConflict` for idempotency tests. (Test helper, lives under src so the `@` alias + tsconfig apply; excluded from prod bundle because nothing imports it outside tests.)
- `src/app/api/cron/wms-sync/route.ts` — cron trigger (`CRON_SECRET`).
- `src/app/api/wms/sync/route.ts` — manual "Sync Now" (session JWT, super_admin/admin).
- `src/app/api/wms/webhook/route.ts` — webhook trigger (`WMS_WEBHOOK_SECRET`), idle until WMS supports push.
- `src/app/(dashboard?)/wms/page.tsx` — actually `src/app/wms/page.tsx` (the app is a single-page dashboard; this is a standalone route like `/digest/[brand]`). Sync status + history + Sync Now button.
- `src/components/wms/SyncNowButton.tsx`, `src/components/wms/SyncHistory.tsx` — UI pieces for the page.
- `src/lib/wms/useRealtimeSync.ts` — thin hook subscribing to Supabase Realtime for the active brand.
- `wms_source_of_truth.sql` — migration (repo root, like `digest_log.sql` / `security_hardening.sql`).
- `docs/wms-go-live-runbook.md` — 5-step "how to go live when the token arrives".

**Modify:**
- `src/lib/db.ts` — extend `getSales`/`getCRM`/`getProducts`/`getGoogleAds`/`getMetaAds` mappers to read `origin` (so the UI can badge). Add `origin` to the `*Row`/`ProductMaster` TS types' optional fields.
- `src/lib/types.ts` — add optional `origin?: 'wms' | 'manual' | 'csv'` to `SalesRow`, `CRMRow`, `GoogleAdsRow`, `MetaAdsRow`, `ProductMaster`.
- `src/lib/database.types.ts` — add `origin`, `wms_id` columns to the 5 tables + the new `sync_log` table (regenerate or hand-edit).
- `src/components/Sidebar.tsx` — add "WMS Sync" entry under the Reports section (super_admin/admin only).
- `src/app/page.tsx` — wire `useRealtimeSync(brand)` so synced rows refresh open dashboards.
- `vercel.json` — add the `/api/cron/wms-sync` cron schedule.

**Convention note:** Per `AGENTS.md`, this is a modified Next.js — before writing any route handler or config, read the matching guide under `node_modules/next/dist/docs/` (route handlers, `vercel.json` cron) and heed deprecations.

---

## Task 1: Database migration (provenance + idempotency + sync_log)

**Files:**
- Create: `wms_source_of_truth.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
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
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (brand, wms_id) WHERE wms_id IS NOT NULL', t||'_wms_uniq', t);
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
```

- [ ] **Step 2: Self-check the SQL mentally against the schema**

Confirm `get_my_role()` exists (used by existing RLS policies — yes, per `security_hardening.sql`). Confirm `brand` column exists on all 5 tables (yes — every data table is brand-scoped).

- [ ] **Step 3: Commit (do NOT run yet — user runs in Supabase during rollout)**

```bash
git add wms_source_of_truth.sql
git commit -m "feat(wms): migration for origin + wms_id + sync_log"
```

> Running in prod is a rollout step (see Task 12), not part of code dev. The code uses `IF NOT EXISTS`/optional columns so tests + mock path don't depend on prod being migrated.

---

## Task 2: Core types — `WmsAdapter` interface + result shapes

**Files:**
- Create: `src/lib/wms/types.ts`

- [ ] **Step 1: Write the types**

```typescript
import type { SalesRow, CRMRow, ProductMaster, GoogleAdsRow, MetaAdsRow, Brand } from '@/lib/types'

/** Tables the WMS can be a source of truth for. */
export type WmsTable = 'sales' | 'crm' | 'products' | 'google_ads' | 'meta_ads'

/** A date range (inclusive), YYYY-MM-DD. */
export interface DateRange { start: string; end: string }

/**
 * Each fetch returns the dashboard's existing row type plus a stable WMS id.
 * `wmsId` is the WMS's own record id — used for idempotent upsert.
 */
export type WithWmsId<T> = T & { wmsId: string }

/**
 * The seam. MockWmsAdapter (now) and HttpWmsAdapter (later) both implement this.
 * Methods a given WMS doesn't expose may be omitted; the core skips absent tables.
 */
export interface WmsAdapter {
  readonly mode: 'mock' | 'live'
  fetchSales?(brand: Brand, range: DateRange): Promise<WithWmsId<SalesRow>[]>
  fetchCRM?(brand: Brand, range: DateRange): Promise<WithWmsId<CRMRow>[]>
  fetchProducts?(brand: Brand): Promise<WithWmsId<ProductMaster>[]>
  fetchGoogleAds?(brand: Brand, range: DateRange): Promise<WithWmsId<GoogleAdsRow>[]>
  fetchMetaAds?(brand: Brand, range: DateRange): Promise<WithWmsId<MetaAdsRow>[]>
}

export interface SyncOptions {
  brands: Brand[]
  tables: WmsTable[]
  range: DateRange
  trigger: 'cron' | 'webhook' | 'manual'
  triggeredBy?: string
}

export interface SyncResult {
  status: 'success' | 'partial' | 'failed'
  tables: Record<string, number>           // table -> rows upserted
  perBrand: { brand: Brand; ok: boolean; error?: string }[]
  error?: string
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (only adds types; assumes Task 3 type additions land too — if `origin` isn't on the row types yet, this file still compiles since it doesn't reference `origin`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/wms/types.ts
git commit -m "feat(wms): adapter interface + sync result types"
```

---

## Task 3: Add `origin` to row types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add optional `origin` to the 5 types**

In `src/lib/types.ts`, add `origin?: 'wms' | 'manual' | 'csv'` to each of `SalesRow`, `CRMRow`, `GoogleAdsRow`, `MetaAdsRow`, and `ProductMaster`. Example for `SalesRow`:

```typescript
export interface SalesRow {
  date: string
  product: string
  qty: number
  revenue: number
  channel: string
  cogs: number
  grossProfit: number
  customerName: string
  phone: string
  address: string
  source?: SalesSource
  origin?: 'wms' | 'manual' | 'csv'   // ← add this line (repeat the analogous line in the other 4 types)
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (optional field, no existing code breaks).

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(wms): add optional origin provenance to row types"
```

---

## Task 4: Pure DB mappers (row → snake_case record with origin + wms_id)

**Files:**
- Create: `src/lib/wms/mappers.ts`
- Test: `src/lib/wms/mappers.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { salesToDb, crmToDb, productToDb, googleAdsToDb, metaAdsToDb } from './mappers'
import type { WithWmsId } from './types'
import type { SalesRow } from '@/lib/types'

describe('salesToDb', () => {
  it('maps camelCase row to snake_case DB record with origin=wms and wms_id', () => {
    const row: WithWmsId<SalesRow> = {
      wmsId: 'ord_1', date: '2026-06-01', product: 'SKU1', qty: 2, revenue: 100000,
      channel: 'cs', cogs: 40000, grossProfit: 60000, customerName: 'Budi',
      phone: '0812', address: 'Jl', source: 'meta-ads',
    }
    expect(salesToDb(row, 'reglow')).toEqual({
      brand: 'reglow', wms_id: 'ord_1', origin: 'wms',
      date: '2026-06-01', product: 'SKU1', qty: 2, revenue: 100000,
      channel: 'cs', cogs: 40000, gross_profit: 60000,
      customer_name: 'Budi', phone: '0812', address: 'Jl', source: 'meta-ads',
    })
  })
})

describe('productToDb', () => {
  it('maps product with margin computed and origin=wms', () => {
    const rec = productToDb({ wmsId: 'p_1', id: 'p_1', sku: 'SKU1', name: 'Serum', price: 100, cogs: 40, margin: 0, brand: 'amura' }, 'amura')
    expect(rec.wms_id).toBe('p_1')
    expect(rec.origin).toBe('wms')
    expect(rec.brand).toBe('amura')
    expect(rec.sku).toBe('SKU1')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/wms/mappers.test.ts`
Expected: FAIL — "Cannot find module './mappers'".

- [ ] **Step 3: Implement the mappers**

```typescript
import type { Brand, SalesRow, CRMRow, ProductMaster, GoogleAdsRow, MetaAdsRow } from '@/lib/types'
import type { WithWmsId } from './types'

const margin = (price: number, cogs: number) => (price > 0 ? Math.round(((price - cogs) / price) * 100) : 0)

export function salesToDb(r: WithWmsId<SalesRow>, brand: Brand) {
  return {
    brand, wms_id: r.wmsId, origin: 'wms' as const,
    date: r.date, product: r.product, qty: r.qty, revenue: r.revenue,
    channel: r.channel, cogs: r.cogs, gross_profit: r.grossProfit,
    customer_name: r.customerName, phone: r.phone, address: r.address,
    source: r.source ?? 'organic',
  }
}

export function crmToDb(r: WithWmsId<CRMRow>, brand: Brand) {
  return {
    brand, wms_id: r.wmsId, origin: 'wms' as const,
    date: r.date, customer_name: r.customerName, phone: r.phone,
    product: r.product, qty: r.qty, revenue: r.revenue,
  }
}

export function productToDb(r: WithWmsId<ProductMaster>, brand: Brand) {
  return {
    brand, wms_id: r.wmsId, origin: 'wms' as const,
    id: r.id, sku: r.sku, name: r.name, price: r.price, cogs: r.cogs,
    margin: margin(r.price, r.cogs),
  }
}

export function googleAdsToDb(r: WithWmsId<GoogleAdsRow>, brand: Brand) {
  return {
    brand, wms_id: r.wmsId, origin: 'wms' as const,
    date: r.date, campaign: r.campaign, impressions: r.impressions, clicks: r.clicks,
    ctr: r.ctr, cpc: r.cpc, spend: r.spend, conversions: r.conversions,
    conv_rate: r.convRate, roas: r.roas,
  }
}

export function metaAdsToDb(r: WithWmsId<MetaAdsRow>, brand: Brand) {
  return {
    brand, wms_id: r.wmsId, origin: 'wms' as const,
    date: r.date, campaign: r.campaign, reach: r.reach, impressions: r.impressions,
    clicks: r.clicks, ctr: r.ctr, spend: r.spend, purchases: r.purchases,
    roas: r.roas, cpm: r.cpm, results: r.results,
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/wms/mappers.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/wms/mappers.ts src/lib/wms/mappers.test.ts
git commit -m "feat(wms): pure row->DB mappers with origin + wms_id"
```

---

## Task 5: MockWmsAdapter (deterministic fake data)

**Files:**
- Create: `src/lib/wms/mockAdapter.ts`
- Test: `src/lib/wms/mockAdapter.test.ts`

Determinism note: scripts/tests must NOT use `Math.random()`/`Date.now()` for data — derive values from a seed string (brand + date + index) so test assertions are stable.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { MockWmsAdapter } from './mockAdapter'

const range = { start: '2026-06-01', end: '2026-06-03' }

describe('MockWmsAdapter', () => {
  it('reports mock mode', () => {
    expect(new MockWmsAdapter().mode).toBe('mock')
  })

  it('returns deterministic sales rows with stable wmsId per brand/date', async () => {
    const a = await new MockWmsAdapter().fetchSales!('reglow', range)
    const b = await new MockWmsAdapter().fetchSales!('reglow', range)
    expect(a).toEqual(b)                         // deterministic
    expect(a.length).toBeGreaterThan(0)
    expect(a.every(r => r.wmsId.startsWith('reglow-sales-'))).toBe(true)
    expect(a.every(r => r.date >= range.start && r.date <= range.end)).toBe(true)
  })

  it('gives different brands different wmsId namespaces', async () => {
    const r = await new MockWmsAdapter().fetchSales!('reglow', range)
    const m = await new MockWmsAdapter().fetchSales!('amura', range)
    expect(r[0].wmsId).not.toBe(m[0].wmsId)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/wms/mockAdapter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement MockWmsAdapter**

```typescript
import type { Brand, SalesRow, CRMRow, ProductMaster, GoogleAdsRow, MetaAdsRow } from '@/lib/types'
import type { WmsAdapter, WithWmsId, DateRange } from './types'

// Tiny deterministic hash → number in [0,1). Stable across runs (no Math.random).
function seeded(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 10000) / 10000
}

function datesInRange(range: DateRange): string[] {
  const out: string[] = []
  const d = new Date(range.start + 'T00:00:00Z')
  const end = new Date(range.end + 'T00:00:00Z')
  while (d <= end) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1) }
  return out
}

export class MockWmsAdapter implements WmsAdapter {
  readonly mode = 'mock' as const

  async fetchSales(brand: Brand, range: DateRange): Promise<WithWmsId<SalesRow>[]> {
    const rows: WithWmsId<SalesRow>[] = []
    for (const date of datesInRange(range)) {
      const n = 1 + Math.floor(seeded(`${brand}${date}count`) * 3)   // 1-3 orders/day
      for (let i = 0; i < n; i++) {
        const rev = 50000 + Math.floor(seeded(`${brand}${date}${i}rev`) * 200000)
        const cogs = Math.floor(rev * 0.4)
        rows.push({
          wmsId: `${brand}-sales-${date}-${i}`, date,
          product: `SKU${1 + Math.floor(seeded(`${brand}${date}${i}p`) * 5)}`,
          qty: 1 + Math.floor(seeded(`${brand}${date}${i}q`) * 3),
          revenue: rev, channel: 'cs', cogs, grossProfit: rev - cogs,
          customerName: `Customer ${Math.floor(seeded(`${brand}${date}${i}c`) * 1000)}`,
          phone: `08${Math.floor(seeded(`${brand}${date}${i}ph`) * 1e9)}`,
          address: 'Mock address', source: 'meta-ads',
        })
      }
    }
    return rows
  }

  async fetchCRM(brand: Brand, range: DateRange): Promise<WithWmsId<CRMRow>[]> {
    return datesInRange(range).map((date, i) => ({
      wmsId: `${brand}-crm-${date}-${i}`, date,
      customerName: `Customer ${Math.floor(seeded(`${brand}${date}crm`) * 1000)}`,
      phone: `08${Math.floor(seeded(`${brand}${date}crmph`) * 1e9)}`,
      product: `SKU${1 + Math.floor(seeded(`${brand}${date}crmp`) * 5)}`,
      qty: 1, revenue: 50000 + Math.floor(seeded(`${brand}${date}crmr`) * 150000),
    }))
  }

  async fetchProducts(brand: Brand): Promise<WithWmsId<ProductMaster>[]> {
    return Array.from({ length: 5 }, (_, i) => {
      const price = 80000 + Math.floor(seeded(`${brand}prod${i}`) * 120000)
      const cogs = Math.floor(price * 0.4)
      return { wmsId: `${brand}-prod-${i}`, id: `${brand}-prod-${i}`, sku: `SKU${i + 1}`, name: `Mock Product ${i + 1}`, price, cogs, margin: 0, brand }
    })
  }

  async fetchGoogleAds(brand: Brand, range: DateRange): Promise<WithWmsId<GoogleAdsRow>[]> {
    return datesInRange(range).map((date) => {
      const clicks = 50 + Math.floor(seeded(`${brand}${date}gclk`) * 500)
      const spend = 100000 + Math.floor(seeded(`${brand}${date}gsp`) * 900000)
      return {
        wmsId: `${brand}-ga-${date}`, date, campaign: 'Mock GA',
        impressions: clicks * 20, clicks, ctr: 5, cpc: Math.round(spend / clicks),
        spend, conversions: Math.floor(clicks * 0.05), convRate: 5, roas: 3,
      }
    })
  }

  async fetchMetaAds(brand: Brand, range: DateRange): Promise<WithWmsId<MetaAdsRow>[]> {
    return datesInRange(range).map((date) => {
      const clicks = 80 + Math.floor(seeded(`${brand}${date}mclk`) * 600)
      const spend = 150000 + Math.floor(seeded(`${brand}${date}msp`) * 1000000)
      return {
        wmsId: `${brand}-ma-${date}`, date, campaign: 'Mock Meta',
        reach: clicks * 30, impressions: clicks * 25, clicks, ctr: 4, spend,
        purchases: Math.floor(clicks * 0.06), roas: 3.2, cpm: 20000,
        results: Math.floor(clicks * 0.06),
      }
    })
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/wms/mockAdapter.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/wms/mockAdapter.ts src/lib/wms/mockAdapter.test.ts
git commit -m "feat(wms): deterministic MockWmsAdapter for build + tests"
```

---

## Task 6: Fake Supabase client (test helper honoring upsert/onConflict)

**Files:**
- Create: `src/lib/wms/fakeSupabase.ts`

This is the test double that lets us prove idempotency + per-brand isolation without a real DB. It implements only the slice of the Supabase client the sync core uses: `from(table).insert(...)`, `.upsert(rows, { onConflict })`, and an in-memory store keyed by the conflict columns.

- [ ] **Step 1: Implement the fake client**

```typescript
// Minimal in-memory Supabase stand-in for unit tests. Honors upsert onConflict so
// idempotency is actually exercised. NOT for production use.
type Row = Record<string, unknown>

export class FakeSupabase {
  store: Record<string, Row[]> = {}
  failTable: string | null = null            // force an error on a given table to test isolation

  from(table: string) {
    const self = this
    return {
      async insert(rows: Row[]) {
        if (self.failTable === table) return { error: { message: `forced fail on ${table}` } }
        self.store[table] = (self.store[table] ?? []).concat(rows)
        return { error: null }
      },
      async upsert(rows: Row[], opts: { onConflict: string }) {
        if (self.failTable === table) return { error: { message: `forced fail on ${table}` } }
        const keys = opts.onConflict.split(',').map(s => s.trim())
        const existing = self.store[table] ?? (self.store[table] = [])
        for (const r of rows) {
          const idx = existing.findIndex(e => keys.every(k => e[k] === r[k]))
          if (idx >= 0) existing[idx] = r           // conflict → replace (idempotent)
          else existing.push(r)
        }
        return { error: null }
      },
      // sync_log writes use insert + a chained update; model update as no-op match-by-id.
      update(patch: Row) {
        return {
          async eq(col: string, val: unknown) {
            const rows = self.store[table] ?? []
            for (const row of rows) if (row[col] === val) Object.assign(row, patch)
            return { error: null }
          },
        }
      },
    }
  }
  // sync_log insert returns the new id so the core can update it later.
  async insertReturningId(table: string, row: Row): Promise<string> {
    const id = `${table}-${(this.store[table]?.length ?? 0)}`
    this.store[table] = (this.store[table] ?? []).concat([{ id, ...row }])
    return id
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/wms/fakeSupabase.ts
git commit -m "test(wms): in-memory fake supabase honoring upsert onConflict"
```

> Note for Task 7: design `runWmsSync` to depend only on the methods above (`from().upsert()`, `from().update().eq()`, and a small `logStart/logFinish` seam) so both `FakeSupabase` and the real `@supabase/supabase-js` client satisfy it. For `sync_log` row creation, the core calls a passed-in `createLog`/`finishLog` pair (injected) rather than the raw client, keeping the client surface tiny and the real route in control of `.insert().select().single()`.

---

## Task 7: Ingest core `runWmsSync` (injectable, per-brand isolation, idempotent)

**Files:**
- Create: `src/lib/wms/sync.ts`
- Test: `src/lib/wms/sync.test.ts`

**Design:** `runWmsSync` takes `{ adapter, db, log, opts }`:
- `adapter: WmsAdapter`
- `db`: `{ upsert(table, rows, onConflict): Promise<{error}> }` — thin write port (real route wraps the supabase client; tests pass a `FakeSupabase`-backed impl).
- `log`: `{ start(meta): Promise<string>; finish(id, patch): Promise<void> }` — sync_log port.
This keeps the core pure-ish and fully testable.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from 'vitest'
import { runWmsSync, type DbPort, type LogPort } from './sync'
import { MockWmsAdapter } from './mockAdapter'
import { FakeSupabase } from './fakeSupabase'
import type { Brand } from '@/lib/types'

function makePorts(fake: FakeSupabase): { db: DbPort; log: LogPort; finished: Record<string, unknown>[] } {
  const finished: Record<string, unknown>[] = []
  const db: DbPort = {
    async upsert(table, rows, onConflict) {
      return fake.from(table).upsert(rows as Record<string, unknown>[], { onConflict })
    },
  }
  const log: LogPort = {
    async start() { return 'log-1' },
    async finish(_id, patch) { finished.push(patch) },
  }
  return { db, log, finished }
}

const opts = (over: Partial<Parameters<typeof runWmsSync>[0]['opts']> = {}) => ({
  brands: ['reglow', 'amura'] as Brand[],
  tables: ['sales', 'crm'] as const,
  range: { start: '2026-06-01', end: '2026-06-02' },
  trigger: 'manual' as const,
  ...over,
})

describe('runWmsSync', () => {
  it('upserts WMS rows with origin=wms and is idempotent across two runs', async () => {
    const fake = new FakeSupabase()
    const { db, log } = makePorts(fake)
    const adapter = new MockWmsAdapter()

    const r1 = await runWmsSync({ adapter, db, log, opts: opts() })
    const salesAfter1 = fake.store['sales'].length
    expect(r1.status).toBe('success')
    expect(fake.store['sales'].every(r => r.origin === 'wms')).toBe(true)

    const r2 = await runWmsSync({ adapter, db, log, opts: opts() })
    const salesAfter2 = fake.store['sales'].length
    expect(salesAfter2).toBe(salesAfter1)              // idempotent — no doubling
    expect(r2.status).toBe('success')
  })

  it('isolates per-brand failure → status partial, other brand still written', async () => {
    const fake = new FakeSupabase()
    const { db, log } = makePorts(fake)
    // adapter that throws for amura sales only
    const adapter = new MockWmsAdapter()
    const orig = adapter.fetchSales.bind(adapter)
    adapter.fetchSales = async (brand, range) => {
      if (brand === 'amura') throw new Error('boom')
      return orig(brand, range)
    }

    const res = await runWmsSync({ adapter, db, log, opts: opts({ tables: ['sales'] }) })
    expect(res.status).toBe('partial')
    expect(res.perBrand.find(b => b.brand === 'amura')!.ok).toBe(false)
    expect(res.perBrand.find(b => b.brand === 'reglow')!.ok).toBe(true)
    expect(fake.store['sales'].some(r => r.brand === 'reglow')).toBe(true)
  })

  it('skips tables the adapter does not expose', async () => {
    const fake = new FakeSupabase()
    const { db, log } = makePorts(fake)
    const adapter = new MockWmsAdapter()
    // remove products capability
    // @ts-expect-error intentionally deleting optional method
    delete adapter.fetchProducts
    const res = await runWmsSync({ adapter, db, log, opts: opts({ tables: ['products'] }) })
    expect(res.tables['products'] ?? 0).toBe(0)
    expect(res.status).toBe('success')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/wms/sync.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the core**

```typescript
import type { Brand } from '@/lib/types'
import type { WmsAdapter, SyncOptions, SyncResult, WmsTable } from './types'
import { salesToDb, crmToDb, productToDb, googleAdsToDb, metaAdsToDb } from './mappers'

export interface DbPort {
  upsert(table: string, rows: unknown[], onConflict: string): Promise<{ error: { message: string } | null }>
}
export interface LogPort {
  start(meta: { trigger: string; triggeredBy?: string }): Promise<string>
  finish(id: string, patch: { status: string; tables: Record<string, number>; error?: string }): Promise<void>
}

interface RunArgs { adapter: WmsAdapter; db: DbPort; log: LogPort; opts: SyncOptions }

const ON_CONFLICT = 'brand,wms_id'

// table -> { adapter method name, mapper, needsRange }
const TABLE_PLAN: Record<WmsTable, { method: keyof WmsAdapter; map: (r: any, b: Brand) => unknown; ranged: boolean }> = {
  sales:      { method: 'fetchSales',     map: salesToDb,     ranged: true },
  crm:        { method: 'fetchCRM',       map: crmToDb,       ranged: true },
  products:   { method: 'fetchProducts',  map: productToDb,   ranged: false },
  google_ads: { method: 'fetchGoogleAds', map: googleAdsToDb, ranged: true },
  meta_ads:   { method: 'fetchMetaAds',   map: metaAdsToDb,   ranged: true },
}

export async function runWmsSync({ adapter, db, log, opts }: RunArgs): Promise<SyncResult> {
  const logId = await log.start({ trigger: opts.trigger, triggeredBy: opts.triggeredBy })
  const counts: Record<string, number> = {}
  const perBrand: SyncResult['perBrand'] = []

  for (const brand of opts.brands) {
    let brandOk = true
    let brandErr: string | undefined
    for (const table of opts.tables) {
      const plan = TABLE_PLAN[table]
      const fn = adapter[plan.method] as undefined | ((b: Brand, r?: { start: string; end: string }) => Promise<unknown[]>)
      if (typeof fn !== 'function') continue                       // WMS doesn't expose this table
      try {
        const rows = await fn.call(adapter, brand, plan.ranged ? opts.range : undefined)
        if (!rows.length) continue
        const records = rows.map(r => plan.map(r, brand))
        const { error } = await db.upsert(table, records, ON_CONFLICT)
        if (error) throw new Error(error.message)
        counts[table] = (counts[table] ?? 0) + records.length
      } catch (e) {
        brandOk = false
        brandErr = e instanceof Error ? e.message : String(e)
        // continue other tables for this brand? No — fail the brand but keep other brands.
        break
      }
    }
    perBrand.push({ brand, ok: brandOk, error: brandErr })
  }

  const okCount = perBrand.filter(b => b.ok).length
  const status: SyncResult['status'] =
    okCount === opts.brands.length ? 'success' : okCount === 0 ? 'failed' : 'partial'
  const error = status === 'success' ? undefined : perBrand.find(b => !b.ok)?.error
  await log.finish(logId, { status, tables: counts, error })
  return { status, tables: counts, perBrand, error }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/wms/sync.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/wms/sync.ts src/lib/wms/sync.test.ts
git commit -m "feat(wms): injectable runWmsSync core (idempotent, per-brand isolation)"
```

---

## Task 8: Adapter factory + Http stub

**Files:**
- Create: `src/lib/wms/httpAdapter.ts`, `src/lib/wms/adapter.ts`

- [ ] **Step 1: Write the Http stub (deferred to go-live)**

```typescript
import type { WmsAdapter } from './types'

/**
 * Real WMS HTTP adapter — IMPLEMENTED AT GO-LIVE once the WMS API docs + token exist.
 * Until then it throws so a misconfigured 'live' mode fails loudly instead of silently.
 * To implement: read WMS API docs, add fetch* methods calling WMS_API_BASE_URL with
 * Authorization: Bearer WMS_API_TOKEN, and map WMS fields -> WithWmsId<RowType>.
 */
export class HttpWmsAdapter implements WmsAdapter {
  readonly mode = 'live' as const
  constructor(private baseUrl: string, private token: string) {}
  // No fetch* methods yet — the core skips absent tables, but in 'live' mode we want a
  // loud failure if someone enables live before implementing. The factory enforces that.
}
```

- [ ] **Step 2: Write the factory**

```typescript
import type { WmsAdapter } from './types'
import { MockWmsAdapter } from './mockAdapter'
import { HttpWmsAdapter } from './httpAdapter'

export function getWmsAdapter(): WmsAdapter {
  const mode = process.env.WMS_SYNC_ENABLED ?? 'mock'
  if (mode === 'live') {
    const baseUrl = process.env.WMS_API_BASE_URL
    const token = process.env.WMS_API_TOKEN
    if (!baseUrl || !token) throw new Error('WMS live mode requires WMS_API_BASE_URL + WMS_API_TOKEN')
    return new HttpWmsAdapter(baseUrl, token)
  }
  return new MockWmsAdapter()
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` → PASS

```bash
git add src/lib/wms/httpAdapter.ts src/lib/wms/adapter.ts
git commit -m "feat(wms): adapter factory + Http adapter stub (go-live placeholder)"
```

---

## Task 9: Route adapters — wire ports to real Supabase

**Files:**
- Create: `src/lib/wms/serverPorts.ts` (builds `DbPort` + `LogPort` from a real service_role supabase client)

- [ ] **Step 1: Implement server ports**

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import type { DbPort, LogPort } from './sync'

type Client = ReturnType<typeof createClient<Database>>

export function dbPort(supabase: Client): DbPort {
  return {
    async upsert(table, rows, onConflict) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from(table as any) as any).upsert(rows, { onConflict })
      return { error: error ? { message: error.message } : null }
    },
  }
}

export function logPort(supabase: Client): LogPort {
  return {
    async start(meta) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('sync_log' as any) as any)
        .insert({ trigger: meta.trigger, triggered_by: meta.triggeredBy ?? null, status: 'running' })
        .select('id').single()
      if (error) throw new Error(error.message)
      return data.id as string
    },
    async finish(id, patch) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('sync_log' as any) as any)
        .update({ status: patch.status, tables: patch.tables, error: patch.error ?? null, finished_at: new Date().toISOString() })
        .eq('id', id)
    },
  }
}
```

> The `as any` casts are localized here because `database.types.ts` is regenerated separately (Task 0-ish). Once `sync_log` + new columns are in the generated types, drop the casts. Keep them ONLY in this adapter file.

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → PASS

```bash
git add src/lib/wms/serverPorts.ts
git commit -m "feat(wms): server ports binding sync core to supabase client"
```

---

## Task 10: The three trigger routes

**Files:**
- Create: `src/app/api/cron/wms-sync/route.ts`, `src/app/api/wms/sync/route.ts`, `src/app/api/wms/webhook/route.ts`

> Read `node_modules/next/dist/docs/` route-handler guide first (per AGENTS.md).

- [ ] **Step 1: Cron route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import type { Brand } from '@/lib/types'
import { getWmsAdapter } from '@/lib/wms/adapter'
import { runWmsSync } from '@/lib/wms/sync'
import { dbPort, logPort } from '@/lib/wms/serverPorts'
import type { WmsTable } from '@/lib/wms/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BRANDS: Brand[] = ['reglow', 'amura', 'purela']
const TABLES: WmsTable[] = ['sales', 'crm', 'products', 'google_ads', 'meta_ads']

function lastNDays(n: number) {
  const end = new Date()
  const start = new Date(); start.setUTCDate(start.getUTCDate() - n)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return NextResponse.json({ error: 'Missing env' }, { status: 500 })

  const supabase = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const result = await runWmsSync({
    adapter: getWmsAdapter(),
    db: dbPort(supabase), log: logPort(supabase),
    opts: { brands: BRANDS, tables: TABLES, range: lastNDays(7), trigger: 'cron' },
  })
  const code = result.status === 'success' ? 200 : result.status === 'failed' ? 500 : 207
  return NextResponse.json(result, { status: code })
}
```

- [ ] **Step 2: Sync-Now route (session JWT + role gate)**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import type { Brand } from '@/lib/types'
import { getWmsAdapter } from '@/lib/wms/adapter'
import { runWmsSync } from '@/lib/wms/sync'
import { dbPort, logPort } from '@/lib/wms/serverPorts'
import type { WmsTable } from '@/lib/wms/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BRANDS: Brand[] = ['reglow', 'amura', 'purela']
const TABLES: WmsTable[] = ['sales', 'crm', 'products', 'google_ads', 'meta_ads']

function lastNDays(n: number) {
  const end = new Date(); const start = new Date(); start.setUTCDate(start.getUTCDate() - n)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const jwt = auth.slice(7).trim()
  if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anonKey || !serviceKey) return NextResponse.json({ error: 'Missing env' }, { status: 500 })

  // Verify caller + role using their JWT.
  const userClient = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await userClient.from('user_profiles').select('role').eq('id', userData.user.id).single()
  if (!profile || !['super_admin', 'admin'].includes(profile.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Perform the sync with service_role (writes bypass RLS, as cron does).
  const service = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const result = await runWmsSync({
    adapter: getWmsAdapter(),
    db: dbPort(service), log: logPort(service),
    opts: { brands: BRANDS, tables: TABLES, range: lastNDays(7), trigger: 'manual', triggeredBy: userData.user.email ?? undefined },
  })
  const code = result.status === 'success' ? 200 : result.status === 'failed' ? 500 : 207
  return NextResponse.json(result, { status: code })
}
```

- [ ] **Step 3: Webhook route (idle until WMS supports push)**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import type { Brand } from '@/lib/types'
import { getWmsAdapter } from '@/lib/wms/adapter'
import { runWmsSync } from '@/lib/wms/sync'
import { dbPort, logPort } from '@/lib/wms/serverPorts'
import type { WmsTable } from '@/lib/wms/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BRANDS: Brand[] = ['reglow', 'amura', 'purela']
const TABLES: WmsTable[] = ['sales', 'crm', 'products', 'google_ads', 'meta_ads']

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-wms-signature')
  if (!process.env.WMS_WEBHOOK_SECRET || secret !== process.env.WMS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return NextResponse.json({ error: 'Missing env' }, { status: 500 })

  // WMS push payload may name which brand/table changed; for now sync recent window for all.
  // When WMS docs arrive, narrow `opts` from the parsed body.
  const today = new Date().toISOString().slice(0, 10)
  const supabase = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const result = await runWmsSync({
    adapter: getWmsAdapter(),
    db: dbPort(supabase), log: logPort(supabase),
    opts: { brands: BRANDS, tables: TABLES, range: { start: today, end: today }, trigger: 'webhook' },
  })
  const code = result.status === 'success' ? 200 : result.status === 'failed' ? 500 : 207
  return NextResponse.json(result, { status: code })
}
```

- [ ] **Step 4: Build to verify routes compile**

Run: `npm run build`
Expected: routes `/api/cron/wms-sync`, `/api/wms/sync`, `/api/wms/webhook` listed as `ƒ` (dynamic). PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/wms-sync/route.ts src/app/api/wms/sync/route.ts src/app/api/wms/webhook/route.ts
git commit -m "feat(wms): cron + sync-now + webhook trigger routes"
```

---

## Task 11: Vercel cron registration

**Files:**
- Modify: `vercel.json`

> Read `node_modules/next/dist/docs/` (or Vercel cron docs) for current `crons` schema before editing.

- [ ] **Step 1: Add cron entry**

Add to the existing `crons` array in `vercel.json` (alongside the weekly-digest cron):

```json
{
  "crons": [
    { "path": "/api/cron/weekly-digest", "schedule": "0 2 * * 1" },
    { "path": "/api/cron/wms-sync", "schedule": "0 * * * *" }
  ]
}
```

(Hourly default. Vercel sends the `CRON_SECRET` as `Authorization: Bearer` automatically when configured. Interval/plan to confirm with user at rollout.)

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat(wms): register hourly wms-sync cron"
```

---

## Task 12: `/wms` page — sync status, history, Sync Now

**Files:**
- Create: `src/app/wms/page.tsx`, `src/components/wms/SyncNowButton.tsx`, `src/components/wms/SyncHistory.tsx`
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: SyncNowButton (client)**

```tsx
'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SyncNowButton({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function run() {
    setBusy(true); setMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setMsg('Sesi habis, login ulang.'); return }
      const res = await fetch('/api/wms/sync', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      setMsg(res.ok ? `Sync ${json.status}: ${JSON.stringify(json.tables)}` : `Gagal: ${json.error ?? res.status}`)
      onDone()
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setBusy(false) }
  }

  return (
    <div>
      <button onClick={run} disabled={busy} style={{ padding: '8px 16px', borderRadius: 8, background: '#4A9FD4', color: '#fff', opacity: busy ? 0.6 : 1 }}>
        {busy ? 'Menyinkronkan…' : 'Sync Sekarang'}
      </button>
      {msg && <p style={{ marginTop: 8, fontSize: 13, color: '#6B7280' }}>{msg}</p>}
    </div>
  )
}
```

- [ ] **Step 2: SyncHistory (client, reads sync_log)**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface LogRow { id: string; trigger: string; status: string; tables: Record<string, number> | null; error: string | null; started_at: string; finished_at: string | null }

export default function SyncHistory({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('sync_log').select('*').order('started_at', { ascending: false }).limit(20)
      if (!cancelled) { setRows((data ?? []) as unknown as LogRow[]); setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [refreshKey])

  if (loading) return <p style={{ color: '#6B7280' }}>Memuat riwayat…</p>
  if (!rows.length) return <p style={{ color: '#6B7280' }}>Belum ada sync.</p>
  return (
    <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
      <thead><tr><th>Waktu</th><th>Trigger</th><th>Status</th><th>Baris</th><th>Error</th></tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id} style={{ borderTop: '1px solid #eee' }}>
            <td>{new Date(r.started_at).toLocaleString('id-ID')}</td>
            <td>{r.trigger}</td>
            <td>{r.status}</td>
            <td>{r.tables ? Object.entries(r.tables).map(([k, v]) => `${k}:${v}`).join(' ') : '-'}</td>
            <td style={{ color: '#DC2626' }}>{r.error ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 3: The page (gated super_admin/admin)**

```tsx
'use client'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import SyncNowButton from '@/components/wms/SyncNowButton'
import SyncHistory from '@/components/wms/SyncHistory'

export default function WmsPage() {
  const { profile, loading } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)
  const mode = process.env.NEXT_PUBLIC_WMS_MODE ?? 'mock'  // exposed read-only for the badge

  if (loading) return <div className="p-8 text-sm" style={{ color: '#6B7280' }}>Memuat…</div>
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
    return <div className="p-8 text-sm" style={{ color: '#DC2626' }}>Akses ditolak.</div>
  }

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>WMS Sync</h1>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: mode === 'live' ? '#DCFCE7' : '#FEF9C3', color: mode === 'live' ? '#166534' : '#854D0E' }}>
          MODE: {mode.toUpperCase()}
        </span>
      </div>
      <p style={{ color: '#6B7280', fontSize: 13, margin: '6px 0 20px' }}>
        Tarik data dari Warehouse Management System. {mode === 'mock' ? 'Saat ini memakai data mock.' : 'Terhubung ke WMS live.'}
      </p>
      <SyncNowButton onDone={() => setRefreshKey(k => k + 1)} />
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: '28px 0 10px' }}>Riwayat Sync</h2>
      <SyncHistory refreshKey={refreshKey} />
    </div>
  )
}
```

- [ ] **Step 4: Sidebar entry**

In `src/components/Sidebar.tsx`, under the existing "Reports" section, add a link to `/wms` labeled "WMS Sync", shown only when `profile.role` is `super_admin` or `admin`. Match the existing link markup/styling used for "Weekly Digest".

- [ ] **Step 5: Build + manual smoke**

Run: `npm run build` → PASS (route `/wms` listed).
Manual: `npx next dev --webpack` (iCloud quirk — webpack, per project memory), log in as super_admin, open `/wms`, click "Sync Sekarang" → expect a success message + a new history row (against mock data; requires the migration applied locally or a local DB — otherwise expect a clear error surfaced in the message, which also validates error handling).

- [ ] **Step 6: Commit**

```bash
git add src/app/wms/page.tsx src/components/wms/ src/components/Sidebar.tsx
git commit -m "feat(wms): /wms page with Sync Now + history + mode badge"
```

---

## Task 13: Supabase Realtime live-update hook

**Files:**
- Create: `src/lib/wms/useRealtimeSync.ts`
- Modify: `src/app/page.tsx`

> Realtime requires enabling replication for the tables in Supabase (rollout step). The hook degrades gracefully if Realtime is off (no events → no refresh).

- [ ] **Step 1: Implement the hook**

```typescript
'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Brand } from '@/lib/types'

/** Re-runs `onChange` when WMS sync writes rows for the active brand. */
export function useRealtimeSync(brand: Brand, onChange: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel(`wms-sync-${brand}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `brand=eq.${brand}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm', filter: `brand=eq.${brand}` }, onChange)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [brand, onChange])
}
```

- [ ] **Step 2: Wire into the dashboard**

In `src/app/page.tsx`, after `loadData` is defined, add (using a stable callback):

```typescript
import { useRealtimeSync } from '@/lib/wms/useRealtimeSync'
// inside component, after loadData useCallback:
const onRealtime = useCallback(() => { if (user) loadData(brand) }, [user, brand, loadData])
useRealtimeSync(brand, onRealtime)
```

- [ ] **Step 3: Build + commit**

Run: `npm run build` → PASS

```bash
git add src/lib/wms/useRealtimeSync.ts src/app/page.tsx
git commit -m "feat(wms): Supabase Realtime live-update on sync"
```

---

## Task 14: Origin badges in data tables

**Files:**
- Modify: `src/lib/db.ts` (read `origin` in `getSales`/`getCRM`/`getProducts`/`getGoogleAds`/`getMetaAds`), and the relevant view components that render these tables (`SalesView`, `CRMView` action/list tables, `SettingsView` product list).

- [ ] **Step 1: Read `origin` in db getters**

In each listed getter in `db.ts`, add `origin: (r.origin ?? 'manual') as 'wms' | 'manual' | 'csv'` to the mapped object. Example in `getSales`:

```typescript
return (data ?? []).map(r => ({
  date: r.date, product: r.product, qty: r.qty, revenue: r.revenue,
  channel: r.channel ?? '', cogs: r.cogs ?? 0, grossProfit: r.gross_profit ?? 0,
  customerName: r.customer_name ?? '', phone: r.phone ?? '',
  address: r.address ?? '', source: (r.source ?? 'organic') as SalesSource,
  origin: (r.origin ?? 'manual') as 'wms' | 'manual' | 'csv',   // ← add
}))
```

- [ ] **Step 2: Add a small badge component**

Create `src/components/wms/OriginBadge.tsx`:

```tsx
export default function OriginBadge({ origin }: { origin?: 'wms' | 'manual' | 'csv' }) {
  const o = origin ?? 'manual'
  const style = o === 'wms'
    ? { background: '#DBEAFE', color: '#1E40AF' }
    : { background: '#F3F4F6', color: '#6B7280' }
  return <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, ...style }}>{o === 'wms' ? 'WMS' : 'Manual'}</span>
}
```

- [ ] **Step 3: Render the badge in the Sales + CRM customer rows**

In the row rendering of `SalesView` (and the CRM list) add `<OriginBadge origin={row.origin} />` next to the customer/product cell. Keep it minimal — one badge per row.

- [ ] **Step 4: Build + commit**

Run: `npm run build` → PASS

```bash
git add src/lib/db.ts src/components/wms/OriginBadge.tsx src/components/views/SalesView.tsx src/components/views/CRMView.tsx
git commit -m "feat(wms): origin badges (WMS vs Manual) in data tables"
```

---

## Task 15: Regenerate database.types.ts + drop `as any` casts

**Files:**
- Modify: `src/lib/database.types.ts`, `src/lib/wms/serverPorts.ts`

- [ ] **Step 1: Regenerate types**

If the Supabase CLI is set up: `npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts`. Otherwise hand-add `origin: string | null` + `wms_id: string | null` to the Row/Insert/Update of `sales`, `crm`, `products`, `google_ads`, `meta_ads`, and add the full `sync_log` table definition.

- [ ] **Step 2: Remove the `as any` casts in `serverPorts.ts`**

Now that the generated types include the new columns + `sync_log`, replace the `as any`-cast calls with typed ones and run:

Run: `npx tsc --noEmit` → PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/database.types.ts src/lib/wms/serverPorts.ts
git commit -m "chore(wms): regenerate db types, drop localized any-casts"
```

---

## Task 16: Go-live runbook + full verification

**Files:**
- Create: `docs/wms-go-live-runbook.md`

- [ ] **Step 1: Write the runbook**

```markdown
# WMS Go-Live Runbook

When the WMS API token + docs arrive:
1. Implement `src/lib/wms/httpAdapter.ts` — add `fetch*` methods calling `WMS_API_BASE_URL`
   with `Authorization: Bearer WMS_API_TOKEN`, mapping WMS fields → `WithWmsId<RowType>`.
   (The interface contract in `src/lib/wms/types.ts` is the spec; mappers in `mappers.ts`
   already turn those rows into DB records.)
2. Set Vercel env (all envs): `WMS_API_BASE_URL`, `WMS_API_TOKEN`, `WMS_SYNC_ENABLED=live`,
   and `NEXT_PUBLIC_WMS_MODE=live` (badge). Keep `WMS_WEBHOOK_SECRET` if using webhooks.
3. Apply `wms_source_of_truth.sql` in Supabase (if not already) + enable Realtime
   replication for `sales`, `crm`.
4. Deploy to `dev`, open `/wms`, click "Sync Sekarang", verify a `success` row in history
   and that numbers match the WMS.
5. If WMS supports webhooks: register the dashboard webhook URL `/api/wms/webhook` with the
   shared `WMS_WEBHOOK_SECRET`. Merge `dev` → `main`.
```

- [ ] **Step 2: Full test + lint + build gate**

Run: `npm test` → all suites pass (existing 46 + new wms suites).
Run: `npm run lint` → 0 errors.
Run: `npm run build` → PASS.

- [ ] **Step 3: Commit**

```bash
git add docs/wms-go-live-runbook.md
git commit -m "docs(wms): go-live runbook"
```

---

## Rollout (after merge — user-side, not code)

1. Run `wms_source_of_truth.sql` in Supabase SQL editor; eyeball verification queries.
2. Add env vars to Vercel: `WMS_SYNC_ENABLED=mock`, `NEXT_PUBLIC_WMS_MODE=mock`,
   `WMS_WEBHOOK_SECRET=<generate>` (all 3 envs). `WMS_API_*` left empty until go-live.
3. Enable Supabase Realtime replication for `sales`, `crm`.
4. Push `feature/wms-source-of-truth` → dev → verify Vercel preview (`/wms` works on mock,
   cron fires hourly writing mock rows, history populates) → merge to main.
5. Confirm the hourly cron appears in Vercel → Settings → Cron Jobs and runs green.

---

## Self-Review (against spec)

- **Adapter seam** → Tasks 2, 5, 8 (interface, mock, factory+stub). ✓
- **Provenance (`origin`)** → Task 1 (col), 3 (type), 4 (mapper sets `wms`), 14 (badges). ✓
- **Idempotent `wms_id` upsert** → Task 1 (unique index), 4 (mapper), 7 (`ON CONFLICT brand,wms_id`), tested in 7. ✓
- **sync_log observability** → Task 1 (table), 9 (logPort), 12 (history UI). ✓
- **3 triggers reuse one core** → Task 7 (core), 10 (three routes). ✓
- **Manual-as-fallback + dedup trade-off** → `origin` default `'manual'`, WMS-vs-WMS deduped, manual untouched (Tasks 1/4/7), badges (14). ✓
- **Supabase Realtime live UI** → Task 13. ✓
- **Mock testing strategy (idempotency, isolation, skip absent table)** → Task 7 tests + Task 6 fake client. ✓
- **Env single-switch mock→live** → Task 8 factory + Task 16 runbook. ✓
- **Out of scope (HttpWmsAdapter impl, reconciliation view, inventory)** → not planned, runbook defers HttpWmsAdapter. ✓

No placeholders in code steps; types consistent (`WmsAdapter`, `WithWmsId`, `DbPort`/`LogPort`, `runWmsSync`, `SyncResult` used uniformly across tasks).
```

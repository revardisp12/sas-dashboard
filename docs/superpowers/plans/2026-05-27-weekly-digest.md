# Weekly Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the per-brand weekly digest from Phase 1 of the Output Engine — Vercel-cron generated every Monday 09:00 WIB, displayed on `/digest/[brand]`, manually regenerable, copy-to-clipboard for WhatsApp.

**Architecture:** Pure compute functions in `src/lib/digest/` (testable, no React/Supabase imports). Cron API route calls compute → upserts via SECURITY DEFINER RPC. UI page reads from `digest_log` table and renders text + copy button.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres + SECURITY DEFINER RPC), Vercel Cron, Vitest (new dependency).

**Spec:** `docs/superpowers/specs/2026-05-27-output-engine-phase1-design.md`

**Working directory:** `/Users/revardisyahputra/Library/Mobile Documents/com~apple~CloudDocs/Claude/sas-dashboard` — wrap in double quotes for `cd` (iCloud path has spaces).

**Branch discipline:** ALL commits on `dev`. Promote to `main` ONLY after user verifies on the Vercel preview deploy. See memory `feedback_deploy_workflow_dev_branch.md`.

---

## File Structure

**Created:**
- `vitest.config.ts` — Vitest configuration (jsdom env)
- `vercel.json` — Vercel Cron schedule
- `digest_log.sql` — SQL migration (table + RPC)
- `src/lib/digest/types.ts` — TypeScript types
- `src/lib/digest/compute.ts` — KPI computation
- `src/lib/digest/compute.test.ts` — unit tests
- `src/lib/digest/format.ts` — text template
- `src/lib/digest/format.test.ts` — unit tests
- `src/lib/digest/dateRange.ts` — Mon-Sun week helper
- `src/lib/digest/dateRange.test.ts` — unit tests
- `src/app/api/cron/weekly-digest/route.ts` — cron endpoint
- `src/app/api/digest/[brand]/regenerate/route.ts` — manual regen endpoint
- `src/app/digest/[brand]/page.tsx` — display page
- `src/app/digest/[brand]/CopyButton.tsx` — client component for clipboard

**Modified:**
- `package.json` — add Vitest deps + `test` script
- `src/components/Sidebar.tsx` — add Digest nav link
- `src/lib/types.ts` — add `'digest'` to `ActiveView` union if used (verify during Task 9)
- `src/contexts/AuthContext.tsx` — extend `ROLE_VIEWS` if needed (verify during Task 9)
- `src/lib/database.types.ts` — regenerated after SQL migration (Task 2 includes manual edit since access token revoked)

**User-side (not in repo):**
- `.env.local` — add `CRON_SECRET` (random 32-char string) and `SUPABASE_SERVICE_ROLE_KEY` (from Supabase Studio)
- Vercel project env vars: same two keys

---

## Task 0: Verify Next.js 16 cron handler pattern + Vercel Cron docs

**Goal:** Confirm the Next.js 16 + Vercel Cron pattern hasn't drifted from training assumptions. Per repo's `AGENTS.md`: "This is NOT the Next.js you know."

**Files:**
- Read-only: `node_modules/next/dist/docs/`

- [ ] **Step 1: Locate Next.js route handler docs**

```bash
cd "/Users/revardisyahputra/Library/Mobile Documents/com~apple~CloudDocs/Claude/sas-dashboard"
find node_modules/next/dist/docs -type f \( -name "*route*" -o -name "*headers*" \) 2>/dev/null | head -20
```

If nothing returned: `ls node_modules/next/dist/docs/ | head -30` to discover the doc structure.

- [ ] **Step 2: Skim for runtime + headers API**

Open each candidate file. Confirm:
1. `import { NextRequest, NextResponse } from 'next/server'` still works
2. `req.headers.get('authorization')` is the way to read a header
3. `runtime = 'nodejs'` is the default (we need it for crypto/timing-safe-compare)
4. `NextResponse.json(body, { status })` signature unchanged

- [ ] **Step 3: Check Vercel Cron docs cached in node_modules (if any)**

```bash
grep -rl "crons" node_modules/@vercel/ node_modules/vercel/ 2>/dev/null | head -5
```

If found, open and skim. Otherwise rely on the public docs reference (the cron schedule in `vercel.json` uses standard cron syntax: `0 2 * * 1` = "Monday 02:00 UTC").

- [ ] **Step 4: Record findings**

Append to `docs/superpowers/specs/2026-05-27-output-engine-phase1-design.md`:

```markdown
## Next.js 16 + Vercel Cron API verification (Task 0)

- `NextRequest`/`NextResponse` from `next/server`: <unchanged|changed>
- Header reading via `req.headers.get()`: <unchanged|changed>
- Default runtime: <nodejs|edge>
- Vercel cron config syntax: `vercel.json` with `crons: [{path, schedule}]` — <confirmed|differs>

All assumptions in `2026-05-27-output-engine-phase1-design.md` hold / need update at: <section>
```

- [ ] **Step 5: Commit findings**

```bash
cd "/Users/revardisyahputra/Library/Mobile Documents/com~apple~CloudDocs/Claude/sas-dashboard"
git checkout dev
git add docs/superpowers/specs/2026-05-27-output-engine-phase1-design.md
git commit -m "Record Next.js 16 cron handler API verification (Task 0)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 1: Vitest setup

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Vitest + deps**

```bash
cd "/Users/revardisyahputra/Library/Mobile Documents/com~apple~CloudDocs/Claude/sas-dashboard"
npm install --save-dev vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 3: Add `test` script to `package.json`**

Open `package.json`. In the `"scripts"` object, add (or replace the existing test entry):

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify Vitest runs (no tests yet)**

```bash
cd "/Users/revardisyahputra/Library/Mobile Documents/com~apple~CloudDocs/Claude/sas-dashboard"
npm run test 2>&1 | tail -10
```

Expected: "No test files found, exiting with code 0" or "passed (0)". Either is fine — Vitest is installed and configured.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "Add Vitest testing setup

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: SQL migration — `digest_log` table + `upsert_digest` RPC

**Goal:** Database substrate for storing computed digests. Idempotent migration (CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION).

**Files:**
- Create: `digest_log.sql`
- Modify: `src/lib/database.types.ts` (manual edit since access token revoked)

- [ ] **Step 1: Create the SQL migration file**

Create `digest_log.sql` at repo root with this exact content:

```sql
CREATE TABLE IF NOT EXISTS digest_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand         TEXT NOT NULL CHECK (brand IN ('reglow','amura','purela')),
  week_start    DATE NOT NULL,
  week_end      DATE NOT NULL,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload       JSONB NOT NULL,
  UNIQUE (brand, week_start)
);

ALTER TABLE digest_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "digest_log_select" ON digest_log;
CREATE POLICY "digest_log_select" ON digest_log FOR SELECT
  USING (get_my_role() = 'super_admin' OR brand = get_my_brand());
-- No INSERT/UPDATE/DELETE policy: writes go through upsert_digest() RPC.

CREATE OR REPLACE FUNCTION upsert_digest(
  p_brand       TEXT,
  p_week_start  DATE,
  p_week_end    DATE,
  p_payload     JSONB
) RETURNS digest_log
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row digest_log;
BEGIN
  -- Allow either an authenticated user (admin/manager doing a manual regenerate)
  -- or the service_role key (cron). Both are required: authenticated users via
  -- auth.uid() check, service_role via JWT role claim.
  IF auth.uid() IS NULL
     AND coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_brand NOT IN ('reglow', 'amura', 'purela') THEN
    RAISE EXCEPTION 'Invalid brand: %', p_brand USING ERRCODE = '22023';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'p_payload must be a JSON object' USING ERRCODE = '22023';
  END IF;

  INSERT INTO digest_log (brand, week_start, week_end, payload)
  VALUES (p_brand, p_week_start, p_week_end, p_payload)
  ON CONFLICT (brand, week_start) DO UPDATE
    SET week_end = EXCLUDED.week_end,
        payload = EXCLUDED.payload,
        generated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION upsert_digest(TEXT, DATE, DATE, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_digest(TEXT, DATE, DATE, JSONB) TO authenticated, service_role;
```

- [ ] **Step 2: Apply to Supabase**

User-action gate: open Supabase Studio for project `bdwsrtqgqtozhjqriglm` → SQL Editor → New query → paste contents of `digest_log.sql` → Run.

Expected: "Success. No rows returned."

- [ ] **Step 3: Verify table + RPC exist**

In Supabase SQL editor, run:

```sql
SELECT count(*) AS table_count FROM pg_tables
  WHERE schemaname = 'public' AND tablename = 'digest_log';
SELECT count(*) AS rpc_count FROM pg_proc
  WHERE proname = 'upsert_digest';
SELECT count(*) AS policy_count FROM pg_policies
  WHERE tablename = 'digest_log' AND cmd = 'SELECT';
```

Expected: all three return `1`.

- [ ] **Step 4: Smoke-test RPC anonymously (must fail)**

```sql
SELECT upsert_digest('reglow', '2026-05-19', '2026-05-25', '{}'::jsonb);
```

Expected: `ERROR: Not authenticated` (errcode 42501).

- [ ] **Step 5: Manually patch `src/lib/database.types.ts`**

Open `src/lib/database.types.ts`. Find the `Tables: {` block and add `digest_log` entry alphabetically (between `crm` and `facebook_organic`):

```typescript
digest_log: {
  Row: {
    brand: string
    generated_at: string
    id: string
    payload: Json
    week_end: string
    week_start: string
  }
  Insert: {
    brand: string
    generated_at?: string
    id?: string
    payload: Json
    week_end: string
    week_start: string
  }
  Update: {
    brand?: string
    generated_at?: string
    id?: string
    payload?: Json
    week_end?: string
    week_start?: string
  }
  Relationships: []
}
```

Then find the `Functions: {` block. Add `upsert_digest` entry alphabetically (between `replace_brand_table` and any later entries):

```typescript
upsert_digest: {
  Args: {
    p_brand: string
    p_payload: Json
    p_week_end: string
    p_week_start: string
  }
  Returns: {
    brand: string
    generated_at: string
    id: string
    payload: Json
    week_end: string
    week_start: string
  }
}
```

- [ ] **Step 6: Verify types**

```bash
cd "/Users/revardisyahputra/Library/Mobile Documents/com~apple~CloudDocs/Claude/sas-dashboard"
npx tsc --noEmit -p tsconfig.json 2>&1 | tail -10
```

Expected: no errors. If errors mention `digest_log` or `upsert_digest`, fix the type entries.

- [ ] **Step 7: Commit**

```bash
git add digest_log.sql src/lib/database.types.ts
git commit -m "Add digest_log table + upsert_digest() RPC

Backing storage for the weekly digest feature (Phase 1 Output Engine).
RLS allows SELECT for super_admin and brand-matched users; all writes
go through the SECURITY DEFINER upsert_digest() which validates brand
and accepts both authenticated callers (manual regenerate) and the
service_role JWT (cron).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: TypeScript types for digest payload

**Goal:** Lock the shape of `DigestPayload` so compute, format, render, and DB columns all agree.

**Files:**
- Create: `src/lib/digest/types.ts`

- [ ] **Step 1: Create the file**

`src/lib/digest/types.ts`:

```typescript
import type { Brand } from '@/lib/types'

export type KPIDirection = 'up' | 'down' | 'flat'

export interface KPIDelta {
  current: number
  previous: number
  diff: number
  percent: number | null  // null when previous is 0 (avoid /0)
  direction: KPIDirection
}

export interface DigestKPIs {
  revenue: KPIDelta
  orders: KPIDelta
  blendedRoas: KPIDelta
  newCustomers: KPIDelta
  champions: KPIDelta
}

export interface TopMover {
  channel: string
  direction: 'positive' | 'negative'
  revenueChange: number
  caption: string
}

export interface DigestPayload {
  brand: Brand
  weekStart: string  // 'YYYY-MM-DD'
  weekEnd: string    // 'YYYY-MM-DD'
  weekNumber: number // ISO week number
  generatedAt: string  // ISO timestamp
  kpis: DigestKPIs
  topMover: TopMover | null  // null if no notable mover
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd "/Users/revardisyahputra/Library/Mobile Documents/com~apple~CloudDocs/Claude/sas-dashboard"
npx tsc --noEmit -p tsconfig.json 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/digest/types.ts
git commit -m "Add DigestPayload type definitions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Date range helper (Mon-Sun week)

**Goal:** Compute the Mon-Sun week range deterministically (avoid timezone bugs).

**Files:**
- Create: `src/lib/digest/dateRange.ts`
- Create: `src/lib/digest/dateRange.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/digest/dateRange.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { previousMonSunWeek, isoWeekNumber, ymd } from './dateRange'

describe('previousMonSunWeek', () => {
  it('returns last Mon-Sun when today is Monday', () => {
    // 2026-05-25 is a Monday
    const today = new Date('2026-05-25T09:00:00+07:00')
    const { weekStart, weekEnd } = previousMonSunWeek(today)
    expect(ymd(weekStart)).toBe('2026-05-18')
    expect(ymd(weekEnd)).toBe('2026-05-24')
  })

  it('returns last Mon-Sun when today is mid-week', () => {
    // 2026-05-27 is a Wednesday
    const today = new Date('2026-05-27T09:00:00+07:00')
    const { weekStart, weekEnd } = previousMonSunWeek(today)
    expect(ymd(weekStart)).toBe('2026-05-18')
    expect(ymd(weekEnd)).toBe('2026-05-24')
  })

  it('handles month boundary', () => {
    // 2026-06-01 is a Monday — previous Mon-Sun is the last week of May
    const today = new Date('2026-06-01T09:00:00+07:00')
    const { weekStart, weekEnd } = previousMonSunWeek(today)
    expect(ymd(weekStart)).toBe('2026-05-25')
    expect(ymd(weekEnd)).toBe('2026-05-31')
  })
})

describe('isoWeekNumber', () => {
  it('returns ISO week 21 for 2026-05-18', () => {
    expect(isoWeekNumber(new Date('2026-05-18T00:00:00+07:00'))).toBe(21)
  })
})

describe('ymd', () => {
  it('formats Date as YYYY-MM-DD in UTC', () => {
    expect(ymd(new Date('2026-05-18T17:00:00Z'))).toBe('2026-05-18')
  })
})
```

- [ ] **Step 2: Verify tests fail**

```bash
cd "/Users/revardisyahputra/Library/Mobile Documents/com~apple~CloudDocs/Claude/sas-dashboard"
npm run test -- src/lib/digest/dateRange 2>&1 | tail -10
```

Expected: FAIL — "Cannot find module './dateRange'" or similar.

- [ ] **Step 3: Implement**

`src/lib/digest/dateRange.ts`:

```typescript
// All functions operate in UTC to avoid DST / timezone surprises.
// Caller passes a Date; we compute week boundaries based on UTC day-of-week.
// Mon = 1 .. Sun = 0 (per JS Date.getUTCDay()).

export interface WeekRange {
  weekStart: Date  // Monday 00:00 UTC
  weekEnd: Date    // Sunday 23:59:59.999 UTC
}

export function previousMonSunWeek(reference: Date): WeekRange {
  // Get UTC day-of-week: 0=Sun, 1=Mon, ..., 6=Sat
  const dow = reference.getUTCDay()
  // Days to go back to reach Monday of the PREVIOUS week:
  // - if Mon (dow=1): back 7 days to previous Monday
  // - if Sun (dow=0): back 6 days to previous Monday (last week's Monday)
  // - otherwise: back (dow - 1) + 7 days to previous Monday
  const daysBack = dow === 0 ? 13 : 6 + dow
  const weekStart = new Date(Date.UTC(
    reference.getUTCFullYear(),
    reference.getUTCMonth(),
    reference.getUTCDate() - daysBack,
    0, 0, 0, 0
  ))
  const weekEnd = new Date(weekStart.getTime())
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
  weekEnd.setUTCHours(23, 59, 59, 999)
  return { weekStart, weekEnd }
}

export function isoWeekNumber(date: Date): number {
  // ISO 8601 week numbering: weeks start Monday, week 1 contains the first Thursday.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export function ymd(date: Date): string {
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
```

- [ ] **Step 4: Verify tests pass**

```bash
npm run test -- src/lib/digest/dateRange 2>&1 | tail -10
```

Expected: PASS, "4 tests passed" or similar.

- [ ] **Step 5: Commit**

```bash
git add src/lib/digest/dateRange.ts src/lib/digest/dateRange.test.ts
git commit -m "Add Mon-Sun week date helpers + tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: KPI computation logic

**Goal:** Pure function that takes brand + raw data + week range and returns `DigestPayload`. No Supabase calls inside the function; the caller fetches data and passes it in.

**Files:**
- Create: `src/lib/digest/compute.ts`
- Create: `src/lib/digest/compute.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/digest/compute.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeDigest, ComputeInput } from './compute'
import type { SalesRow, CRMRow, GoogleAdsRow, MetaAdsRow, TikTokShopRow, ShopeeRow } from '@/lib/types'

function emptyInput(): ComputeInput {
  return {
    brand: 'reglow',
    weekStart: new Date('2026-05-18T00:00:00Z'),
    weekEnd: new Date('2026-05-24T23:59:59Z'),
    sales: [],
    crm: [],
    googleAds: [],
    metaAds: [],
    tiktokShop: [],
    shopee: [],
    previousSales: [],
    previousCrm: [],
    previousGoogleAds: [],
    previousMetaAds: [],
    previousTiktokShop: [],
    previousShopee: [],
    customersAllTime: [],
    customersPreviousAllTime: [],
    championsCurrent: 0,
    championsPrevious: 0,
  }
}

describe('computeDigest', () => {
  it('returns zero KPIs for empty input', () => {
    const out = computeDigest(emptyInput())
    expect(out.brand).toBe('reglow')
    expect(out.kpis.revenue.current).toBe(0)
    expect(out.kpis.revenue.diff).toBe(0)
    expect(out.kpis.revenue.percent).toBe(null)
    expect(out.kpis.revenue.direction).toBe('flat')
    expect(out.kpis.orders.current).toBe(0)
    expect(out.kpis.blendedRoas.current).toBe(0)
    expect(out.topMover).toBe(null)
  })

  it('sums revenue across sales + crm', () => {
    const input = emptyInput()
    input.sales = [
      mkSale('2026-05-18', 100000),
      mkSale('2026-05-20', 50000),
    ]
    input.crm = [mkCrm('2026-05-19', 75000)]
    const out = computeDigest(input)
    expect(out.kpis.revenue.current).toBe(225000)
  })

  it('counts orders as sales row count + crm row count', () => {
    const input = emptyInput()
    input.sales = [mkSale('2026-05-18', 100), mkSale('2026-05-19', 200)]
    input.crm = [mkCrm('2026-05-20', 50)]
    const out = computeDigest(input)
    expect(out.kpis.orders.current).toBe(3)
  })

  it('computes blended ROAS as revenue / total ad spend', () => {
    const input = emptyInput()
    input.sales = [mkSale('2026-05-18', 1000000)]
    input.googleAds = [{ date: '2026-05-18', campaign: '', impressions: 0, clicks: 0, ctr: 0, cpc: 0, spend: 100000, conversions: 0, convRate: 0, roas: 0 }]
    input.metaAds = [{ date: '2026-05-18', campaign: '', reach: 0, impressions: 0, clicks: 0, ctr: 0, spend: 100000, purchases: 0, roas: 0, cpm: 0, results: 0 }]
    const out = computeDigest(input)
    // Revenue 1,000,000 / spend 200,000 = 5x
    expect(out.kpis.blendedRoas.current).toBe(5)
  })

  it('blendedRoas is 0 when no spend', () => {
    const input = emptyInput()
    input.sales = [mkSale('2026-05-18', 100000)]
    const out = computeDigest(input)
    expect(out.kpis.blendedRoas.current).toBe(0)
  })

  it('counts new customers as those first seen this week', () => {
    const input = emptyInput()
    // Customer A in all-time history (not new)
    input.customersAllTime = [{ key: 'a|081234', firstSeen: '2026-05-10' }]
    // Customer B first seen in this week
    input.customersAllTime.push({ key: 'b|081235', firstSeen: '2026-05-19' })
    input.customersAllTime.push({ key: 'c|081236', firstSeen: '2026-05-22' })
    const out = computeDigest(input)
    expect(out.kpis.newCustomers.current).toBe(2)
  })

  it('reflects Champions counts passed in', () => {
    const input = emptyInput()
    input.championsCurrent = 87
    input.championsPrevious = 75
    const out = computeDigest(input)
    expect(out.kpis.champions.current).toBe(87)
    expect(out.kpis.champions.diff).toBe(12)
    expect(out.kpis.champions.direction).toBe('up')
  })

  it('marks direction down when current < previous', () => {
    const input = emptyInput()
    input.sales = [mkSale('2026-05-18', 100)]
    input.previousSales = [mkSale('2026-05-11', 200)]
    const out = computeDigest(input)
    expect(out.kpis.revenue.direction).toBe('down')
    expect(out.kpis.revenue.diff).toBe(-100)
  })

  it('selects topMover by largest absolute revenue change', () => {
    const input = emptyInput()
    // Meta revenue from sales attribution: 500k this week, 100k last week → +400k
    input.sales = [{ ...mkSale('2026-05-18', 500000), source: 'meta-ads' }]
    input.previousSales = [{ ...mkSale('2026-05-11', 100000), source: 'meta-ads' }]
    // Google smaller diff
    input.sales.push({ ...mkSale('2026-05-19', 50000), source: 'google-ads' })
    input.previousSales.push({ ...mkSale('2026-05-12', 40000), source: 'google-ads' })
    const out = computeDigest(input)
    expect(out.topMover).not.toBe(null)
    expect(out.topMover!.channel).toBe('meta-ads')
    expect(out.topMover!.direction).toBe('positive')
    expect(out.topMover!.revenueChange).toBe(400000)
  })

  it('topMover is null when no channel attribution exists', () => {
    const input = emptyInput()
    input.sales = [mkSale('2026-05-18', 100000)]  // source defaults to 'organic'
    const out = computeDigest(input)
    expect(out.topMover).toBe(null)
  })
})

// ── helpers ──
function mkSale(date: string, revenue: number): SalesRow {
  return { date, product: 'P', qty: 1, revenue, channel: '', cogs: 0, grossProfit: 0, source: 'organic' }
}
function mkCrm(date: string, revenue: number): CRMRow {
  return { date, customerName: 'C', phone: '', product: 'P', qty: 1, revenue }
}
```

- [ ] **Step 2: Verify tests fail**

```bash
npm run test -- src/lib/digest/compute 2>&1 | tail -15
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/digest/compute.ts`:

```typescript
import type { Brand, SalesRow, CRMRow, GoogleAdsRow, MetaAdsRow, TikTokShopRow, ShopeeRow, SalesSource } from '@/lib/types'
import { isoWeekNumber, ymd } from './dateRange'
import type { DigestPayload, DigestKPIs, KPIDelta, KPIDirection, TopMover } from './types'

export interface CustomerFirstSeen {
  key: string         // (customerName || phone), lowercased + trimmed
  firstSeen: string   // 'YYYY-MM-DD'
}

export interface ComputeInput {
  brand: Brand
  weekStart: Date
  weekEnd: Date

  // Current period rows (already filtered to brand + within range)
  sales: SalesRow[]
  crm: CRMRow[]
  googleAds: GoogleAdsRow[]
  metaAds: MetaAdsRow[]
  tiktokShop: TikTokShopRow[]
  shopee: ShopeeRow[]

  // Previous period (Mon-Sun before)
  previousSales: SalesRow[]
  previousCrm: CRMRow[]
  previousGoogleAds: GoogleAdsRow[]
  previousMetaAds: MetaAdsRow[]
  previousTiktokShop: TikTokShopRow[]
  previousShopee: ShopeeRow[]

  // Customer first-seen records (all-time, brand-scoped)
  customersAllTime: CustomerFirstSeen[]
  customersPreviousAllTime: CustomerFirstSeen[]  // snapshot from end of previous week

  // Champions counts computed externally (RFM is heavy; pass result in)
  championsCurrent: number
  championsPrevious: number
}

export function computeDigest(input: ComputeInput): DigestPayload {
  // ── Revenue ──
  const currentRevenue = sumRevenue(input.sales) + sumCrmRevenue(input.crm)
  const previousRevenue = sumRevenue(input.previousSales) + sumCrmRevenue(input.previousCrm)

  // ── Orders ──
  const currentOrders = input.sales.length + input.crm.length
  const previousOrders = input.previousSales.length + input.previousCrm.length

  // ── Blended ROAS ──
  const currentSpend = sumSpend(input.googleAds, input.metaAds, input.tiktokShop, input.shopee)
  const previousSpend = sumSpend(input.previousGoogleAds, input.previousMetaAds, input.previousTiktokShop, input.previousShopee)
  const currentRoas = currentSpend > 0 ? currentRevenue / currentSpend : 0
  const previousRoas = previousSpend > 0 ? previousRevenue / previousSpend : 0

  // ── New customers ──
  const weekStartYmd = ymd(input.weekStart)
  const weekEndYmd = ymd(input.weekEnd)
  const newCurrent = countNewInRange(input.customersAllTime, weekStartYmd, weekEndYmd)
  const prevWeekStart = new Date(input.weekStart)
  prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7)
  const prevWeekEnd = new Date(input.weekEnd)
  prevWeekEnd.setUTCDate(prevWeekEnd.getUTCDate() - 7)
  const newPrevious = countNewInRange(input.customersPreviousAllTime, ymd(prevWeekStart), ymd(prevWeekEnd))

  // ── Top mover ──
  const topMover = selectTopMover(input.sales, input.previousSales)

  const kpis: DigestKPIs = {
    revenue: delta(currentRevenue, previousRevenue),
    orders: delta(currentOrders, previousOrders),
    blendedRoas: delta(roundTo(currentRoas, 2), roundTo(previousRoas, 2)),
    newCustomers: delta(newCurrent, newPrevious),
    champions: delta(input.championsCurrent, input.championsPrevious),
  }

  return {
    brand: input.brand,
    weekStart: weekStartYmd,
    weekEnd: weekEndYmd,
    weekNumber: isoWeekNumber(input.weekStart),
    generatedAt: new Date().toISOString(),
    kpis,
    topMover,
  }
}

// ── pure helpers ──

function sumRevenue(rows: SalesRow[]): number {
  return rows.reduce((s, r) => s + (r.revenue || 0), 0)
}
function sumCrmRevenue(rows: CRMRow[]): number {
  return rows.reduce((s, r) => s + (r.revenue || 0), 0)
}
function sumSpend(g: GoogleAdsRow[], m: MetaAdsRow[], t: TikTokShopRow[], s: ShopeeRow[]): number {
  const gs = g.reduce((acc, r) => acc + (r.spend || 0), 0)
  const ms = m.reduce((acc, r) => acc + (r.spend || 0), 0)
  const ts = t.reduce((acc, r) => acc + (r.adSpent || 0), 0)
  const ss = s.reduce((acc, r) => acc + (r.adSpend || 0), 0)
  return gs + ms + ts + ss
}
function countNewInRange(records: CustomerFirstSeen[], startYmd: string, endYmd: string): number {
  return records.filter(c => c.firstSeen >= startYmd && c.firstSeen <= endYmd).length
}
function selectTopMover(current: SalesRow[], previous: SalesRow[]): TopMover | null {
  const channels: SalesSource[] = ['google-ads', 'meta-ads', 'tiktok-ads']
  let best: { channel: SalesSource; change: number } | null = null
  for (const ch of channels) {
    const cur = current.filter(s => s.source === ch).reduce((acc, r) => acc + r.revenue, 0)
    const prv = previous.filter(s => s.source === ch).reduce((acc, r) => acc + r.revenue, 0)
    if (cur === 0 && prv === 0) continue
    const change = cur - prv
    if (best === null || Math.abs(change) > Math.abs(best.change)) {
      best = { channel: ch, change }
    }
  }
  if (best === null) return null
  if (best.change === 0) return null
  const direction = best.change > 0 ? 'positive' : 'negative'
  const caption = direction === 'positive'
    ? `${best.channel} +Rp ${best.change.toLocaleString('id-ID')} revenue WoW`
    : `${best.channel} -Rp ${Math.abs(best.change).toLocaleString('id-ID')} revenue WoW`
  return { channel: best.channel, direction, revenueChange: best.change, caption }
}
function delta(current: number, previous: number): KPIDelta {
  const diff = current - previous
  const percent = previous === 0 ? null : (diff / previous) * 100
  let direction: KPIDirection = 'flat'
  if (diff > 0) direction = 'up'
  else if (diff < 0) direction = 'down'
  return { current, previous, diff, percent, direction }
}
function roundTo(n: number, places: number): number {
  const factor = 10 ** places
  return Math.round(n * factor) / factor
}
```

- [ ] **Step 4: Verify tests pass**

```bash
npm run test -- src/lib/digest/compute 2>&1 | tail -15
```

Expected: all tests pass (about 10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/digest/compute.ts src/lib/digest/compute.test.ts
git commit -m "Add digest KPI computation logic + unit tests

Pure function: takes brand + already-filtered rows + previous-period
rows + customer first-seen ledger + Champions counts, returns
DigestPayload with Revenue / Orders / Blended ROAS / New customers /
Champions plus a top-mover selection across paid channels.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Text template formatter

**Goal:** Given a `DigestPayload`, produce a WhatsApp-ready text string.

**Files:**
- Create: `src/lib/digest/format.ts`
- Create: `src/lib/digest/format.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/digest/format.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { formatDigestText } from './format'
import type { DigestPayload } from './types'

function mkPayload(overrides?: Partial<DigestPayload>): DigestPayload {
  return {
    brand: 'reglow',
    weekStart: '2026-05-18',
    weekEnd: '2026-05-24',
    weekNumber: 21,
    generatedAt: '2026-05-25T02:00:00Z',
    kpis: {
      revenue: { current: 245_000_000, previous: 218_000_000, diff: 27_000_000, percent: 12.39, direction: 'up' },
      orders: { current: 287, previous: 295, diff: -8, percent: -2.71, direction: 'down' },
      blendedRoas: { current: 4.8, previous: 4.5, diff: 0.3, percent: 6.67, direction: 'up' },
      newCustomers: { current: 142, previous: 154, diff: -12, percent: -7.79, direction: 'down' },
      champions: { current: 87, previous: 75, diff: 12, percent: 16, direction: 'up' },
    },
    topMover: {
      channel: 'meta-ads',
      direction: 'positive',
      revenueChange: 89_000_000,
      caption: 'meta-ads +Rp 89.000.000 revenue WoW',
    },
    ...overrides,
  }
}

describe('formatDigestText', () => {
  it('includes brand label and week number in header', () => {
    const text = formatDigestText(mkPayload(), 'https://dash.example.com')
    expect(text).toContain('Reglow Weekly Digest')
    expect(text).toContain('Week 21')
    expect(text).toContain('2026-05-18')
    expect(text).toContain('2026-05-24')
  })

  it('renders revenue with IDR thousands separator and up arrow', () => {
    const text = formatDigestText(mkPayload(), 'x')
    expect(text).toMatch(/Revenue: Rp 245\.000\.000 \(\+12\.4% WoW\) ✅/)
  })

  it('uses warning emoji for down direction', () => {
    const text = formatDigestText(mkPayload(), 'x')
    expect(text).toMatch(/Orders: 287 \(-2\.7% WoW\) ⚠️/)
  })

  it('renders ROAS as Nx with one decimal', () => {
    const text = formatDigestText(mkPayload(), 'x')
    expect(text).toMatch(/ROAS: 4\.8x/)
  })

  it('renders top mover section when present', () => {
    const text = formatDigestText(mkPayload(), 'x')
    expect(text).toContain('TOP MOVER')
    expect(text).toContain('meta-ads')
  })

  it('renders WATCH OUT for negative top mover', () => {
    const p = mkPayload({
      topMover: { channel: 'tiktok-ads', direction: 'negative', revenueChange: -45_000_000, caption: 'tiktok-ads -Rp 45.000.000 revenue WoW' },
    })
    const text = formatDigestText(p, 'x')
    expect(text).toContain('WATCH OUT')
    expect(text).toContain('tiktok-ads')
  })

  it('omits top mover section when null', () => {
    const text = formatDigestText(mkPayload({ topMover: null }), 'x')
    expect(text).not.toContain('TOP MOVER')
    expect(text).not.toContain('WATCH OUT')
  })

  it('includes dashboard URL at the bottom', () => {
    const text = formatDigestText(mkPayload(), 'https://dash.example.com')
    expect(text).toContain('https://dash.example.com/digest/reglow')
  })

  it('shows "—" instead of percent when previous is zero', () => {
    const p = mkPayload()
    p.kpis.revenue = { current: 100, previous: 0, diff: 100, percent: null, direction: 'up' }
    const text = formatDigestText(p, 'x')
    expect(text).toContain('Revenue: Rp 100 (new) ✅')
  })
})
```

- [ ] **Step 2: Verify tests fail**

```bash
npm run test -- src/lib/digest/format 2>&1 | tail -15
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/digest/format.ts`:

```typescript
import type { Brand } from '@/lib/types'
import type { DigestPayload, KPIDelta } from './types'

const BRAND_LABEL: Record<Brand, string> = {
  reglow: 'Reglow',
  amura: 'Amura',
  purela: 'Purela',
}

export function formatDigestText(payload: DigestPayload, dashboardOrigin: string): string {
  const lines: string[] = []
  const label = BRAND_LABEL[payload.brand]

  lines.push(`📊 ${label} Weekly Digest — Week ${payload.weekNumber} (${payload.weekStart} to ${payload.weekEnd})`)
  lines.push('')
  lines.push(`Revenue: ${formatRupiah(payload.kpis.revenue.current)} ${suffix(payload.kpis.revenue)}`)
  lines.push(`Orders: ${payload.kpis.orders.current.toLocaleString('id-ID')} ${suffix(payload.kpis.orders)}`)
  lines.push(`ROAS: ${payload.kpis.blendedRoas.current.toFixed(1)}x ${suffix(payload.kpis.blendedRoas)}`)
  lines.push(`New Customers: ${payload.kpis.newCustomers.current.toLocaleString('id-ID')} ${suffix(payload.kpis.newCustomers)}`)
  lines.push(`Champions: ${payload.kpis.champions.current.toLocaleString('id-ID')} ${suffix(payload.kpis.champions)}`)

  if (payload.topMover) {
    lines.push('')
    if (payload.topMover.direction === 'positive') {
      lines.push(`🚀 TOP MOVER: ${payload.topMover.caption}`)
    } else {
      lines.push(`⚠️ WATCH OUT: ${payload.topMover.caption}`)
    }
  }

  lines.push('')
  lines.push(`Full detail: ${dashboardOrigin}/digest/${payload.brand}`)

  return lines.join('\n')
}

function formatRupiah(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID')
}

function suffix(d: KPIDelta): string {
  const emoji = d.direction === 'up' ? '✅' : d.direction === 'down' ? '⚠️' : '➖'
  if (d.percent === null) {
    return `(new) ${emoji}`
  }
  const sign = d.percent >= 0 ? '+' : ''
  return `(${sign}${d.percent.toFixed(1)}% WoW) ${emoji}`
}
```

- [ ] **Step 4: Verify tests pass**

```bash
npm run test -- src/lib/digest/format 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/digest/format.ts src/lib/digest/format.test.ts
git commit -m "Add digest text template formatter + unit tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Cron API route — `/api/cron/weekly-digest`

**Goal:** Endpoint hit by Vercel Cron every Monday 02:00 UTC. Loops 3 brands, computes the digest, persists via `upsert_digest` RPC.

**Files:**
- Create: `src/app/api/cron/weekly-digest/route.ts`

- [ ] **Step 1: Create the route**

`src/app/api/cron/weekly-digest/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/database.types'
import type { Brand, SalesRow, CRMRow, GoogleAdsRow, MetaAdsRow, TikTokShopRow, ShopeeRow, SalesSource } from '@/lib/types'
import { computeDigest, CustomerFirstSeen } from '@/lib/digest/compute'
import { previousMonSunWeek, ymd } from '@/lib/digest/dateRange'
import { calcRFM, filterByDaysCRM } from '@/lib/rfm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BRANDS: Brand[] = ['reglow', 'amura', 'purela']

export async function POST(req: NextRequest) {
  // Cron auth
  const auth = req.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (!auth || auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Missing env' }, { status: 500 })
  }

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { weekStart, weekEnd } = previousMonSunWeek(new Date())
  const startYmd = ymd(weekStart)
  const endYmd = ymd(weekEnd)

  // Previous week range
  const prevWeekStart = new Date(weekStart)
  prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7)
  const prevWeekEnd = new Date(weekEnd)
  prevWeekEnd.setUTCDate(prevWeekEnd.getUTCDate() - 7)
  const prevStartYmd = ymd(prevWeekStart)
  const prevEndYmd = ymd(prevWeekEnd)

  const results: { brand: Brand; ok: boolean; error?: string }[] = []

  for (const brand of BRANDS) {
    try {
      const payload = await computeForBrand(supabase, brand, weekStart, weekEnd, startYmd, endYmd, prevStartYmd, prevEndYmd)
      const { error: rpcErr } = await supabase.rpc('upsert_digest', {
        p_brand: brand,
        p_week_start: startYmd,
        p_week_end: endYmd,
        p_payload: payload as unknown as Json,
      })
      if (rpcErr) throw new Error(rpcErr.message)
      results.push({ brand, ok: true })
    } catch (e) {
      console.error(`[cron/weekly-digest] ${brand} failed:`, e)
      results.push({ brand, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }

  const okCount = results.filter(r => r.ok).length
  const status = okCount === BRANDS.length ? 200 : okCount === 0 ? 500 : 207
  return NextResponse.json({ digestsGenerated: okCount, perBrand: results }, { status })
}

async function computeForBrand(
  supabase: ReturnType<typeof createClient<Database>>,
  brand: Brand,
  weekStart: Date,
  weekEnd: Date,
  startYmd: string,
  endYmd: string,
  prevStartYmd: string,
  prevEndYmd: string,
) {
  // Fetch raw rows in parallel
  const [salesCur, salesPrv, crmCur, crmPrv, gaCur, gaPrv, maCur, maPrv, ttsCur, ttsPrv, shopCur, shopPrv, crmAll] = await Promise.all([
    fetchInRange<SalesRow>(supabase, 'sales', brand, startYmd, endYmd, salesMap),
    fetchInRange<SalesRow>(supabase, 'sales', brand, prevStartYmd, prevEndYmd, salesMap),
    fetchInRange<CRMRow>(supabase, 'crm', brand, startYmd, endYmd, crmMap),
    fetchInRange<CRMRow>(supabase, 'crm', brand, prevStartYmd, prevEndYmd, crmMap),
    fetchInRange<GoogleAdsRow>(supabase, 'google_ads', brand, startYmd, endYmd, googleAdsMap),
    fetchInRange<GoogleAdsRow>(supabase, 'google_ads', brand, prevStartYmd, prevEndYmd, googleAdsMap),
    fetchInRange<MetaAdsRow>(supabase, 'meta_ads', brand, startYmd, endYmd, metaAdsMap),
    fetchInRange<MetaAdsRow>(supabase, 'meta_ads', brand, prevStartYmd, prevEndYmd, metaAdsMap),
    fetchInRange<TikTokShopRow>(supabase, 'tiktok_shop', brand, startYmd, endYmd, ttsMap),
    fetchInRange<TikTokShopRow>(supabase, 'tiktok_shop', brand, prevStartYmd, prevEndYmd, ttsMap),
    fetchInRange<ShopeeRow>(supabase, 'shopee', brand, startYmd, endYmd, shopeeMap),
    fetchInRange<ShopeeRow>(supabase, 'shopee', brand, prevStartYmd, prevEndYmd, shopeeMap),
    // All-time CRM for first-seen tracking (sales is per-row, CRM is the canonical customer ledger)
    fetchAll<CRMRow>(supabase, 'crm', brand, crmMap),
  ])

  // Build customer first-seen ledger (key = phone || name, both trimmed/lowered)
  const firstSeenMap = new Map<string, string>()
  for (const c of crmAll) {
    const key = customerKey(c.customerName, c.phone)
    if (!key) continue
    const existing = firstSeenMap.get(key)
    if (!existing || c.date < existing) firstSeenMap.set(key, c.date)
  }
  const customersAllTime: CustomerFirstSeen[] = Array.from(firstSeenMap.entries()).map(([key, firstSeen]) => ({ key, firstSeen }))

  // For "customersPreviousAllTime" we use the same ledger; the compute function
  // re-filters by the previous week range. This is correct because the ledger
  // is monotonic (first-seen dates don't change).
  const customersPreviousAllTime = customersAllTime

  // Compute Champions count via existing RFM logic — uses 90-day window per existing pattern
  const championsCurrent = calcRFM(filterByDaysCRM(crmAll, 90)).filter(c => c.segment === 'Champions').length
  // Previous Champions: RFM relative to the previous week's end. Use a snapshot of CRM rows up to prevWeekEnd.
  const crmUpToPrevEnd = crmAll.filter(r => r.date <= prevEndYmd)
  const championsPrevious = calcRFM(filterByDaysCRM(crmUpToPrevEnd, 90)).filter(c => c.segment === 'Champions').length

  return computeDigest({
    brand,
    weekStart, weekEnd,
    sales: salesCur, crm: crmCur,
    googleAds: gaCur, metaAds: maCur, tiktokShop: ttsCur, shopee: shopCur,
    previousSales: salesPrv, previousCrm: crmPrv,
    previousGoogleAds: gaPrv, previousMetaAds: maPrv, previousTiktokShop: ttsPrv, previousShopee: shopPrv,
    customersAllTime, customersPreviousAllTime,
    championsCurrent, championsPrevious,
  })
}

// ── row mappers (snake_case DB → camelCase TS) ──
type Mapper<T> = (r: Record<string, unknown>) => T

function salesMap(r: Record<string, unknown>): SalesRow {
  return {
    date: String(r.date ?? ''),
    product: String(r.product ?? ''),
    qty: Number(r.qty ?? 0),
    revenue: Number(r.revenue ?? 0),
    channel: String(r.channel ?? ''),
    cogs: Number(r.cogs ?? 0),
    grossProfit: Number(r.gross_profit ?? 0),
    customerName: r.customer_name ? String(r.customer_name) : '',
    phone: r.phone ? String(r.phone) : '',
    address: r.address ? String(r.address) : '',
    source: (r.source ?? 'organic') as SalesSource,
  }
}
function crmMap(r: Record<string, unknown>): CRMRow {
  return {
    date: String(r.date ?? ''),
    customerName: r.customer_name ? String(r.customer_name) : '',
    phone: r.phone ? String(r.phone) : '',
    product: String(r.product ?? ''),
    qty: Number(r.qty ?? 0),
    revenue: Number(r.revenue ?? 0),
  }
}
function googleAdsMap(r: Record<string, unknown>): GoogleAdsRow {
  return {
    date: String(r.date ?? ''),
    campaign: String(r.campaign ?? ''),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    ctr: Number(r.ctr ?? 0),
    cpc: Number(r.cpc ?? 0),
    spend: Number(r.spend ?? 0),
    conversions: Number(r.conversions ?? 0),
    convRate: Number(r.conv_rate ?? 0),
    roas: Number(r.roas ?? 0),
  }
}
function metaAdsMap(r: Record<string, unknown>): MetaAdsRow {
  return {
    date: String(r.date ?? ''),
    campaign: String(r.campaign ?? ''),
    reach: Number(r.reach ?? 0),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    ctr: Number(r.ctr ?? 0),
    spend: Number(r.spend ?? 0),
    purchases: Number(r.purchases ?? 0),
    roas: Number(r.roas ?? 0),
    cpm: Number(r.cpm ?? 0),
    results: Number(r.results ?? 0),
  }
}
function ttsMap(r: Record<string, unknown>): TikTokShopRow {
  return {
    date: String(r.date ?? ''),
    gmv: Number(r.gmv ?? 0),
    orders: Number(r.orders ?? 0),
    unitsSold: Number(r.units_sold ?? 0),
    revenue: Number(r.revenue ?? 0),
    productViews: Number(r.product_views ?? 0),
    adSpent: Number(r.ad_spent ?? 0),
  }
}
function shopeeMap(r: Record<string, unknown>): ShopeeRow {
  return {
    date: String(r.date ?? ''),
    gmv: Number(r.gmv ?? 0),
    orders: Number(r.orders ?? 0),
    unitsSold: Number(r.units_sold ?? 0),
    revenue: Number(r.revenue ?? 0),
    productViews: Number(r.product_views ?? 0),
    adSpend: Number(r.ad_spend ?? 0),
    adClicks: Number(r.ad_clicks ?? 0),
    adImpressions: Number(r.ad_impressions ?? 0),
  }
}

async function fetchInRange<T>(
  supabase: ReturnType<typeof createClient<Database>>,
  table: 'sales' | 'crm' | 'google_ads' | 'meta_ads' | 'tiktok_shop' | 'shopee',
  brand: Brand,
  startYmd: string,
  endYmd: string,
  mapper: Mapper<T>,
): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').eq('brand', brand).gte('date', startYmd).lte('date', endYmd)
  if (error) throw error
  return (data ?? []).map(r => mapper(r as Record<string, unknown>))
}

async function fetchAll<T>(
  supabase: ReturnType<typeof createClient<Database>>,
  table: 'crm',
  brand: Brand,
  mapper: Mapper<T>,
): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').eq('brand', brand)
  if (error) throw error
  return (data ?? []).map(r => mapper(r as Record<string, unknown>))
}

function customerKey(name: string | undefined, phone: string | undefined): string | null {
  const n = (name ?? '').trim().toLowerCase()
  const p = (phone ?? '').trim()
  const key = p || n
  return key || null
}
```

- [ ] **Step 2: Type-check**

```bash
cd "/Users/revardisyahputra/Library/Mobile Documents/com~apple~CloudDocs/Claude/sas-dashboard"
npx tsc --noEmit -p tsconfig.json 2>&1 | tail -15
```

Expected: no errors.

- [ ] **Step 3: Build**

```bash
rm -rf .next
npm run build 2>&1 | tail -15
```

Expected: build succeeds, route table shows `/api/cron/weekly-digest`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/weekly-digest/route.ts
git commit -m "Add /api/cron/weekly-digest endpoint

Loops the 3 brands, computes the digest for the previous Mon-Sun week,
and persists via upsert_digest RPC. Authenticates via CRON_SECRET. Uses
the Supabase service_role key so the RPC's role-claim check passes.
Returns 200 all-ok, 207 partial, 500 all-fail.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: `vercel.json` cron config

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create config**

`vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/weekly-digest",
      "schedule": "0 2 * * 1"
    }
  ]
}
```

- [ ] **Step 2: Document env vars**

Append to repo root `README.md` (create if missing — look first via `ls README.md`):

```markdown
## Environment variables

### Local development (`.env.local`)

| Key | Description | How to get |
|-----|-------------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Studio → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (publishable) key | Same as above |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — bypasses RLS, KEEP SECRET | Supabase Studio → Settings → API → "service_role" secret |
| `CRON_SECRET` | Bearer token for Vercel Cron auth | Generate with `openssl rand -hex 32` |

### Vercel project settings

Add the same four keys in Vercel Dashboard → Project → Settings → Environment Variables. Mark `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` as **Sensitive**. Apply to Production + Preview + Development.
```

If README.md already exists, append the section (don't replace existing content).

- [ ] **Step 3: User-action gate — Vercel env vars**

User must add `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` in Vercel Dashboard before this cron will work in production. Surface this requirement explicitly. Do not commit any secret to git.

- [ ] **Step 4: Local `.env.local` (user-side)**

User adds `CRON_SECRET=<32-char hex>` and `SUPABASE_SERVICE_ROLE_KEY=<from Supabase>` to local `.env.local`. Verify by running:

```bash
grep -E '^(CRON_SECRET|SUPABASE_SERVICE_ROLE_KEY)=' .env.local 2>&1 | sed 's/=.*/=<set>/'
```

Expected: both keys printed as `<set>`. Do not echo the actual values.

- [ ] **Step 5: Local smoke test**

```bash
PORT=3001 npx next dev --webpack > /tmp/sas-dev.log 2>&1 &
sleep 5
SECRET=$(grep '^CRON_SECRET=' .env.local | cut -d= -f2-)
curl -s -X POST http://localhost:3001/api/cron/weekly-digest \
  -H "Authorization: Bearer $SECRET" \
  -w "\nHTTP %{http_code}\n"
```

Expected output: `HTTP 200` and JSON like `{"digestsGenerated":3,"perBrand":[{"brand":"reglow","ok":true},...]}`. If 401, the env var didn't load — restart dev server. If 500, check `/tmp/sas-dev.log` for the error.

- [ ] **Step 6: Verify rows landed**

In Supabase SQL editor:

```sql
SELECT brand, week_start, week_end, generated_at FROM digest_log ORDER BY generated_at DESC LIMIT 5;
```

Expected: 3 rows, one per brand, for the previous Mon-Sun week.

- [ ] **Step 7: Commit**

```bash
git add vercel.json README.md
git commit -m "Configure Vercel Cron for weekly digest (Mon 02:00 UTC)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Manual regenerate API route

**Goal:** Authenticated endpoint that recomputes the latest Mon-Sun digest for a single brand. Used by the "Generate Now" button on the UI.

**Files:**
- Create: `src/app/api/digest/[brand]/regenerate/route.ts`

- [ ] **Step 1: Create the route**

`src/app/api/digest/[brand]/regenerate/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/database.types'
import type { Brand, SalesRow, CRMRow, GoogleAdsRow, MetaAdsRow, TikTokShopRow, ShopeeRow, SalesSource } from '@/lib/types'
import { computeDigest, CustomerFirstSeen } from '@/lib/digest/compute'
import { previousMonSunWeek, ymd } from '@/lib/digest/dateRange'
import { calcRFM, filterByDaysCRM } from '@/lib/rfm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BRANDS: ReadonlySet<Brand> = new Set(['reglow', 'amura', 'purela'])

export async function POST(req: NextRequest, ctx: { params: Promise<{ brand: string }> }) {
  const { brand: brandParam } = await ctx.params
  if (!BRANDS.has(brandParam as Brand)) {
    return NextResponse.json({ error: 'Invalid brand' }, { status: 400 })
  }
  const brand = brandParam as Brand

  // Auth: use user's JWT (not service_role) so the RPC's auth.uid() check passes
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const jwt = auth.slice(7).trim()
  if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return NextResponse.json({ error: 'Missing env' }, { status: 500 })

  const supabase = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { weekStart, weekEnd } = previousMonSunWeek(new Date())
    const startYmd = ymd(weekStart)
    const endYmd = ymd(weekEnd)
    const prevWeekStart = new Date(weekStart); prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7)
    const prevWeekEnd = new Date(weekEnd); prevWeekEnd.setUTCDate(prevWeekEnd.getUTCDate() - 7)
    const prevStartYmd = ymd(prevWeekStart)
    const prevEndYmd = ymd(prevWeekEnd)

    const [salesCur, salesPrv, crmCur, crmPrv, gaCur, gaPrv, maCur, maPrv, ttsCur, ttsPrv, shopCur, shopPrv, crmAll] = await Promise.all([
      fetchRange<SalesRow>(supabase, 'sales', brand, startYmd, endYmd, salesMap),
      fetchRange<SalesRow>(supabase, 'sales', brand, prevStartYmd, prevEndYmd, salesMap),
      fetchRange<CRMRow>(supabase, 'crm', brand, startYmd, endYmd, crmMap),
      fetchRange<CRMRow>(supabase, 'crm', brand, prevStartYmd, prevEndYmd, crmMap),
      fetchRange<GoogleAdsRow>(supabase, 'google_ads', brand, startYmd, endYmd, googleAdsMap),
      fetchRange<GoogleAdsRow>(supabase, 'google_ads', brand, prevStartYmd, prevEndYmd, googleAdsMap),
      fetchRange<MetaAdsRow>(supabase, 'meta_ads', brand, startYmd, endYmd, metaAdsMap),
      fetchRange<MetaAdsRow>(supabase, 'meta_ads', brand, prevStartYmd, prevEndYmd, metaAdsMap),
      fetchRange<TikTokShopRow>(supabase, 'tiktok_shop', brand, startYmd, endYmd, ttsMap),
      fetchRange<TikTokShopRow>(supabase, 'tiktok_shop', brand, prevStartYmd, prevEndYmd, ttsMap),
      fetchRange<ShopeeRow>(supabase, 'shopee', brand, startYmd, endYmd, shopeeMap),
      fetchRange<ShopeeRow>(supabase, 'shopee', brand, prevStartYmd, prevEndYmd, shopeeMap),
      fetchAllCrm(supabase, brand),
    ])

    const firstSeenMap = new Map<string, string>()
    for (const c of crmAll) {
      const key = customerKey(c.customerName, c.phone)
      if (!key) continue
      const existing = firstSeenMap.get(key)
      if (!existing || c.date < existing) firstSeenMap.set(key, c.date)
    }
    const customersAllTime: CustomerFirstSeen[] = Array.from(firstSeenMap.entries()).map(([key, firstSeen]) => ({ key, firstSeen }))
    const championsCurrent = calcRFM(filterByDaysCRM(crmAll, 90)).filter(c => c.segment === 'Champions').length
    const crmUpToPrevEnd = crmAll.filter(r => r.date <= prevEndYmd)
    const championsPrevious = calcRFM(filterByDaysCRM(crmUpToPrevEnd, 90)).filter(c => c.segment === 'Champions').length

    const payload = computeDigest({
      brand, weekStart, weekEnd,
      sales: salesCur, crm: crmCur,
      googleAds: gaCur, metaAds: maCur, tiktokShop: ttsCur, shopee: shopCur,
      previousSales: salesPrv, previousCrm: crmPrv,
      previousGoogleAds: gaPrv, previousMetaAds: maPrv, previousTiktokShop: ttsPrv, previousShopee: shopPrv,
      customersAllTime, customersPreviousAllTime: customersAllTime,
      championsCurrent, championsPrevious,
    })

    const { error: rpcErr } = await supabase.rpc('upsert_digest', {
      p_brand: brand,
      p_week_start: startYmd,
      p_week_end: endYmd,
      p_payload: payload as unknown as Json,
    })
    if (rpcErr) throw new Error(rpcErr.message)

    return NextResponse.json({ ok: true, payload })
  } catch (e) {
    console.error('[/api/digest/regenerate]', e)
    return NextResponse.json({ error: 'Internal error', detail: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// Mappers + helpers — copied from the cron route to keep route handlers self-contained.
// (DRY isn't free here: shared file means more imports per route + possible cold-start cost.
// The mappers are small and stable; copy is acceptable for two callers.)

type Mapper<T> = (r: Record<string, unknown>) => T

function salesMap(r: Record<string, unknown>): SalesRow {
  return {
    date: String(r.date ?? ''), product: String(r.product ?? ''),
    qty: Number(r.qty ?? 0), revenue: Number(r.revenue ?? 0),
    channel: String(r.channel ?? ''), cogs: Number(r.cogs ?? 0),
    grossProfit: Number(r.gross_profit ?? 0),
    customerName: r.customer_name ? String(r.customer_name) : '',
    phone: r.phone ? String(r.phone) : '',
    address: r.address ? String(r.address) : '',
    source: (r.source ?? 'organic') as SalesSource,
  }
}
function crmMap(r: Record<string, unknown>): CRMRow {
  return {
    date: String(r.date ?? ''),
    customerName: r.customer_name ? String(r.customer_name) : '',
    phone: r.phone ? String(r.phone) : '',
    product: String(r.product ?? ''),
    qty: Number(r.qty ?? 0), revenue: Number(r.revenue ?? 0),
  }
}
function googleAdsMap(r: Record<string, unknown>): GoogleAdsRow {
  return {
    date: String(r.date ?? ''), campaign: String(r.campaign ?? ''),
    impressions: Number(r.impressions ?? 0), clicks: Number(r.clicks ?? 0),
    ctr: Number(r.ctr ?? 0), cpc: Number(r.cpc ?? 0), spend: Number(r.spend ?? 0),
    conversions: Number(r.conversions ?? 0), convRate: Number(r.conv_rate ?? 0),
    roas: Number(r.roas ?? 0),
  }
}
function metaAdsMap(r: Record<string, unknown>): MetaAdsRow {
  return {
    date: String(r.date ?? ''), campaign: String(r.campaign ?? ''),
    reach: Number(r.reach ?? 0), impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0), ctr: Number(r.ctr ?? 0), spend: Number(r.spend ?? 0),
    purchases: Number(r.purchases ?? 0), roas: Number(r.roas ?? 0),
    cpm: Number(r.cpm ?? 0), results: Number(r.results ?? 0),
  }
}
function ttsMap(r: Record<string, unknown>): TikTokShopRow {
  return {
    date: String(r.date ?? ''), gmv: Number(r.gmv ?? 0), orders: Number(r.orders ?? 0),
    unitsSold: Number(r.units_sold ?? 0), revenue: Number(r.revenue ?? 0),
    productViews: Number(r.product_views ?? 0), adSpent: Number(r.ad_spent ?? 0),
  }
}
function shopeeMap(r: Record<string, unknown>): ShopeeRow {
  return {
    date: String(r.date ?? ''), gmv: Number(r.gmv ?? 0), orders: Number(r.orders ?? 0),
    unitsSold: Number(r.units_sold ?? 0), revenue: Number(r.revenue ?? 0),
    productViews: Number(r.product_views ?? 0),
    adSpend: Number(r.ad_spend ?? 0),
    adClicks: Number(r.ad_clicks ?? 0),
    adImpressions: Number(r.ad_impressions ?? 0),
  }
}

async function fetchRange<T>(
  supabase: ReturnType<typeof createClient<Database>>,
  table: 'sales' | 'crm' | 'google_ads' | 'meta_ads' | 'tiktok_shop' | 'shopee',
  brand: Brand, startYmd: string, endYmd: string, mapper: Mapper<T>,
): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').eq('brand', brand).gte('date', startYmd).lte('date', endYmd)
  if (error) throw error
  return (data ?? []).map(r => mapper(r as Record<string, unknown>))
}
async function fetchAllCrm(
  supabase: ReturnType<typeof createClient<Database>>,
  brand: Brand,
): Promise<CRMRow[]> {
  const { data, error } = await supabase.from('crm').select('*').eq('brand', brand)
  if (error) throw error
  return (data ?? []).map(r => crmMap(r as Record<string, unknown>))
}

function customerKey(name: string | undefined, phone: string | undefined): string | null {
  const n = (name ?? '').trim().toLowerCase()
  const p = (phone ?? '').trim()
  const key = p || n
  return key || null
}
```

- [ ] **Step 2: Type-check and build**

```bash
cd "/Users/revardisyahputra/Library/Mobile Documents/com~apple~CloudDocs/Claude/sas-dashboard"
npx tsc --noEmit -p tsconfig.json 2>&1 | tail -10
rm -rf .next && npm run build 2>&1 | tail -10
```

Expected: both pass.

- [ ] **Step 3: Smoke test (manual, while logged in)**

The route requires a user JWT. Easiest verification path is to wait until Task 11 (UI page with Generate Now button). For now, accept the build pass as proof.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/digest/
git commit -m "Add /api/digest/[brand]/regenerate manual endpoint

Authenticated (user JWT), recomputes the latest Mon-Sun digest for a
single brand and overwrites via upsert_digest. Used by the Generate
Now button in the UI.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Digest display page

**Goal:** `/digest/[brand]` page renders the latest digest as text + a Copy button + a Generate Now button.

**Files:**
- Create: `src/app/digest/[brand]/page.tsx`
- Create: `src/app/digest/[brand]/CopyButton.tsx`
- Create: `src/app/digest/[brand]/RegenerateButton.tsx`

- [ ] **Step 1: Page component**

`src/app/digest/[brand]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { supabase } from '@/lib/supabase'
import type { Brand } from '@/lib/types'
import type { DigestPayload } from '@/lib/digest/types'
import { formatDigestText } from '@/lib/digest/format'
import CopyButton from './CopyButton'
import RegenerateButton from './RegenerateButton'

const BRANDS = new Set<Brand>(['reglow', 'amura', 'purela'])

export default async function DigestPage({ params }: { params: Promise<{ brand: string }> }) {
  const { brand: brandParam } = await params
  if (!BRANDS.has(brandParam as Brand)) notFound()
  const brand = brandParam as Brand

  const { data, error } = await supabase
    .from('digest_log')
    .select('*')
    .eq('brand', brand)
    .order('week_start', { ascending: false })
    .limit(1)
    .single()

  // Get the origin for the dashboard URL embedded in the digest text
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const host = h.get('host') ?? 'localhost:3000'
  const origin = `${proto}://${host}`

  if (error || !data) {
    return (
      <div className="p-8">
        <h1 className="text-lg font-bold capitalize" style={{ color: '#111827' }}>{brand} Weekly Digest</h1>
        <p className="text-sm mt-2" style={{ color: '#6B7280' }}>
          Belum ada digest untuk brand ini. Klik Generate Now untuk membuat digest minggu lalu.
        </p>
        <RegenerateButton brand={brand} />
      </div>
    )
  }

  const payload = data.payload as unknown as DigestPayload
  const text = formatDigestText(payload, origin)

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-lg font-bold capitalize" style={{ color: '#111827' }}>{brand} Weekly Digest</h1>
          <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
            Week {payload.weekNumber} ({payload.weekStart} to {payload.weekEnd})
            <span className="ml-2">· Generated {new Date(payload.generatedAt).toLocaleString('id-ID')}</span>
          </p>
        </div>
        <RegenerateButton brand={brand} />
      </div>

      <div className="rounded-2xl p-5 mb-3" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
        <pre className="whitespace-pre-wrap text-sm font-mono" style={{ color: '#111827' }}>{text}</pre>
      </div>

      <CopyButton text={text} />
    </div>
  )
}
```

- [ ] **Step 2: Copy button (client)**

`src/app/digest/[brand]/CopyButton.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error('Clipboard write failed:', e)
    }
  }

  return (
    <button onClick={handleCopy}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
      style={{ background: copied ? '#10B981' : '#8B5CF6', color: '#FFFFFF' }}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copied to clipboard!' : 'Copy to clipboard'}
    </button>
  )
}
```

- [ ] **Step 3: Regenerate button (client)**

`src/app/digest/[brand]/RegenerateButton.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { RefreshCw, Loader2 } from 'lucide-react'
import type { Brand } from '@/lib/types'

export default function RegenerateButton({ brand }: { brand: Brand }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRegenerate() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Session expired — please reload')

      const res = await fetch(`/api/digest/${brand}/regenerate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Server error' }))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      router.refresh()  // re-fetch the server component
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={handleRegenerate} disabled={busy}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
        style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#374151' }}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        {busy ? 'Generating...' : 'Generate Now'}
      </button>
      {error && <span className="text-xs" style={{ color: '#DC2626' }}>{error}</span>}
    </div>
  )
}
```

- [ ] **Step 4: Build**

```bash
rm -rf .next && npm run build 2>&1 | tail -10
```

Expected: build succeeds, route table includes `/digest/[brand]`.

- [ ] **Step 5: Commit**

```bash
git add src/app/digest/
git commit -m "Add /digest/[brand] page with copy + regenerate buttons

Server component fetches latest digest_log row for the brand, renders
formatted text. Client components handle clipboard copy + manual
regenerate (calls /api/digest/[brand]/regenerate then router.refresh).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Sidebar nav link

**Goal:** Add a "Weekly Digest" entry to the sidebar that links to the digest page for the current brand.

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Read current Sidebar structure**

```bash
cd "/Users/revardisyahputra/Library/Mobile Documents/com~apple~CloudDocs/Claude/sas-dashboard"
grep -n "view ===\|href=" src/components/Sidebar.tsx | head -20
```

This reveals how nav entries are structured (probably an array of `{ key, label, icon }` or inline JSX).

- [ ] **Step 2: Determine the integration shape**

Two paths depending on what Step 1 shows:

**Path A (Sidebar uses `setView` for in-page tabs):** Digest is a separate route (`/digest/[brand]`), not an in-page tab. Add a sidebar entry that uses `next/link` to navigate.

**Path B (Sidebar already uses `<Link>` for some entries):** Add another `<Link>` entry.

Open `src/components/Sidebar.tsx`, look at the JSX structure, and pick the matching pattern. Below is the Path A skeleton — adapt to existing patterns in the file.

- [ ] **Step 3: Add the entry**

Pseudocode (adapt to your sidebar's exact pattern):

```tsx
import Link from 'next/link'
import { FileText } from 'lucide-react'

// Inside the Sidebar component, where other nav buttons render:
<Link href={`/digest/${brand}`}
  className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all"
  style={{
    color: '#6B7280',
    background: 'transparent',
  }}>
  <FileText size={16} />
  Weekly Digest
</Link>
```

Place it under "Settings" or wherever feels natural — at the bottom of the main nav list.

- [ ] **Step 4: Build + visual verify**

```bash
rm -rf .next && npm run build 2>&1 | tail -10
PORT=3001 npx next dev --webpack > /tmp/sas-dev.log 2>&1 &
sleep 5
echo "Open http://localhost:3001 in a browser, log in, verify Weekly Digest link appears in sidebar."
```

User-action gate: open in browser, log in, click the new link. Confirm the digest page loads.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "Add Weekly Digest link to sidebar

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: End-to-end smoke test + push to dev

- [ ] **Step 1: Confirm Vitest passes**

```bash
cd "/Users/revardisyahputra/Library/Mobile Documents/com~apple~CloudDocs/Claude/sas-dashboard"
npm run test 2>&1 | tail -15
```

Expected: all tests pass (across compute, format, dateRange).

- [ ] **Step 2: Type-check + build**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | tail -10
rm -rf .next && npm run build 2>&1 | tail -10
```

Expected: zero errors.

- [ ] **Step 3: Local end-to-end check**

```bash
PORT=3001 npx next dev --webpack > /tmp/sas-dev.log 2>&1 &
sleep 5
```

In browser:
1. Open `http://localhost:3001`, log in.
2. Click sidebar → Weekly Digest.
3. If "Belum ada digest" appears, click Generate Now → wait 2-5s → page refreshes with digest text.
4. Click Copy to clipboard → verify the button label flips to "Copied!" for 2s.
5. Open a text editor, paste — verify the text matches what's on screen.
6. Switch brand in the sidebar to Amura → Weekly Digest link now points at `/digest/amura` → same flow.

Document any visual quirks in `/tmp/digest-smoke.txt`.

- [ ] **Step 4: Push dev branch**

```bash
cd "/Users/revardisyahputra/Library/Mobile Documents/com~apple~CloudDocs/Claude/sas-dashboard"
git branch --show-current  # MUST be 'dev'
git log --oneline origin/dev..HEAD
git push origin dev 2>&1 | tail -5
```

- [ ] **Step 5: User-action gate — Vercel preview deploy**

After push, Vercel automatically builds a preview deployment for the `dev` branch. The user must:

1. Open Vercel dashboard → SAS Dashboard project → Deployments
2. Wait for the `dev` deployment to finish (typically 1-3 min)
3. Click the preview URL
4. Log in, navigate to Weekly Digest, verify the digest loads + Copy works
5. Verify env vars `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` are set in Vercel project settings

The cron will not run on a preview deploy (Vercel only schedules crons on Production / main). Verify cron only after promoting to main.

- [ ] **Step 6: User-action gate — promote to main**

When user signals "approved on preview":

```bash
git checkout main
git pull origin main
git merge --no-ff dev -m "Merge dev → main: Weekly Digest Phase 1"
git push origin main
git checkout dev
```

- [ ] **Step 7: Production cron verification**

After Vercel finishes deploying main (1-3 min), the cron is registered. Verify in Vercel → Project → Settings → Cron Jobs that `weekly-digest` appears with schedule `0 2 * * 1`.

Wait until next Monday 02:00 UTC (or trigger manually via Vercel's "Run Now" if available). Then check Supabase digest_log:

```sql
SELECT brand, week_start, generated_at FROM digest_log ORDER BY generated_at DESC LIMIT 5;
```

Expected: 3 fresh rows.

---

## Out of Scope (deferred to investor packet plan)

- Cohort analysis logic — not needed for the digest
- PDF rendering / Puppeteer setup
- `packet_log` table + `upsert_packet_log` RPC
- `/packet` page
- Supabase Storage bucket

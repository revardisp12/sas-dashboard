# KOL Management — Phase 1 (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the KOL Management module (Database KOL, Budget, Campaign, Konten) inside the SAS Dashboard — 4-tab UI, brand-scoped, new `kol_specialist` role, funnel-tier campaign analytics, bulk upload, and a metrics-provider seam so URL→metrics auto-pull turns on later by flipping one env (manual fallback now, no RapidAPI dependency).

**Architecture:** New Supabase tables (`kol_influencers`, `kol_budgets`, `kol_campaigns`, `kol_contents`) with brand-scoped RLS. A `KolView` page (one `ActiveView='kol'`) with 4 internal tabs — ported from the already-approved mockup at `src/app/kol-preview/page.tsx`, swapping mock data for real CRUD via `src/lib/kol/db.ts`. Engagement is analyzed per **funnel tier** (Awareness=Views+Likes, Consideration=Comments+Saves+Shares, Action=Phase 3) via a single config in `src/lib/kol/funnel.ts`. Metrics auto-pull is behind `KolMetricsProvider` (Manual now → RapidApi later), mirroring the WMS adapter seam.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Supabase (`@supabase/supabase-js`, RLS), Vitest, Recharts, PapaParse (existing csvParser).

**PRD:** `docs/superpowers/specs/2026-06-09-kol-management-prd.md`
**Approved UI reference:** `src/app/kol-preview/page.tsx` (throwaway mockup — its components are the visual source of truth; delete the route in Task 10).
**Branch:** `feature/kol-management` (already checked out).

**Convention note (AGENTS.md):** modified Next.js 16 — read `node_modules/next/dist/docs/` before any route/page edit. Deploy workflow: feature → dev → Vercel preview → main. iCloud quirk: local run uses `npx next start` after `npm run build` (NOT `next dev`, which hangs).

---

## File Structure

**Create:**
- `kol_management.sql` — migration: 4 tables + RLS + grants (repo root, like `digest_log.sql`).
- `src/lib/kol/types.ts` — `KolInfluencer`, `KolBudget`, `KolCampaign`, `KolContent`, `Tier`, `Platform`.
- `src/lib/kol/funnel.ts` — `TIER` config (tier→metric mapping) + `awarenessSig`/`considerationSig`/`tierTotals`.
- `src/lib/kol/db.ts` — CRUD for the 4 tables (get/upsert/delete/bulk), snake_case mappers.
- `src/lib/kol/metrics/types.ts` — `KolMetricsProvider` interface + `FetchedMetrics`.
- `src/lib/kol/metrics/manualProvider.ts` — no-op provider (returns null → keep manual).
- `src/lib/kol/metrics/rapidApiProvider.ts` — STUB (throws until go-live).
- `src/lib/kol/metrics/provider.ts` — `getKolMetricsProvider()` factory by `KOL_METRICS_ENABLED`.
- `src/components/kol/KolView.tsx` — shell with 4 tabs (ported from mockup).
- `src/components/kol/DatabaseKolTab.tsx`, `BudgetTab.tsx`, `CampaignTab.tsx`, `KontenTab.tsx`.
- `src/components/kol/BulkUploadBox.tsx` — shared bulk CSV/paste UI (from mockup `BulkBox`).
- `src/app/api/cron/kol-metrics-refresh/route.ts` — cron (no-op in manual mode).
- Tests: `src/lib/kol/funnel.test.ts`, `src/lib/kol/db.test.ts`, `src/lib/kol/metrics/provider.test.ts`.
- `docs/kol-go-live-runbook.md`.

**Modify:**
- `src/lib/supabase.ts` — add `'kol_specialist'` to `UserRole`.
- `src/lib/types.ts` — add `'kol'` to `ActiveView`.
- `src/contexts/AuthContext.tsx` — `ROLE_VIEWS`: add `'kol'` to super_admin/admin, new `kol_specialist: ['kol']`; confirm `accessibleBrands` covers kol_specialist.
- `src/components/Sidebar.tsx` — add "KOL Management" nav entry (gated super_admin/admin/kol_specialist).
- `src/app/page.tsx` — render `{view === 'kol' && <KolView brand={brand} />}`.
- `src/lib/database.types.ts` — add the 4 tables (Task 10).
- `vercel.json` — register the kol-metrics-refresh cron (Task 10).

---

## Task 1: SQL migration (4 tables + RLS + grants)

**Files:** Create `kol_management.sql`

- [ ] **Step 1: Write the migration**

```sql
-- kol_management.sql — run in Supabase SQL editor (production) AFTER review.
-- 4 brand-scoped KOL tables + RLS. Access: super_admin (all brands),
-- admin & kol_specialist (own brand only). Other roles: no access.

CREATE TABLE IF NOT EXISTS kol_influencers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand      TEXT NOT NULL CHECK (brand IN ('reglow','amura','purela')),
  name       TEXT NOT NULL,
  username   TEXT,
  platform   TEXT,                       -- 'Instagram' | 'TikTok' | 'YouTube'
  followers  INTEGER NOT NULL DEFAULT 0,
  niche      TEXT,
  contact    TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kol_budgets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand      TEXT NOT NULL CHECK (brand IN ('reglow','amura','purela')),
  name       TEXT NOT NULL,
  nominal    NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kol_campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand        TEXT NOT NULL CHECK (brand IN ('reglow','amura','purela')),
  name         TEXT NOT NULL,
  budget_id    UUID REFERENCES kol_budgets(id) ON DELETE SET NULL,
  period_start DATE,
  period_end   DATE,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'ended'
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kol_contents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand            TEXT NOT NULL CHECK (brand IN ('reglow','amura','purela')),
  campaign_id      UUID REFERENCES kol_campaigns(id) ON DELETE CASCADE,
  influencer_id    UUID REFERENCES kol_influencers(id) ON DELETE SET NULL,
  platform         TEXT,
  product          TEXT,
  task             TEXT,
  funnel_objective TEXT NOT NULL DEFAULT 'awareness',  -- awareness|consideration|action
  content_url      TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',    -- uploaded|broken|pending
  fee              NUMERIC NOT NULL DEFAULT 0,
  likes            INTEGER NOT NULL DEFAULT 0,
  comments         INTEGER NOT NULL DEFAULT 0,
  saved            INTEGER NOT NULL DEFAULT 0,
  shares           INTEGER NOT NULL DEFAULT 0,
  video_views      INTEGER NOT NULL DEFAULT 0,
  metrics_source   TEXT NOT NULL DEFAULT 'manual',     -- 'api' | 'manual'
  metrics_fetched_at TIMESTAMPTZ,
  posted_at        DATE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['kol_influencers','kol_budgets','kol_campaigns','kol_contents'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_select', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
      USING (get_my_role() = 'super_admin'
             OR (get_my_role() IN ('admin','kol_specialist') AND brand = get_my_brand()))$f$, t||'_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_write', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR ALL TO authenticated
      USING (get_my_role() = 'super_admin'
             OR (get_my_role() IN ('admin','kol_specialist') AND brand = get_my_brand()))
      WITH CHECK (get_my_role() = 'super_admin'
             OR (get_my_role() IN ('admin','kol_specialist') AND brand = get_my_brand()))$f$, t||'_write', t);
  END LOOP;
END $$;

-- Grants (authenticated default already applies via ALTER DEFAULT PRIVILEGES, explicit anyway)
GRANT SELECT, INSERT, UPDATE, DELETE ON kol_influencers, kol_budgets, kol_campaigns, kol_contents TO authenticated;
```

- [ ] **Step 2: Confirm `get_my_role()`/`get_my_brand()` exist** (they do — used by every existing table policy in `schema.sql`).

- [ ] **Step 3: Commit (do NOT run; rollout step)**

```bash
git add kol_management.sql
git commit -m "feat(kol): migration — 4 tables + brand-scoped RLS"
```

---

## Task 2: Role + ActiveView + KOL row types

**Files:** Modify `src/lib/supabase.ts`, `src/lib/types.ts`, `src/contexts/AuthContext.tsx`; Create `src/lib/kol/types.ts`

- [ ] **Step 1: Add the role + view**

In `src/lib/supabase.ts` change the role union:
```typescript
export type UserRole = 'super_admin' | 'admin' | 'manager' | 'cs' | 'crm' | 'kol_specialist'
```
In `src/lib/types.ts` add `'kol'` to `ActiveView`:
```typescript
export type ActiveView = Platform | 'overview' | 'funnel' | 'performance' | 'sales' | 'crm' | 'product-analysis' | 'settings' | 'kol'
```

- [ ] **Step 2: Wire role access**

In `src/contexts/AuthContext.tsx`, in `ROLE_VIEWS`: append `'kol'` to the `super_admin` and `admin` arrays, and add a new entry `kol_specialist: ['kol']`. (Read the existing `ROLE_VIEWS` object first; keep all existing views intact.) Confirm `accessibleBrands` (super_admin → all; else → `[profile.brand]`) already yields the right brand for a `kol_specialist`; no change needed if `profile.brand` is set.

- [ ] **Step 3: Create KOL types** `src/lib/kol/types.ts`

```typescript
export type Tier = 'awareness' | 'consideration' | 'action'
export type KolPlatform = 'Instagram' | 'TikTok' | 'YouTube'

export interface KolInfluencer {
  id: string; brand: string; name: string; username: string; platform: string
  followers: number; niche: string; contact: string; notes: string
}
export interface KolBudget { id: string; brand: string; name: string; nominal: number }
export interface KolCampaign {
  id: string; brand: string; name: string; budgetId: string | null
  periodStart: string | null; periodEnd: string | null; description: string; status: 'active' | 'ended'
}
export interface KolContent {
  id: string; brand: string; campaignId: string | null; influencerId: string | null
  platform: string; product: string; task: string; objective: Tier; contentUrl: string
  status: 'uploaded' | 'broken' | 'pending'; fee: number
  likes: number; comments: number; saved: number; shares: number; views: number
  metricsSource: 'api' | 'manual'; metricsFetchedAt: string | null; postedAt: string | null
}
```

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit` → PASS
```bash
git add src/lib/supabase.ts src/lib/types.ts src/contexts/AuthContext.tsx src/lib/kol/types.ts
git commit -m "feat(kol): add kol_specialist role, 'kol' view, KOL row types"
```

---

## Task 3: Funnel model + metrics provider seam

**Files:** Create `src/lib/kol/funnel.ts` (+test), `src/lib/kol/metrics/{types,manualProvider,rapidApiProvider,provider}.ts` (+test)

- [ ] **Step 1: Write failing funnel test** `src/lib/kol/funnel.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { awarenessSig, considerationSig, tierTotals, TIER } from './funnel'
import type { KolContent } from './types'

const c = (over: Partial<KolContent>): KolContent => ({
  id: 'x', brand: 'reglow', campaignId: null, influencerId: null, platform: 'TikTok',
  product: '', task: '', objective: 'awareness', contentUrl: '', status: 'uploaded', fee: 0,
  likes: 0, comments: 0, saved: 0, shares: 0, views: 0, metricsSource: 'manual',
  metricsFetchedAt: null, postedAt: null, ...over,
})

describe('funnel signals', () => {
  it('awareness = views + likes', () => {
    expect(awarenessSig(c({ views: 1000, likes: 50 }))).toBe(1050)
  })
  it('consideration = comments + saved + shares', () => {
    expect(considerationSig(c({ comments: 10, saved: 5, shares: 2 }))).toBe(17)
  })
  it('tierTotals sums per tier across content', () => {
    const t = tierTotals([c({ views: 100, likes: 10 }), c({ comments: 3, saved: 1, shares: 1 })])
    expect(t.awareness).toBe(121)        // (100+10) + (0+0)
    expect(t.consideration).toBe(5)      // (0) + (3+1+1)
  })
  it('TIER has 3 tiers with labels', () => {
    expect(Object.keys(TIER)).toEqual(['awareness', 'consideration', 'action'])
  })
})
```
Run: `npx vitest run src/lib/kol/funnel.test.ts` → FAIL (module not found).

- [ ] **Step 2: Implement** `src/lib/kol/funnel.ts`

```typescript
import type { Tier, KolContent } from './types'

// Marcomm funnel mapping — single source of truth. Tune here only.
export const TIER: Record<Tier, { label: string; color: string; bg: string; fg: string; desc: string }> = {
  awareness:     { label: 'Awareness',     color: '#0EA5E9', bg: '#E0F2FE', fg: '#075985', desc: 'Views + Likes' },
  consideration: { label: 'Consideration', color: '#8B5CF6', bg: '#EDE9FE', fg: '#5B21B6', desc: 'Comments + Saves + Shares' },
  action:        { label: 'Action',        color: '#10B981', bg: '#D1FAE5', fg: '#065F46', desc: 'Clicks + Promo (Phase 3)' },
}
export const awarenessSig = (c: KolContent) => c.views + c.likes
export const considerationSig = (c: KolContent) => c.comments + c.saved + c.shares
export function tierTotals(contents: KolContent[]) {
  return contents.reduce(
    (acc, c) => ({ awareness: acc.awareness + awarenessSig(c), consideration: acc.consideration + considerationSig(c), action: acc.action }),
    { awareness: 0, consideration: 0, action: 0 },
  )
}
```
Run the test → PASS (4 tests).

- [ ] **Step 3: Metrics provider seam** — create the four files:

`src/lib/kol/metrics/types.ts`:
```typescript
export interface FetchedMetrics { likes: number; comments: number; saved: number; shares: number; views: number }
export interface KolMetricsProvider {
  readonly mode: 'manual' | 'live'
  /** Returns metrics for a content URL, or null if it can't (caller keeps manual values). */
  fetch(url: string, platform: string): Promise<FetchedMetrics | null>
}
```
`src/lib/kol/metrics/manualProvider.ts`:
```typescript
import type { KolMetricsProvider } from './types'
// No-op: in manual mode metrics are entered by hand. Always returns null.
export class ManualProvider implements KolMetricsProvider {
  readonly mode = 'manual' as const
  async fetch(): Promise<null> { return null }
}
```
`src/lib/kol/metrics/rapidApiProvider.ts`:
```typescript
import type { KolMetricsProvider, FetchedMetrics } from './types'
const NOT_IMPL = 'RapidApiProvider not implemented — set up RapidAPI + implement before KOL_METRICS_ENABLED=live (see docs/kol-go-live-runbook.md)'
/** Go-live: call RapidAPI Instagram Statistics API by URL, map response → FetchedMetrics. */
export class RapidApiProvider implements KolMetricsProvider {
  readonly mode = 'live' as const
  constructor(private apiKey: string) {}
  async fetch(_url: string, _platform: string): Promise<FetchedMetrics | null> { throw new Error(NOT_IMPL) }
}
```
`src/lib/kol/metrics/provider.ts`:
```typescript
import type { KolMetricsProvider } from './types'
import { ManualProvider } from './manualProvider'
import { RapidApiProvider } from './rapidApiProvider'
export function getKolMetricsProvider(): KolMetricsProvider {
  if ((process.env.KOL_METRICS_ENABLED ?? 'manual') === 'live') {
    const key = process.env.RAPIDAPI_KEY
    if (!key) throw new Error('KOL live mode requires RAPIDAPI_KEY')
    return new RapidApiProvider(key)
  }
  return new ManualProvider()
}
```

- [ ] **Step 4: Provider test** `src/lib/kol/metrics/provider.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { ManualProvider } from './manualProvider'

describe('ManualProvider', () => {
  it('is manual mode and returns null (keep manual entry)', async () => {
    const p = new ManualProvider()
    expect(p.mode).toBe('manual')
    expect(await p.fetch('https://x', 'TikTok')).toBeNull()
  })
})
```
Run: `npx vitest run src/lib/kol/` → all PASS. `npx tsc --noEmit` PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kol/funnel.ts src/lib/kol/funnel.test.ts src/lib/kol/metrics/ && git commit -m "feat(kol): funnel-tier config + metrics provider seam (manual now)"
```

---

## Task 4: KOL data layer (`src/lib/kol/db.ts`)

**Files:** Create `src/lib/kol/db.ts` (+ `src/lib/kol/db.test.ts` for pure mappers)

Keep CRUD in a dedicated file (not the already-large `src/lib/db.ts`). Follow the existing `db.ts` style: `import { supabase } from '@/lib/supabase'`, `.from(table).select('*').eq('brand', brand)`, throw on error, snake_case↔camelCase mapping.

- [ ] **Step 1: Write failing mapper test** `src/lib/kol/db.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { contentToRow, rowToContent } from './db'

describe('kol content mapping', () => {
  it('round-trips content row (camel↔snake)', () => {
    const row = { id: 'k1', brand: 'reglow', campaign_id: 'c1', influencer_id: 'i1', platform: 'TikTok',
      product: 'Serum', task: 'Review', funnel_objective: 'consideration', content_url: 'tiktok.com/x',
      status: 'uploaded', fee: 1000, likes: 5, comments: 2, saved: 1, shares: 1, video_views: 900,
      metrics_source: 'manual', metrics_fetched_at: null, posted_at: '2026-06-01' }
    const c = rowToContent(row)
    expect(c.objective).toBe('consideration')
    expect(c.views).toBe(900)
    expect(c.campaignId).toBe('c1')
    const back = contentToRow(c, 'reglow')
    expect(back.video_views).toBe(900)
    expect(back.funnel_objective).toBe('consideration')
    expect(back.brand).toBe('reglow')
  })
})
```
Run → FAIL.

- [ ] **Step 2: Implement** `src/lib/kol/db.ts` — exported pure mappers + CRUD. Pattern per entity (showing content + influencer; budgets/campaigns follow identically):

```typescript
import { supabase } from '@/lib/supabase'
import type { KolInfluencer, KolBudget, KolCampaign, KolContent, Tier } from './types'

type Row = Record<string, unknown>
const s = (v: unknown) => (v == null ? '' : String(v))
const n = (v: unknown) => Number(v ?? 0)

// ── content ──
export function rowToContent(r: Row): KolContent {
  return {
    id: s(r.id), brand: s(r.brand), campaignId: r.campaign_id ? s(r.campaign_id) : null,
    influencerId: r.influencer_id ? s(r.influencer_id) : null, platform: s(r.platform),
    product: s(r.product), task: s(r.task), objective: (s(r.funnel_objective) || 'awareness') as Tier,
    contentUrl: s(r.content_url), status: (s(r.status) || 'pending') as KolContent['status'], fee: n(r.fee),
    likes: n(r.likes), comments: n(r.comments), saved: n(r.saved), shares: n(r.shares), views: n(r.video_views),
    metricsSource: (s(r.metrics_source) || 'manual') as 'api' | 'manual',
    metricsFetchedAt: r.metrics_fetched_at ? s(r.metrics_fetched_at) : null,
    postedAt: r.posted_at ? s(r.posted_at) : null,
  }
}
export function contentToRow(c: Partial<KolContent>, brand: string) {
  return {
    brand, campaign_id: c.campaignId ?? null, influencer_id: c.influencerId ?? null, platform: c.platform,
    product: c.product, task: c.task, funnel_objective: c.objective ?? 'awareness', content_url: c.contentUrl,
    status: c.status ?? 'pending', fee: c.fee ?? 0, likes: c.likes ?? 0, comments: c.comments ?? 0,
    saved: c.saved ?? 0, shares: c.shares ?? 0, video_views: c.views ?? 0,
    metrics_source: c.metricsSource ?? 'manual', metrics_fetched_at: c.metricsFetchedAt ?? null,
    posted_at: c.postedAt ?? null,
  }
}
export async function getContents(brand: string, campaignId?: string): Promise<KolContent[]> {
  let q = supabase.from('kol_contents').select('*').eq('brand', brand)
  if (campaignId) q = q.eq('campaign_id', campaignId)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(r => rowToContent(r as Row))
}
export async function upsertContent(c: Partial<KolContent> & { id?: string }, brand: string): Promise<void> {
  const payload = contentToRow(c, brand)
  const { error } = c.id
    ? await supabase.from('kol_contents').update(payload).eq('id', c.id)
    : await supabase.from('kol_contents').insert(payload)
  if (error) throw error
}
export async function deleteContent(id: string): Promise<void> {
  const { error } = await supabase.from('kol_contents').delete().eq('id', id)
  if (error) throw error
}
export async function bulkInsertContents(rows: Partial<KolContent>[], brand: string): Promise<void> {
  if (!rows.length) return
  const { error } = await supabase.from('kol_contents').insert(rows.map(r => contentToRow(r, brand)))
  if (error) throw error
}

// ── influencer (same shape; budgets + campaigns follow the identical pattern) ──
export function rowToInfluencer(r: Row): KolInfluencer {
  return { id: s(r.id), brand: s(r.brand), name: s(r.name), username: s(r.username), platform: s(r.platform),
    followers: n(r.followers), niche: s(r.niche), contact: s(r.contact), notes: s(r.notes) }
}
export function influencerToRow(i: Partial<KolInfluencer>, brand: string) {
  return { brand, name: i.name, username: i.username, platform: i.platform, followers: i.followers ?? 0,
    niche: i.niche, contact: i.contact, notes: i.notes }
}
export async function getInfluencers(brand: string): Promise<KolInfluencer[]> {
  const { data, error } = await supabase.from('kol_influencers').select('*').eq('brand', brand).order('name')
  if (error) throw error
  return (data ?? []).map(r => rowToInfluencer(r as Row))
}
export async function upsertInfluencer(i: Partial<KolInfluencer> & { id?: string }, brand: string): Promise<void> {
  const payload = influencerToRow(i, brand)
  const { error } = i.id
    ? await supabase.from('kol_influencers').update(payload).eq('id', i.id)
    : await supabase.from('kol_influencers').insert(payload)
  if (error) throw error
}
export async function deleteInfluencer(id: string): Promise<void> {
  const { error } = await supabase.from('kol_influencers').delete().eq('id', id); if (error) throw error
}
export async function bulkInsertInfluencers(rows: Partial<KolInfluencer>[], brand: string): Promise<void> {
  if (!rows.length) return
  const { error } = await supabase.from('kol_influencers').insert(rows.map(r => influencerToRow(r, brand)))
  if (error) throw error
}
```

Also implement, following the **identical** pattern (write the code in full — do not abbreviate):
`rowToBudget`/`budgetToRow`/`getBudgets`/`upsertBudget`/`deleteBudget` (fields: name, nominal), and
`rowToCampaign`/`campaignToRow`/`getCampaigns`/`upsertCampaign`/`deleteCampaign` (fields: name,
budget_id↔budgetId, period_start↔periodStart, period_end↔periodEnd, description, status).

Run the test → PASS. `npx tsc --noEmit` PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/kol/db.ts src/lib/kol/db.test.ts && git commit -m "feat(kol): data layer CRUD + bulk for 4 entities"
```

---

## Task 5: KolView shell + nav + routing

**Files:** Create `src/components/kol/KolView.tsx`, `src/components/kol/BulkUploadBox.tsx`; Modify `src/components/Sidebar.tsx`, `src/app/page.tsx`

The mockup `src/app/kol-preview/page.tsx` already contains the full visual structure (tabs, tier cards, tables, BulkBox). Port its pieces into real components; this task does the shell + nav, later tasks fill each tab with real data.

- [ ] **Step 1: Sidebar entry** — in `src/components/Sidebar.tsx`, add a "KOL Management" nav item that calls `onViewChange('kol')`, gated to `userRole` in `super_admin`/`admin`/`kol_specialist` (match the existing gating used for admin-only items; reuse an existing lucide icon e.g. `Users` or `Megaphone`).

- [ ] **Step 2: KolView shell** `src/components/kol/KolView.tsx` — a `'use client'` component:
```tsx
'use client'
import { useState } from 'react'
import type { Brand } from '@/lib/types'
import DatabaseKolTab from './DatabaseKolTab'
import BudgetTab from './BudgetTab'
import CampaignTab from './CampaignTab'
import KontenTab from './KontenTab'

type Tab = 'campaign' | 'konten' | 'budget' | 'db'
export default function KolView({ brand }: { brand: Brand }) {
  const [tab, setTab] = useState<Tab>('campaign')
  return (
    <div style={{ padding: 4 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #E5E7EB' }}>
        {([['campaign','Campaign'],['konten','Konten KOL'],['budget','Budget'],['db','Database KOL']] as const).map(([k,label]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: '10px 16px', fontSize: 14, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', color: tab===k ? '#0EA5E9' : '#6B7280', borderBottom: `2px solid ${tab===k ? '#0EA5E9' : 'transparent'}`, marginBottom: -1 }}>{label}</button>
        ))}
      </div>
      {tab === 'campaign' && <CampaignTab brand={brand} />}
      {tab === 'konten' && <KontenTab brand={brand} />}
      {tab === 'budget' && <BudgetTab brand={brand} />}
      {tab === 'db' && <DatabaseKolTab brand={brand} />}
    </div>
  )
}
```

- [ ] **Step 3: Shared BulkUploadBox** — port `BulkBox` + `btnPrimary`/`btnOutline` from the mockup into `src/components/kol/BulkUploadBox.tsx`, exporting `BulkUploadBox` and the button styles for reuse.

- [ ] **Step 4: Temporary tab stubs** — create `DatabaseKolTab.tsx`/`BudgetTab.tsx`/`CampaignTab.tsx`/`KontenTab.tsx` each as `export default function X({ brand }: { brand: Brand }) { return <p>…</p> }` so the shell compiles. (Tasks 6–9 replace each.)

- [ ] **Step 5: Wire page.tsx** — add `import KolView from '@/components/kol/KolView'` and, alongside the other `view === …` lines (~441), add: `{view === 'kol' && <KolView brand={brand} />}`.

- [ ] **Step 6: Build + commit**

Run: `npm run build` → PASS, `/` still builds. Manual: build then `npx next start`, log in as super_admin, open KOL Management → 4 empty tabs render, tab switching works.
```bash
git add src/components/kol/ src/components/Sidebar.tsx src/app/page.tsx && git commit -m "feat(kol): KolView shell + sidebar nav + routing"
```

---

## Task 6: Database KOL tab (CRUD + bulk CSV)

**Files:** Replace `src/components/kol/DatabaseKolTab.tsx`

- [ ] **Step 1: Implement** — load `getInfluencers(brand)` in an effect (use the existing project pattern: `useEffect` with an `// eslint-disable-next-line react-hooks/set-state-in-effect` + justification, as in `UserManagement.tsx`). Render the influencer table (port the mockup's Database table markup). Add:
  - "+ Tambah Influencer" → inline form/modal (name, username, platform select IG/TikTok/YouTube, followers, niche, contact) → `upsertInfluencer` → reload.
  - Row edit (prefill form, `upsertInfluencer` with id) + delete (`deleteInfluencer`).
  - "⬆ Bulk Upload" → `BulkUploadBox` (columns: name, username, platform, followers, niche, contact). On CSV file, parse with PapaParse (mirror `src/lib/csvParser.ts` usage), map rows → `bulkInsertInfluencers(rows, brand)` → reload. Provide a "Download template" that emits the header row.
- [ ] **Step 2: Build + manual smoke** (add an influencer, edit, delete, CSV import) → all reflect after reload.
- [ ] **Step 3: Commit** — `git commit -m "feat(kol): Database KOL tab — CRUD + CSV bulk import"`

---

## Task 7: Budget tab (CRUD + utilization)

**Files:** Replace `src/components/kol/BudgetTab.tsx`

- [ ] **Step 1: Implement** — load `getBudgets(brand)` + `getContents(brand)` (to compute utilization). For each budget, find campaigns on it (`getCampaigns(brand)` filtered by `budgetId`) and sum the fees of their contents; render the mockup's progress-bar card (used/remaining, over-budget warning). Add "+ Tambah Budget" (name, nominal) → `upsertBudget`, plus edit/delete.
- [ ] **Step 2: Build + manual smoke.**
- [ ] **Step 3: Commit** — `git commit -m "feat(kol): Budget tab — CRUD + utilization from content fees"`

---

## Task 8: Campaign tab (CRUD + funnel-tier analytics + leaderboard)

**Files:** Replace `src/components/kol/CampaignTab.tsx`

- [ ] **Step 1: Implement** — load `getCampaigns(brand)`; a campaign selector (default first active). For the selected campaign load `getContents(brand, campaignId)` + `getInfluencers(brand)` (for names). Render (port the mockup's `Campaign` component, real data):
  - **Funnel-tier cards** via `tierTotals(liveContents)` from `funnel.ts` — Awareness / Consideration / Action(soon), each with count of content whose `objective === tier`.
  - **Efficiency cards:** total views, total fee, CPV = totalFee/totalViews.
  - **Trend chart** (Recharts): awareness vs consideration signals grouped by `postedAt`.
  - **Leaderboard:** content ranked by `views`, with objective badge (use `TIER[c.objective]`).
  - Campaign CRUD (name, budget select, period_start/end, description, status) via `upsertCampaign`/`deleteCampaign`.
- [ ] **Step 2: Build + manual smoke** (create campaign, add content via Konten tab, see cards populate).
- [ ] **Step 3: Commit** — `git commit -m "feat(kol): Campaign tab — funnel-tier cards + trend + leaderboard"`

---

## Task 9: Konten tab (CRUD + bulk link + auto-pull seam)

**Files:** Replace `src/components/kol/KontenTab.tsx`

- [ ] **Step 1: Implement** — load `getContents(brand)` + `getInfluencers(brand)` + `getCampaigns(brand)`. Render the mockup's Konten table (Influencer, Plat, Objektif badge, Produk, URL, Status, Fee, Views, Likes, Source). Add:
  - "+ Tambah Konten" form: campaign select, influencer select, platform, objective select (awareness/consideration/action), product, task, content_url, fee, status. On save → `upsertContent`.
  - **Auto-pull on save:** after building the content, call `getKolMetricsProvider().fetch(url, platform)`; if it returns metrics, merge them + set `metricsSource='api'` + `metricsFetchedAt=now` before `upsertContent`; if null (manual mode), keep manual values. Because metrics-pull needs server-side env (`KOL_METRICS_ENABLED`/`RAPIDAPI_KEY`), expose it via a thin route `POST /api/kol/pull-metrics` (Bearer JWT, role-gated like `/api/wms/sync`) that runs the provider and returns metrics; the tab calls it. (In manual mode the route returns `{ metrics: null }`.)
  - **Bulk Upload Link:** `BulkUploadBox` with the paste-links textarea (one URL per line) + CSV. On submit, create a content row per line (status `pending`, objective default `awareness`) and, in live mode, pull metrics per row via the same route; `bulkInsertContents`.
- [ ] **Step 2: Build + manual smoke** (add content manually, bulk-paste 3 links → 3 rows created; in manual mode metrics stay 0 until typed).
- [ ] **Step 3: Commit** — `git commit -m "feat(kol): Konten tab — CRUD + bulk link + metrics auto-pull seam"`

---

## Task 10: Cron, types regen, cleanup, runbook, gate

**Files:** Create `src/app/api/cron/kol-metrics-refresh/route.ts`, `src/app/api/kol/pull-metrics/route.ts` (if not added in Task 9), `docs/kol-go-live-runbook.md`; Modify `src/lib/database.types.ts`, `vercel.json`; Delete `src/app/kol-preview/`

- [ ] **Step 1: Metrics-refresh cron** — `POST /api/cron/kol-metrics-refresh`, `CRON_SECRET` bearer + `!process.env.CRON_SECRET` guard (per the WMS hardening). No-op in manual mode:
```typescript
if ((process.env.KOL_METRICS_ENABLED ?? 'manual') !== 'live') {
  return NextResponse.json({ skipped: true, reason: 'manual mode' }, { status: 200 })
}
```
In live mode: for each brand, for active campaigns' contents, re-pull via `getKolMetricsProvider()` and update rows. Wrap in try/catch → structured 500 (mirror `/api/cron/wms-sync`).

- [ ] **Step 2: Register cron** in `vercel.json` crons array: `{ "path": "/api/cron/kol-metrics-refresh", "schedule": "0 3 * * 1,4" }` (Mon & Thu 03:00 UTC ≈ 2×/week).

- [ ] **Step 3: database.types.ts** — add Row/Insert/Update for `kol_influencers`, `kol_budgets`, `kol_campaigns`, `kol_contents` mirroring the migration columns (so `supabase.from('kol_*')` is typed; if any `.from()` call needed an `as any` during Tasks 4–9, drop it now).

- [ ] **Step 4: Delete the mockup** — `git rm -r src/app/kol-preview` (its job is done; the real KolView replaces it).

- [ ] **Step 5: Runbook** `docs/kol-go-live-runbook.md`:
```markdown
# KOL Metrics Go-Live Runbook
When RapidAPI is subscribed:
1. Implement `src/lib/kol/metrics/rapidApiProvider.ts` — call RapidAPI "Instagram Statistics API"
   by content URL, map response → FetchedMetrics (IG/TikTok/YouTube). Interface contract is
   `src/lib/kol/metrics/types.ts`.
2. Set Vercel env (all envs): `RAPIDAPI_KEY`, `KOL_METRICS_ENABLED=live`.
3. Deploy to dev, add a content with a real public URL → metrics auto-fill (`metrics_source=api`).
4. Confirm the kol-metrics-refresh cron (Mon/Thu) updates active-campaign content. Merge dev→main.
Plan ≥ 1000 req/mo (≈ 800 content × 2 refresh/wk).
```

- [ ] **Step 6: Full gate** — `npm test` (existing + new kol suites pass), `npm run lint` (0 errors), `npm run build` (PASS, `/kol` route gone — it's inside `/`; `/api/cron/kol-metrics-refresh` + `/api/kol/pull-metrics` listed), `npx tsc --noEmit`.

- [ ] **Step 7: Commit** — `git commit -m "feat(kol): metrics cron + db types + go-live runbook; remove preview mockup"`

---

## Rollout (after merge — user-side)

1. Run `kol_management.sql` in Supabase.
2. Assign a `kol_specialist` user a `brand` in `user_profiles` (test access).
3. Vercel env (all envs): `KOL_METRICS_ENABLED=manual` (flip to `live` + add `RAPIDAPI_KEY` at go-live).
4. Push feature → dev → verify preview (`next start`) → merge to main.

---

## Self-Review (against PRD)

- **4 modules** (Database/Budget/Campaign/Konten) → Tasks 5–9. ✓
- **kol_specialist role + brand RLS** → Task 1 (RLS), Task 2 (role + canAccess). ✓
- **Funnel-tier model (no per-content score)** → Task 3 funnel.ts + Task 8 cards/leaderboard-by-views. ✓
- **Auto-pull by URL, manual fallback, adapter seam, env switch** → Task 3 provider + Task 9 on-save + Task 10 cron. ✓
- **Bulk upload (CSV + paste links)** → Task 6 (CSV influencers) + Task 9 (paste links/CSV content). ✓
- **Budget utilization from fees** → Task 7. ✓
- **Data model** → Task 1 schema matches PRD §7 (incl. funnel_objective, metrics_source). ✓
- **Phasing:** Phase 1 manual; Phase 2 = flip env + implement RapidApiProvider (runbook, Task 10). ✓
- **Out of scope** (ROI/attribution, outreach/contracts) → not planned. ✓

Types consistent across tasks: `KolContent.objective: Tier`, `KolMetricsProvider.fetch`, `tierTotals`,
`getContents`/`upsertContent`, `getKolMetricsProvider` used uniformly. No placeholders in code steps.
```

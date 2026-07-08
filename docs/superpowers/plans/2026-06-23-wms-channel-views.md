# WMS Channel Views + Per-Transaction Marketplace + Date-Range Sync — Implementation Plan

> **⚠️ SUPERSEDED (2026-07-08):** the revenue-status whitelist and CS-via-channel--3
> mapping described below were replaced shortly after this plan shipped — revenue status
> is now a denylist and CS is sourced from `/social-commerce/orders` (customer_type split).
> See `src/lib/channels.ts` and `src/lib/wms/httpAdapter.ts` for the current, correct logic.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every tracked WMS sales channel into its own per-transaction view (filtered from one `sales` table), add Tokopedia + Lazada, exclude non-revenue orders, and let the user sync any date range from the dashboard.

**Architecture:** The WMS adapter already writes orders to `sales` with a `channel` field. We (a) filter the adapter to 5 tracked channels + revenue statuses, mapping `channel_id` → a canonical channel key; (b) render each channel via one reusable `ChannelSalesView` that filters `bd.sales` by channel; (c) regroup the sidebar into a MARKETPLACE section; (d) turn the brand sync button into a date-range popover.

**Tech Stack:** Next.js (App Router) + TypeScript, Supabase (Postgres), Vitest, Recharts, Tailwind. Repo: `sas-dashboard` (branch off `dev`).

**Spec:** `docs/superpowers/specs/2026-06-23-wms-channel-views-design.md`

**Pre-work:** Create a feature branch off `dev`:
```bash
cd "/Users/revardisyahputra/Library/Mobile Documents/com~apple~CloudDocs/Claude/sas-dashboard"
git checkout dev && git pull && git checkout -b feature/wms-channel-views
```

---

## File Structure

- **Create** `src/lib/channels.ts` — canonical channel keys, labels, WMS `channel_id`→key map, revenue-status whitelist. Single source of truth for both adapter and views.
- **Modify** `src/lib/wms/httpAdapter.ts` — filter channels + statuses, map to canonical channel.
- **Modify** `src/lib/wms/httpAdapter.test.ts` — tests for filtering.
- **Modify** `src/lib/types.ts` — add `tokopedia`/`lazada` to `ActiveView`.
- **Modify** `src/contexts/AuthContext.tsx` — add `tokopedia`/`lazada` to `ROLE_VIEWS`.
- **Create** `src/components/views/ChannelSalesView.tsx` — reusable per-channel transaction view.
- **Modify** `src/app/page.tsx` — `VIEW_LABELS`, route 5 channel views to `ChannelSalesView`.
- **Modify** `src/components/Sidebar.tsx` — MARKETPLACE section.
- **Modify** `src/components/views/OverviewView.tsx` — revenue/orders from `sales` only.
- **Modify** `src/app/api/wms/sync/route.ts` — accept `start`/`end` + cap.
- **Modify** `src/components/wms/BrandSyncButton.tsx` — date-range popover.

---

### Task 1: Channel + status constants (single source of truth)

**Files:**
- Create: `src/lib/channels.ts`
- Test: `src/lib/channels.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/channels.test.ts
import { describe, it, expect } from 'vitest'
import { channelForId, isRevenueStatus, CHANNELS, channelLabel } from './channels'

describe('channels', () => {
  it('maps tracked WMS channel_id to canonical key', () => {
    expect(channelForId(4)).toBe('shopee')
    expect(channelForId(6)).toBe('tiktok')
    expect(channelForId(7)).toBe('tokopedia')
    expect(channelForId(5)).toBe('lazada')
    expect(channelForId(-3)).toBe('cs')
  })
  it('returns null for untracked channels (manual, distributor, etc.)', () => {
    expect(channelForId(1)).toBeNull()   // Manual
    expect(channelForId(-4)).toBeNull()  // Distributor
    expect(channelForId(2)).toBeNull()   // Open API
  })
  it('whitelists only revenue statuses', () => {
    expect(isRevenueStatus('completed')).toBe(true)
    expect(isRevenueStatus('paid')).toBe(true)
    expect(isRevenueStatus('sent')).toBe(true)
    expect(isRevenueStatus('cancelled')).toBe(false)
    expect(isRevenueStatus('pending')).toBe(false)
    expect(isRevenueStatus('request_return')).toBe(false)
  })
  it('exposes the 5 channels with labels', () => {
    expect(CHANNELS.map(c => c.key)).toEqual(['shopee', 'tiktok', 'tokopedia', 'lazada', 'cs'])
    expect(channelLabel('cs')).toBe('Customer Services')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/channels.test.ts`
Expected: FAIL — cannot find module `./channels`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/channels.ts

/** Canonical channel keys stored in sales.channel. */
export type ChannelKey = 'shopee' | 'tiktok' | 'tokopedia' | 'lazada' | 'cs'

export const CHANNELS: { key: ChannelKey; label: string }[] = [
  { key: 'shopee', label: 'Shopee' },
  { key: 'tiktok', label: 'TikTok Shop' },
  { key: 'tokopedia', label: 'Tokopedia' },
  { key: 'lazada', label: 'Lazada' },
  { key: 'cs', label: 'Customer Services' },
]

/** WMS channel_id -> canonical key. Anything not listed is dropped (Manual, Distributor, etc.). */
const ID_TO_CHANNEL: Record<number, ChannelKey> = {
  4: 'shopee',
  6: 'tiktok',
  7: 'tokopedia',
  5: 'lazada',
  [-3]: 'cs',
}

export function channelForId(id: number): ChannelKey | null {
  return ID_TO_CHANNEL[id] ?? null
}

export function channelLabel(key: ChannelKey): string {
  return CHANNELS.find(c => c.key === key)?.label ?? key
}

/** Order statuses that count as revenue. Everything else (pending/cancelled/returned/…) is excluded. */
const REVENUE_STATUSES = new Set(['paid', 'packing', 'packed', 'pick', 'process', 'sent', 'completed'])

export function isRevenueStatus(status: string): boolean {
  return REVENUE_STATUSES.has(status)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/channels.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/channels.ts src/lib/channels.test.ts
git commit -m "feat(wms): channel + revenue-status constants"
```

---

### Task 2: Adapter filters channels + statuses

**Files:**
- Modify: `src/lib/wms/httpAdapter.ts`
- Modify: `src/lib/wms/httpAdapter.test.ts`

- [ ] **Step 1: Update the failing test** — replace the "maps orders/list orders to SalesRow across all channels" test in `httpAdapter.test.ts` with one that asserts filtering:

```ts
  it('keeps only tracked channels + revenue statuses, mapping channel to canonical', async () => {
    stubFetch((url) => {
      if (url.includes('/orders/list')) {
        return {
          code: 200,
          data: [
            { id: 1, channel_id: 4, status: 'completed', order_at: '2026-06-21T10:00:00+07:00', qty: 1, amount: 100000, cogs: 90000, channel_name: 'Shopee', product_summary: 'A' },
            { id: 2, channel_id: -3, status: 'paid', order_at: '2026-06-21T10:00:00+07:00', qty: 1, amount: 50000, cogs: 40000, channel_name: 'Customer Services', product_summary: 'B' },
            { id: 3, channel_id: 1, status: 'completed', order_at: '2026-06-21T10:00:00+07:00', qty: 1, amount: 999, cogs: 0, channel_name: 'Manual', product_summary: 'C' },      // Manual -> dropped
            { id: 4, channel_id: 4, status: 'cancelled', order_at: '2026-06-21T10:00:00+07:00', qty: 1, amount: 777, cogs: 0, channel_name: 'Shopee', product_summary: 'D' },     // cancelled -> dropped
            { id: 5, channel_id: 4, status: 'pending', order_at: '2026-06-21T10:00:00+07:00', qty: 1, amount: 555, cogs: 0, channel_name: 'Shopee', product_summary: 'E' },       // pending -> dropped
          ],
          metadata: { count: 5 },
        }
      }
      return { code: 200, data: [], metadata: { count: 0 } }
    })

    const rows = await new HttpWmsAdapter(BASE, KEY).fetchSales('reglow', { start: '2026-06-01', end: '2026-06-21' })

    expect(rows.map(r => r.wmsId)).toEqual(['ord-1', 'ord-2'])     // only the 2 tracked+revenue orders
    expect(rows[0]).toMatchObject({ channel: 'shopee', revenue: 100000 })
    expect(rows[1]).toMatchObject({ channel: 'cs', revenue: 50000 })
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/wms/httpAdapter.test.ts`
Expected: FAIL — currently channel is `channel_name` ("Shopee" not "shopee") and Manual/cancelled/pending are not dropped.

- [ ] **Step 3: Update the implementation** — in `src/lib/wms/httpAdapter.ts`:

(a) add import at top:
```ts
import { channelForId, isRevenueStatus } from '@/lib/channels'
```

(b) extend the `WmsOrder` interface to include the fields we now read:
```ts
interface WmsOrder {
  id: number
  order_at: string
  qty: number
  amount: number
  cogs: number
  channel_id: number
  channel_name: string
  status: string
  product_summary: string
}
```

(c) replace the `return orders.map(...)` block in `fetchSales` with a filtering map:
```ts
    const rows: WithWmsId<SalesRow>[] = []
    for (const o of orders) {
      const channel = channelForId(o.channel_id)
      if (!channel) continue                 // untracked channel (Manual, Distributor, …)
      if (!isRevenueStatus(o.status)) continue // pending/cancelled/returned/…
      const revenue = num(o.amount)
      const cogs = num(o.cogs)
      rows.push({
        wmsId: `ord-${o.id}`,
        date: dateOnly(o.order_at),
        product: o.product_summary ?? '',
        qty: num(o.qty),
        revenue,
        channel,                              // canonical key, e.g. 'shopee'
        cogs,
        grossProfit: revenue - cogs,
        source: 'organic',
        origin: 'wms',
      })
    }
    return rows
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/wms`
Expected: PASS (all WMS tests; the filtering test + existing pagination/retry/products tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit 2>&1 | grep wms/httpAdapter || echo "clean"
git add src/lib/wms/httpAdapter.ts src/lib/wms/httpAdapter.test.ts
git commit -m "feat(wms): adapter filters to tracked channels + revenue statuses"
```

---

### Task 3: Add tokopedia/lazada to ActiveView + role access

**Files:**
- Modify: `src/lib/types.ts:3`
- Modify: `src/contexts/AuthContext.tsx` (ROLE_VIEWS, lines ~21-28)

- [ ] **Step 1: Add the view values** — in `src/lib/types.ts`, replace the `ActiveView` line:

```ts
export type ActiveView = Platform | 'overview' | 'funnel' | 'performance' | 'sales' | 'crm' | 'product-analysis' | 'settings' | 'kol' | 'cads-calculator' | 'tokopedia' | 'lazada'
```

- [ ] **Step 2: Grant access** — in `src/contexts/AuthContext.tsx`, add `'tokopedia','lazada'` to the `super_admin`, `admin`, and `manager` arrays in `ROLE_VIEWS` (next to `'shopee'`). Example for super_admin:

```ts
  super_admin:    ['overview','funnel','performance','cads-calculator','sales','crm','product-analysis','google-ads','meta-ads','tiktok-shop','shopee','tokopedia','lazada','instagram','tiktok-organic','facebook-organic','settings','kol'],
```
Do the same insertion (`'tokopedia','lazada'` after `'shopee'`) for `admin` and `manager`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E 'types.ts|AuthContext' || echo "clean"`
Expected: clean (TS may now flag `VIEW_LABELS` in page.tsx as missing keys — fixed in Task 5).

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/contexts/AuthContext.tsx
git commit -m "feat: add tokopedia + lazada views to ActiveView and role access"
```

---

### Task 4: Reusable ChannelSalesView component

**Files:**
- Create: `src/components/views/ChannelSalesView.tsx`
- Reference (read for pattern, do not modify): `src/components/views/SalesView.tsx`

This component is SalesView's metric/chart logic, generalized to filter `bd.sales` by a single channel. It is read-only (WMS-sourced, no CSV upload).

- [ ] **Step 1: Create the component**

```tsx
'use client'
import { useMemo } from 'react'
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { Brand, SalesRow, Timeframe, ProductMaster } from '@/lib/types'
import type { ChannelKey } from '@/lib/channels'
import { channelLabel } from '@/lib/channels'
import { filterByDays, fmtCurrency, fmtNum } from '@/lib/utils'

interface Props {
  sales: SalesRow[]
  brand: Brand
  timeframe: Timeframe
  channel: ChannelKey
  products?: ProductMaster[]
}

export default function ChannelSalesView({ sales, timeframe, channel }: Props) {
  const rows = useMemo(
    () => filterByDays(sales.filter(r => r.channel === channel), timeframe),
    [sales, channel, timeframe],
  )

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0)
  const totalQty = rows.reduce((s, r) => s + r.qty, 0)
  const txCount = rows.length

  const topProducts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of rows) map[r.product] = (map[r.product] ?? 0) + r.revenue
    return Object.entries(map).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
  }, [rows])

  const trend = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of rows) map[r.date] = (map[r.date] ?? 0) + r.revenue
    return Object.entries(map).map(([date, revenue]) => ({ date, revenue })).sort((a, b) => a.date.localeCompare(b.date)).slice(-30)
  }, [rows])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: '#C9A96E' }} />
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{channelLabel(channel)}</h2>
        </div>
        <p style={{ color: '#6B7280', fontSize: 13 }}>{txCount.toLocaleString('id-ID')} transaksi</p>
      </div>

      {/* Metric cards: Revenue, Units, Transactions. Gross Profit/Margin intentionally omitted —
          WMS COGS is unreliable (handled in the separate margin change). */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <MetricCard label="Total Revenue" value={fmtCurrency(totalRevenue)} />
        <MetricCard label="Units Sold" value={fmtNum(totalQty)} />
        <MetricCard label="Transaksi" value={fmtNum(txCount)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="Top 5 Produk (Revenue)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topProducts} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmtCurrency(v)} />
              <Bar dataKey="revenue" fill="#C9A96E" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Revenue Trend">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => fmtNum(v)} />
              <Tooltip formatter={(v: number) => fmtCurrency(v)} />
              <Line type="monotone" dataKey="revenue" stroke="#C9A96E" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
      <p style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{value}</p>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{title}</p>
      {children}
    </div>
  )
}
```

> Note: `Cell`/`PieChart`/`Pie` are imported for parity with SalesView but only used if you later add the per-channel pie; remove unused imports to satisfy lint (Step 2 will catch it).

- [ ] **Step 2: Lint the new file**

Run: `npx eslint src/components/views/ChannelSalesView.tsx`
Expected: no errors. Remove any unused imports it flags (e.g. `PieChart`, `Pie`, `Cell`, `products`, `brand` if unused).

- [ ] **Step 3: Commit**

```bash
git add src/components/views/ChannelSalesView.tsx
git commit -m "feat: reusable per-channel sales view (read-only, WMS-sourced)"
```

---

### Task 5: Wire the 5 channel views in page.tsx

**Files:**
- Modify: `src/app/page.tsx` (VIEW_LABELS lines 43-50; view routing switch lines 443-458)

- [ ] **Step 1: Add the import** near the other view imports:

```ts
import ChannelSalesView from '@/components/views/ChannelSalesView'
```

- [ ] **Step 2: Add VIEW_LABELS entries** for the new views (inside the `VIEW_LABELS` object):

```ts
  tokopedia: 'Tokopedia', lazada: 'Lazada',
```

- [ ] **Step 3: Replace the routing lines** for `sales`, `tiktok-shop`, `shopee`, and add `tokopedia`, `lazada`. Replace the existing `sales`, `tiktok-shop`, `shopee` lines in the switch with:

```tsx
{view === 'sales' && <ChannelSalesView sales={bd.sales} brand={brand} timeframe={timeframe} channel="cs" products={products} />}
{view === 'shopee' && <ChannelSalesView sales={bd.sales} brand={brand} timeframe={timeframe} channel="shopee" products={products} />}
{view === 'tiktok-shop' && <ChannelSalesView sales={bd.sales} brand={brand} timeframe={timeframe} channel="tiktok" products={products} />}
{view === 'tokopedia' && <ChannelSalesView sales={bd.sales} brand={brand} timeframe={timeframe} channel="tokopedia" products={products} />}
{view === 'lazada' && <ChannelSalesView sales={bd.sales} brand={brand} timeframe={timeframe} channel="lazada" products={products} />}
```

**Remove the now-unused imports** `SalesView`, `ShopeeView`, `TikTokShopView` from page.tsx (their files stay on disk, just no longer imported). If eslint then flags handler functions that were only passed to those views (e.g. `handleBulkSales`, `handleManualSales`) as unused, remove those too — but keep `handleUpload` and `makeManualHandler` (still used by CRM/ads/organic views).

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep -E 'page.tsx' || echo "clean"` then `npx eslint src/app/page.tsx`
Expected: clean (VIEW_LABELS now has all ActiveView keys; no unused imports).

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: route shopee/tiktok/tokopedia/lazada/cs views to ChannelSalesView"
```

---

### Task 6: Sidebar MARKETPLACE section

**Files:**
- Modify: `src/components/Sidebar.tsx` (PAID_PLATFORMS lines ~20-24; render section lines ~120-157)

- [ ] **Step 1: Split the constants** — replace `PAID_PLATFORMS` so marketplaces move out:

```ts
const PAID_PLATFORMS = [
  { id: 'google-ads' as ActiveView, label: 'Google Ads', icon: BarChart2, color: '#4285F4' },
  { id: 'meta-ads' as ActiveView, label: 'Meta Ads', icon: Target, color: '#1877F2' },
]
const MARKETPLACE_PLATFORMS = [
  { id: 'shopee' as ActiveView, label: 'Shopee', icon: ShoppingBag, color: '#F05536' },
  { id: 'tiktok-shop' as ActiveView, label: 'TikTok Shop', icon: ShoppingBag, color: '#FF0050' },
  { id: 'tokopedia' as ActiveView, label: 'Tokopedia', icon: ShoppingBag, color: '#42B549' },
  { id: 'lazada' as ActiveView, label: 'Lazada', icon: ShoppingBag, color: '#0F146D' },
]
```

- [ ] **Step 2: Render the MARKETPLACE section** — find the block that renders the "Paid Traffic" `DropSection` mapping `PAID_PLATFORMS`. Immediately after that `DropSection`, add a new one (mirror the existing DropSection/NavItem markup used for PAID_PLATFORMS — same `accessible(p.id)` gating, `active`, `onClick={() => onViewChange(p.id)}`, `indent`):

```tsx
{MARKETPLACE_PLATFORMS.some(p => accessible(p.id)) && (
  <DropSection label="Marketplace" open={marketplaceOpen} onToggle={() => setMarketplaceOpen(p => !p)} color="#F05536">
    {MARKETPLACE_PLATFORMS.map(p => accessible(p.id) && (
      <NavItem key={p.id} icon={p.icon} label={p.label} color={p.color} active={view === p.id} onClick={() => onViewChange(p.id)} indent />
    ))}
  </DropSection>
)}
```

Add the `marketplaceOpen` state near the other `*Open` useState declarations:
```ts
const [marketplaceOpen, setMarketplaceOpen] = useState(true)
```

- [ ] **Step 3: Lint + typecheck**

Run: `npx eslint src/components/Sidebar.tsx && npx tsc --noEmit 2>&1 | grep Sidebar || echo "clean"`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: MARKETPLACE sidebar section (shopee, tiktok shop, tokopedia, lazada)"
```

---

### Task 7: Overview revenue/orders from sales only

**Files:**
- Modify: `src/components/views/OverviewView.tsx` (the `totalRevenue` / `totalOrders` lines, ~42-44)

- [ ] **Step 1: Replace the two derivations** — since all channels now live in `sales`, drop the shopee/tts/crm additions:

```ts
  const totalRevenue = sales.reduce((s, r) => s + r.revenue, 0)
  const totalOrders = sales.length
```

(Leave `totalSpend`, `blendedRoas`, the Revenue-per-Channel pie, etc. unchanged — the pie already reads `sales`'s `channel` field.)

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep OverviewView || echo "clean"` then `npx eslint src/components/views/OverviewView.tsx`
Expected: clean (watch for now-unused `tts`/`shopee` vars — remove them if eslint flags no-unused-vars).

- [ ] **Step 3: Commit**

```bash
git add src/components/views/OverviewView.tsx
git commit -m "fix(overview): revenue + orders from unified sales table (no double-count)"
```

---

### Task 8: Sync route accepts a date range

**Files:**
- Modify: `src/app/api/wms/sync/route.ts`

- [ ] **Step 1: Add range parsing + cap** — the route currently parses `{ brand }` and uses `lastNDays(1)`. Replace the body-parsing + `range:` usage. After the role check, replace the brand-parse block with:

```ts
  // Optional brand scope + date range from the dashboard popover.
  const body = (await req.json().catch(() => null)) as { brand?: string; start?: string; end?: string } | null
  const brands: Brand[] = body?.brand && (BRANDS as string[]).includes(body.brand) ? [body.brand as Brand] : BRANDS

  const MAX_RANGE_DAYS = 7
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  let range = lastNDays(1)
  if (body?.start && body?.end && dateRe.test(body.start) && dateRe.test(body.end)) {
    if (body.end < body.start) {
      return NextResponse.json({ error: 'end_date sebelum start_date' }, { status: 400 })
    }
    const days = Math.round((Date.parse(body.end) - Date.parse(body.start)) / 86_400_000)
    if (days > MAX_RANGE_DAYS) {
      return NextResponse.json({ error: `Maksimal ${MAX_RANGE_DAYS} hari per tarikan` }, { status: 400 })
    }
    range = { start: body.start, end: body.end }
  }
```

Then change the `runWmsSync` call's opts to use `range`:
```ts
      opts: { brands, tables: TABLES, range, trigger: 'manual', triggeredBy: userData.user.email ?? undefined },
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep 'api/wms/sync' || echo "clean"`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/wms/sync/route.ts
git commit -m "feat(wms): manual sync accepts a capped date range"
```

---

### Task 9: Sync button → date-range popover

**Files:**
- Modify: `src/components/wms/BrandSyncButton.tsx`

- [ ] **Step 1: Rewrite the component** — keep the existing fetch logic (it already POSTs to `/api/wms/sync` with `{ brand }`); add a popover that also sends `{ start, end }`. Helper for presets:

```tsx
'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Brand } from '@/lib/types'

const LABELS: Record<Brand, string> = { reglow: 'Reglow', amura: 'Amura', purela: 'Purela' }
const iso = (d: Date) => d.toISOString().slice(0, 10)
function preset(kind: 'today' | 'yesterday' | 'last7'): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  if (kind === 'yesterday') { start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1) }
  if (kind === 'last7') start.setDate(start.getDate() - 6)
  return { start: iso(start), end: iso(end) }
}

export default function BrandSyncButton({ brand, onResult }: { brand: Brand; onResult?: (r: { ok: boolean; text: string }) => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [start, setStart] = useState(preset('today').start)
  const [end, setEnd] = useState(preset('today').end)

  async function run(range: { start: string; end: string }) {
    setBusy(true); setOpen(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { onResult?.({ ok: false, text: 'Sesi habis, login ulang.' }); return }
      const res = await fetch('/api/wms/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, ...range }),
      })
      const json = await res.json().catch(() => ({}))
      onResult?.(res.ok
        ? { ok: true, text: `Sync ${LABELS[brand]} selesai — ${json?.tables?.sales ?? 0} sales` }
        : { ok: false, text: `Sync gagal: ${json?.error ?? res.status}` })
    } catch (e) {
      onResult?.({ ok: false, text: `Error: ${e instanceof Error ? e.message : String(e)}` })
    } finally { setBusy(false) }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} disabled={busy}
        className="text-[11px] font-medium px-2.5 py-1 rounded-md"
        style={{ border: '1px solid #E5E7EB', background: '#fff', color: '#4A9FD4', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
        {busy ? `Sync ${LABELS[brand]}…` : `↻ Sync ${LABELS[brand]}`}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 50, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 12, width: 240, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>Tarik data WMS — {LABELS[brand]}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button onClick={() => run(preset('today'))} style={presetStyle}>Hari ini</button>
            <button onClick={() => run(preset('yesterday'))} style={presetStyle}>Kemarin</button>
            <button onClick={() => run(preset('last7'))} style={presetStyle}>7 hari terakhir</button>
          </div>
          <div style={{ borderTop: '1px solid #F3F4F6', marginTop: 8, paddingTop: 8 }}>
            <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 4 }}>Custom (maks 7 hari)</p>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="date" value={start} onChange={e => setStart(e.target.value)} style={dateStyle} />
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>–</span>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={dateStyle} />
            </div>
            <button onClick={() => run({ start, end })} style={{ ...presetStyle, marginTop: 8, background: '#4A9FD4', color: '#fff', textAlign: 'center' }}>Tarik Data</button>
          </div>
        </div>
      )}
    </div>
  )
}

const presetStyle: React.CSSProperties = { fontSize: 12, padding: '6px 8px', borderRadius: 6, border: 'none', background: '#F9FAFB', color: '#374151', cursor: 'pointer', textAlign: 'left' }
const dateStyle: React.CSSProperties = { fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid #E5E7EB', flex: 1 }
```

- [ ] **Step 2: Lint + typecheck**

Run: `npx eslint src/components/wms/BrandSyncButton.tsx && npx tsc --noEmit 2>&1 | grep BrandSyncButton || echo "clean"`
Expected: clean. (The `onResult` wiring in `page.tsx` is unchanged.)

- [ ] **Step 3: Commit**

```bash
git add src/components/wms/BrandSyncButton.tsx
git commit -m "feat(wms): sync button is a date-range popover (presets + custom)"
```

---

### Task 10: Full verification + live smoke

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all pass (channels + wms suites included).

- [ ] **Step 2: Typecheck + lint (whole project)**

Run: `npx tsc --noEmit 2>&1 | grep -vE ' 2\.(ts|tsx)' | grep -E 'error TS' || echo "clean"` (the ` 2.` filter ignores pre-existing iCloud duplicate files)
Then: `npx eslint src/lib/channels.ts src/lib/wms/httpAdapter.ts src/components/views/ChannelSalesView.tsx src/app/page.tsx src/components/Sidebar.tsx src/components/views/OverviewView.tsx src/app/api/wms/sync/route.ts src/components/wms/BrandSyncButton.tsx`
Expected: clean for the changed files.

- [ ] **Step 2b: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Live smoke (key-gated, temp file, delete after)** — confirm the adapter's channel/status filtering against the real API. Create `src/lib/wms/_smoke.live.test.ts`:

```ts
import { describe, it } from 'vitest'
import { HttpWmsAdapter } from './httpAdapter'
const KEY = process.env.WMS_SMOKE_KEY
describe.skipIf(!KEY)('LIVE channel filter', () => {
  it('reglow 1-day → only tracked channels + revenue statuses', async () => {
    const rows = await new HttpWmsAdapter('https://wms-api.sinergisuperapp.com', KEY!).fetchSales('reglow', { start: '2026-06-21', end: '2026-06-22' })
    const channels = [...new Set(rows.map(r => r.channel))]
    console.log('rows=', rows.length, 'channels=', channels)
  }, 90000)
})
```

Run: `WMS_SMOKE_KEY='<key>' npx vitest run src/lib/wms/_smoke.live.test.ts --reporter=verbose 2>&1 | grep -E 'rows=|channels='`
Expected: channels ⊆ `['shopee','tiktok','tokopedia','lazada','cs']`; row count ≈ the WMS source count for completed+sent+paid orders in that window.

- [ ] **Step 4: Delete the smoke file + commit**

```bash
rm src/lib/wms/_smoke.live.test.ts
git add -A && git commit -m "test(wms): verify channel/status filtering against live API" --allow-empty
```

- [ ] **Step 5: Push + open PR to dev**

```bash
git push -u origin feature/wms-channel-views
gh pr create --base dev --title "WMS channel views + per-transaction marketplace + date-range sync" --body "Implements docs/superpowers/specs/2026-06-23-wms-channel-views-design.md"
```

---

## Rollout notes (after merge to dev → verify on preview → main)

1. **Re-sync needed** — channel values changed (`Shopee` → `shopee`, etc.) and `ord-` ids. Before/after deploy: `DELETE FROM sales WHERE origin = 'wms';` then re-sync each brand from the dashboard popover.
2. **Demo cleanup** (separate item): `DELETE FROM sales WHERE origin <> 'wms';` plus empty `shopee`, `tiktok_shop`, `crm` demo rows — only after real WMS data verified.
3. Deferred items remain: auto-update cadence, hide Gross Profit/Margin, historical backfill.

# WMS Channel Views + Per-Transaction Marketplace + Date-Range Sync — Design

**Date:** 2026-06-23
**Project:** SAS Dashboard (`sas-dashboard`)
**Builds on:** existing WMS integration (`src/lib/wms/*`, `HttpWmsAdapter`) — adapter already pulls orders from the Reglow/Perpack Open API into the `sales` table per brand.
**Status:** Design — awaiting user review before plan.

---

## 1. Problem & Goal

Today every WMS order lands in the `sales` table and is only visible in the **Acquisition by CS** view. The dedicated **Shopee** and **TikTok Shop** views read separate tables (`shopee`, `tiktok_shop`, sourced from manual CSV upload) and are therefore empty. Customer also wants to pull arbitrary date ranges on demand, and several order types/statuses currently inflate revenue.

**Goal:** Make each sales channel its own per-transaction view (filtered from one `sales` table), add the missing marketplaces (Tokopedia, Lazada), exclude non-revenue orders (Manual, cancelled/returned, unpaid), and let the user sync any date range from the dashboard.

---

## 2. Decisions (locked in brainstorm)

- **Tracked channels (5)** — each gets a per-transaction view:
  - Marketplace: **Shopee**, **TikTok Shop**, **Tokopedia**, **Lazada**
  - **Customer Services** (social commerce) → **Acquisition by CS**
- **Excluded entirely** (not ingested):
  - **Manual** orders (channel 1) — internal/content use per management, not real revenue.
  - **Channel long-tail** — Distributor, Dropship, Plugo, Reseller, Open API (negligible; add later if needed).
  - **Non-revenue statuses** — see status whitelist below.
- **Single source of truth:** all WMS orders for the tracked channels live in `sales` with a `channel` field. Views filter by channel. No per-platform tables, no aggregation, no double-count.
- **Per-transaction** format for every channel view (marketplace views change from the old aggregate/CSV shape to match WMS).
- **Sync button → dropdown** with date presets + custom range.

---

## 3. Channel & Status Mapping (precise)

The adapter maps by **`channel_id`** (stable) — not channel name.

| WMS `channel_id` | Canonical channel | View |
|---:|---|---|
| 4 | `shopee` | Shopee |
| 6 | `tiktok` | TikTok Shop |
| 7 | `tokopedia` | Tokopedia |
| 5 | `lazada` | Lazada |
| -3 | `cs` | Acquisition by CS |
| *(anything else)* | — | **dropped** (Manual=1, Distributor=-4, Dropship=-6, Reseller=-2, Open API=2, Plugo, Tokopedia variants, …) |

**Status whitelist (counts as revenue):** `paid`, `packing`, `packed`, `pick`, `process`, `sent`, `completed`.
**Excluded statuses:** `pending` (unpaid), `cancelled`, `cancelled_return`, `returned`, `request_return`, `request_cancel`.

> The status whitelist materially changes the revenue number (excludes ~248k cancelled, ~308k pending, ~55k request_return across brands). This is the one item most worth the user double-checking in review.

---

## 4. Architecture

**One table, filter by channel.**

```
WMS Open API (orders/list)
        │  HttpWmsAdapter.fetchSales(brand, range)
        │   • drop orders whose channel_id ∉ {4,6,7,5,-3}
        │   • drop orders whose status ∉ whitelist
        │   • map → SalesRow { channel: canonical, revenue, qty, product, date, … }
        ▼
   sales table  (brand, channel, wms_id 'ord-<id>', date, revenue, qty, …)
        │
        ├── Shopee view          → WHERE channel='shopee'
        ├── TikTok Shop view      → WHERE channel='tiktok'
        ├── Tokopedia view  (new) → WHERE channel='tokopedia'
        ├── Lazada view     (new) → WHERE channel='lazada'
        └── Acquisition by CS     → WHERE channel='cs'
```

Adding/removing a channel view = a filter constant, not a new table or pipeline.

---

## 5. Components

### 5.1 Adapter (`src/lib/wms/httpAdapter.ts`)
- Add `CHANNEL_MAP: Record<number, string>` (channel_id → canonical) and `REVENUE_STATUSES: Set<string>`.
- `fetchSales`: after fetching `orders/list`, filter `CHANNEL_MAP[channel_id]` defined **and** status in whitelist; map `channel` to the canonical value. Everything else unchanged (pagination, retry, etc.).
- Requires `channel_id` and `status` on the order shape (already returned by orders/list).

### 5.2 Reusable Channel Sales View (`src/components/views/ChannelSalesView.tsx`)
- Generalize the current Acquisition-by-CS/Sales view into one component parameterized by `channel` (and a display label).
- Renders per-transaction metrics from `sales` filtered by channel: Total Revenue, Units Sold, transaction count, Top Products, Revenue trend, transaction table.
- **Gross Profit / Margin:** rendered but flagged unavailable/hidden — WMS COGS is unreliable (see Out of Scope). Decide exact treatment when we do the margin item; for this spec, keep revenue/units as the headline.
- Used by all 5 channel views (Shopee, TikTok Shop, Tokopedia, Lazada, Acquisition by CS).

### 5.3 New views & routing
- Add **Tokopedia** and **Lazada** as `ActiveView` values + sidebar entries.
- Convert **Shopee** and **TikTok Shop** views to use `ChannelSalesView` (drop the old aggregate/CSV components for these). The `shopee` / `tiktok_shop` tables + CSV upload become unused for WMS data (see Out of Scope re: ad metrics).

### 5.4 Sidebar (`src/components/Sidebar.tsx`)
- New **MARKETPLACE** section: Shopee, TikTok Shop, Tokopedia, Lazada (moved out of "Paid Traffic").
- **Acquisition by CS** stays under Sales Data.

### 5.5 Overview (`src/components/views/OverviewView.tsx`)
- Revenue/orders now come solely from `sales` (all tracked channels already merged there).
- Remove the `shopee.orders` / `tiktok_shop.orders` / `crm` additions from `totalRevenue` / `totalOrders` (they would double-count or read empty tables). `Revenue per Channel` pie keeps working from `sales.channel`.

### 5.6 Sync dropdown (`src/components/wms/BrandSyncButton.tsx` → popover)
- Button opens a small popover: presets (**Hari ini**, **Kemarin**, **7 hari terakhir**) + **Custom** (start–end date pickers) + **Tarik Data**.
- Sends `{ brand, start, end }` to `/api/wms/sync`.
- **Range cap:** soft-limit a single pull to ~7 days; warn if larger (high-volume brands like Purela time out). Multi-month backfill is out of scope (separate mechanism, deferred).

### 5.7 Manual sync route (`src/app/api/wms/sync/route.ts`)
- Accept optional `start` / `end` in the body (in addition to `brand`). Falls back to `lastNDays(1)` when absent (cron unchanged).
- Validate `end >= start` and enforce the range cap.

---

## 6. Data Flow (manual sync)

1. User on Reglow dashboard picks "7 hari terakhir" → POST `/api/wms/sync` `{brand:'reglow', start, end}`.
2. Route (service role) → `runWmsSync` → `HttpWmsAdapter.fetchSales` pulls orders/list, drops non-tracked channels + non-revenue statuses, maps to SalesRow.
3. Upsert into `sales` (idempotent on `brand,wms_id`).
4. Dashboard reloads `sales`; each channel view filters its slice.

---

## 7. Testing

- **Adapter unit tests** (`httpAdapter.test.ts`): channel_id filtering (only 4/6/7/5/-3 pass; Manual/Distributor dropped); status whitelist (cancelled/pending/returned dropped, completed/sent/paid kept); canonical channel mapping.
- **Channel filter** test for `ChannelSalesView` data selection (right rows per channel).
- **Route** test: start/end honored; range cap enforced; defaults to lastNDays(1).
- Live smoke (manual, key-gated): pull a 1-day range per brand, confirm channel + status filtering matches WMS source counts.

---

## 8. Out of Scope (deferred — tracked separately)

- **Auto-update cadence (cron vs webhook)** — paused mid-brainstorm; webhook (B) carries silent-data-loss + WMS-team-dependency + volume risk. To revisit.
- **Hide Gross Profit / Margin** — WMS `cogs` is list price, not real modal (`order_details.purchase_price = 0`); margin is meaningless. Handle as its own small change.
- **Historical backfill** — multi-month pulls need a chunked/background mechanism, not the manual dropdown.
- **Marketplace ad metrics** (ad spend/clicks on Shopee/TikTok) — were CSV-sourced; not in WMS. If still wanted, a separate CSV slot, not part of this.
- **Cleanup of existing demo + old buggy WMS rows** — one-time DELETE + re-sync, done at rollout.
- **Reseller / Distributor channels** — skipped now; add later if needed.

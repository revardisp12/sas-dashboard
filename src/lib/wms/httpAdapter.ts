import type { Brand, SalesRow, ProductMaster } from '@/lib/types'
import type { WmsAdapter, WithWmsId, WmsDateRange } from './types'

/**
 * Real WMS HTTP adapter — Reglow / Perpack Open API (`wms-api.sinergisuperapp.com`).
 *
 * V1.2 scope = REVENUE only:
 *  - fetchSales: merge marketplace+manual (`/orders/list`) + social commerce
 *    (`/social-commerce/orders`), per brand (client_id), into the dashboard SalesRow.
 *  - fetchProducts: a SKU -> name/price catalog (dictionary) from `/stock-by-warehouse`
 *    so reports read "Reglow Sunscreen" instead of "RG-SL-30". Stock levels are NOT
 *    imported (operations concern, out of marketing scope).
 *
 * Deferred (methods intentionally omitted -> runWmsSync skips them):
 *  - CRM / contactable customer PII (marketplace masks it; social-commerce exposes it
 *    but we defer the whole CRM concern).
 *  - Ads (the WMS has no ads endpoint), reseller orders (endpoint has a client_id bug).
 *
 * Auth: `X-Api-Key` header (static shared key). Multi-tenant: every request MUST carry
 * `client_id`, or the shared key returns all clients' data.
 */

/** Dashboard brand -> WMS client_id (from GET /v1/open/clients/list). */
const BRAND_CLIENT_ID: Record<Brand, number> = { reglow: 1, amura: 2, purela: 3 }

// Per-endpoint page caps (verified vs live API): /orders/list accepts huge pages, but
// /social-commerce/orders rejects length > 250 with HTTP 400. Big MP pages turn ~21 small
// sequential requests into ~2-3 — the WMS drops the socket under sustained small-page pulls.
const MP_PAGE_SIZE = 5000
const SC_PAGE_SIZE = 250
const MAX_PAGES = 500 // safety cap
const MAX_RETRIES = 3

interface WmsEnvelope<T> {
  code?: number
  error?: string
  msg?: { id?: string; en?: string }
  data?: T[] | null
  metadata?: { count?: number; page?: number; length?: number; total_page?: number }
}

/** Deterministic application error (bad `code` in body) — not worth retrying. */
class WmsApiError extends Error {}

export class HttpWmsAdapter implements WmsAdapter {
  readonly mode = 'live' as const

  constructor(private baseUrl: string, private apiKey: string) {}

  private async getJson<T>(path: string): Promise<WmsEnvelope<T>> {
    let lastErr: unknown
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(`${this.baseUrl}${path}`, {
          headers: { 'X-Api-Key': this.apiKey, Accept: 'application/json' },
        })
        if (!res.ok) {
          // 4xx = deterministic (bad params) -> don't retry; 5xx/network are transient.
          if (res.status >= 400 && res.status < 500) throw new WmsApiError(`WMS ${path} -> HTTP ${res.status}`)
          throw new Error(`WMS ${path} -> HTTP ${res.status}`)
        }
        const body = (await res.json()) as WmsEnvelope<T>
        if (typeof body.code === 'number' && body.code !== 200) {
          throw new WmsApiError(`WMS ${path} -> code ${body.code} ${body.error ?? body.msg?.en ?? ''}`.trim())
        }
        return body
      } catch (e) {
        if (e instanceof WmsApiError) throw e // deterministic — don't retry
        lastErr = e
        if (attempt < MAX_RETRIES) await sleep(attempt * 1500) // backoff for transient socket/timeout drops
      }
    }
    throw lastErr
  }

  /**
   * Walk a paged list endpoint. Termination is driven by metadata.count (robust to
   * server-side page-size caps); falls back to a short-page check when count is absent.
   */
  private async getAllPages<T>(pageSize: number, buildPath: (page: number) => string): Promise<T[]> {
    const out: T[] = []
    let total = Number.POSITIVE_INFINITY
    for (let page = 1; page <= MAX_PAGES; page++) {
      const body = await this.getJson<T>(buildPath(page))
      const data = body.data ?? []
      out.push(...data)
      if (typeof body.metadata?.count === 'number') total = body.metadata.count
      if (data.length === 0 || out.length >= total) break
      if (!Number.isFinite(total) && data.length < pageSize) break
    }
    return out
  }

  fetchSales = async (brand: Brand, range: WmsDateRange): Promise<WithWmsId<SalesRow>[]> => {
    const cid = BRAND_CLIENT_ID[brand]

    // The two order endpoints disagree on end_date semantics (verified vs live API):
    //   /orders/list            -> end_date INCLUSIVE  (start <= date <= end)
    //   /social-commerce/orders -> end_date EXCLUSIVE  (start <= date <  end)
    // So social commerce gets end+1, otherwise it silently drops the entire `end` day.
    const mpDateQ = `start_date=${range.start}&end_date=${range.end}`
    const scDateQ = `start_date=${range.start}&end_date=${addDaysISO(range.end, 1)}`

    // 1) Marketplace (Shopee/Lazada/TikTok/Tokopedia) + manual orders.
    const marketplace = await this.getAllPages<MarketplaceOrder>(
      MP_PAGE_SIZE,
      (page) =>
        `/v1/open/orders/list?client_id=${cid}&${mpDateQ}&date_type=order_date&page=${page}&length=${MP_PAGE_SIZE}`,
    )

    // 2) Social commerce (CS-entered) orders — separate endpoint/table, smaller page cap.
    const social = await this.getAllPages<SocialOrder>(
      SC_PAGE_SIZE,
      (page) => `/v1/open/social-commerce/orders?client_id=${cid}&${scDateQ}&page=${page}&length=${SC_PAGE_SIZE}`,
    )

    const rows: WithWmsId<SalesRow>[] = []

    for (const o of marketplace) {
      const revenue = num(o.amount)
      const cogs = num(o.cogs)
      rows.push({
        wmsId: `mp-${o.id}`, // prefix: marketplace + social ids live in different tables
        date: dateOnly(o.order_at),
        product: o.product_summary ?? '',
        qty: num(o.qty),
        revenue,
        channel: o.channel_name || 'Lainnya',
        cogs,
        grossProfit: revenue - cogs,
        source: 'organic',
        origin: 'wms',
      })
    }

    for (const o of social) {
      const revenue = num(o.amount)
      rows.push({
        wmsId: `sc-${o.id}`,
        date: dateOnly(o.order_at),
        product: o.product_summary ?? '',
        qty: num(o.qty),
        revenue,
        channel: 'Social Commerce',
        cogs: 0, // social-commerce endpoint carries no COGS
        grossProfit: 0, // unknown COGS -> don't fabricate a margin
        source: 'organic',
        origin: 'wms',
      })
    }

    return rows
  }

  fetchProducts = async (brand: Brand): Promise<WithWmsId<ProductMaster>[]> => {
    const cid = BRAND_CLIENT_ID[brand]

    // No open "list warehouses" endpoint — discover them from the brand's integrations.
    const integrations = await this.getJson<Integration>(`/v1/open/integrations/list?client_id=${cid}`)
    const warehouseIds = [
      ...new Set(
        (integrations.data ?? [])
          .map((i) => i.warehouse_id)
          .filter((w): w is number => typeof w === 'number' && w > 0),
      ),
    ]

    // Catalog is a dictionary (SKU -> name/price), deduped across warehouses. Stock ignored.
    const byId = new Map<string, WithWmsId<ProductMaster>>()
    for (const wid of warehouseIds) {
      const body = await this.getJson<StockProduct>(
        `/v1/open/products/stock-by-warehouse?warehouse_id=${wid}&client_id=${cid}&limit=10000`,
      )
      for (const p of body.data ?? []) {
        const id = String(p.id)
        if (byId.has(id)) continue
        byId.set(id, {
          wmsId: `prod-${id}`,
          id,
          brand,
          sku: p.sku ?? '',
          name: p.name ?? '',
          price: num(p.sell_price),
          cogs: num(p.purchase_price),
          margin: 0, // recomputed by productToDb mapper
          origin: 'wms',
        })
      }
    }
    return [...byId.values()]
  }
}

// --- WMS response shapes (only the fields we read) ---

interface MarketplaceOrder {
  id: number
  order_at: string
  qty: number
  amount: number
  cogs: number
  channel_name: string
  product_summary: string
}

interface SocialOrder {
  id: number
  order_at: string
  qty: number
  amount: number
  product_summary: string
}

interface Integration {
  id: number
  warehouse_id: number
}

interface StockProduct {
  id: number
  sku: string
  name: string
  sell_price: number
  purchase_price: number
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const dateOnly = (ts: unknown): string => String(ts ?? '').slice(0, 10)

/** Add `days` to a YYYY-MM-DD date, returning YYYY-MM-DD (UTC-safe). */
const addDaysISO = (d: string, days: number): string => {
  const dt = new Date(`${d}T00:00:00Z`)
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

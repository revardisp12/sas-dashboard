import type { Brand, SalesRow, ProductMaster } from '@/lib/types'
import type { WmsAdapter, WithWmsId, WmsDateRange } from './types'

/**
 * Real WMS HTTP adapter — Reglow / Perpack Open API (`wms-api.sinergisuperapp.com`).
 *
 * V1.2 scope = REVENUE only:
 *  - fetchSales: every order for a brand (client_id) from `/orders/list`, mapped to SalesRow.
 *    That endpoint already spans ALL channels — marketplace (Shopee/Lazada/TikTok/Tokopedia),
 *    manual, and customer-service/social-commerce (channel -3) — so it is the single,
 *    non-double-counting source for revenue.
 *  - fetchProducts: a SKU -> name/price catalog (dictionary) from `/stock-by-warehouse`.
 *
 * Deferred (methods intentionally omitted -> runWmsSync skips them):
 *  - CRM / contactable PII (would come from /social-commerce, which exposes unmasked
 *    customer fields for the SAME CS orders that /orders/list returns masked).
 *  - Ads (no WMS endpoint), reseller orders (separate table; endpoint has a client_id bug).
 *
 * Auth: `X-Api-Key` header. Multi-tenant: every request MUST carry `client_id`.
 */

/** Dashboard brand -> WMS client_id (from GET /v1/open/clients/list). */
const BRAND_CLIENT_ID: Record<Brand, number> = { reglow: 1, amura: 2, purela: 3 }

const PAGE_SIZE = 5000 // /orders/list accepts large pages; big pages avoid the socket drops seen with many small sequential requests
const MAX_PAGES = 500 // safety cap
const MAX_RETRIES = 3

interface WmsEnvelope<T> {
  code?: number
  error?: string
  msg?: { id?: string; en?: string }
  data?: T[] | null
  metadata?: { count?: number; page?: number; length?: number; total_page?: number }
}

/** Deterministic application error (bad `code` / 4xx) — not worth retrying. */
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

    // /orders/list already returns EVERY channel for the tenant — marketplace, manual, AND
    // customer-service/social-commerce (channel -3). The separate /social-commerce endpoint
    // returns those same CS orders (with extra PII), so pulling it too double-counts revenue.
    const orders = await this.getAllPages<WmsOrder>(
      PAGE_SIZE,
      (page) =>
        `/v1/open/orders/list?client_id=${cid}&start_date=${range.start}&end_date=${range.end}` +
        `&date_type=order_date&page=${page}&length=${PAGE_SIZE}`,
    )

    return orders.map((o) => {
      const revenue = num(o.amount)
      const cogs = num(o.cogs)
      return {
        wmsId: `ord-${o.id}`,
        date: dateOnly(o.order_at),
        product: o.product_summary ?? '',
        qty: num(o.qty),
        revenue,
        channel: o.channel_name || 'Lainnya',
        cogs,
        grossProfit: revenue - cogs,
        source: 'organic',
        origin: 'wms',
      }
    })
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

interface WmsOrder {
  id: number
  order_at: string
  qty: number
  amount: number
  cogs: number
  channel_name: string
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
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

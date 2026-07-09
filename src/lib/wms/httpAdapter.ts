import type { Brand, SalesRow, CRMRow, ProductMaster } from '@/lib/types'
import type { WmsAdapter, WithWmsId, WmsDateRange } from './types'
import { channelForId, isRevenueStatus } from '@/lib/channels'

/**
 * Real WMS HTTP adapter — Reglow / Perpack Open API (`wms-api.sinergisuperapp.com`).
 *
 * Mirrors the partner finance model:
 *  - fetchSales: marketplace orders (Shopee/TikTok/Tokopedia/Lazada) from `/orders/list`
 *    (channel -3 / CS is NOT mapped here), PLUS customer-service "Soscom" orders from
 *    `/social-commerce/orders` with customer_type new|renew -> channel `cs` (Acquisition by CS).
 *  - fetchCRM: the same social-commerce feed, customer_type `repeat` -> the `crm` table
 *    (Retention by CRM). Social commerce exposes unmasked customer name/phone.
 *  - fetchProducts: a SKU -> name/price catalog from `/stock-by-warehouse`.
 *
 * Revenue = GROSS (pre-discount) to match finance: orders.amount + discount_order, and
 * social-commerce amount + discount_amount. Cancelled / returned statuses are excluded.
 *
 * Auth: `X-Api-Key` header. Multi-tenant: every request MUST carry `client_id`.
 */

/** Dashboard brand -> WMS client_id (from GET /v1/open/clients/list). */
const BRAND_CLIENT_ID: Record<Brand, number> = { reglow: 1, amura: 2, purela: 3 }

const PAGE_SIZE = 5000 // /orders/list accepts large pages; avoids socket drops from many small requests
const SC_PAGE_SIZE = 250 // /social-commerce/orders rejects length > 250 (HTTP 400)
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

  // fetchSales and fetchCRM both pull this same social-commerce endpoint for the same
  // brand+range in one sync run — cache it per-instance so the second call is free.
  private socialOrdersCache = new Map<string, Promise<SocialOrder[]>>()

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
      if (data.length === 0 || out.length >= total) return out
      if (!Number.isFinite(total) && data.length < pageSize) return out
    }
    throw new WmsApiError(
      'WMS pagination exceeded MAX_PAGES (' + MAX_PAGES + ') pages without reaching the end of the result set ' +
      '(collected ' + out.length + ' rows so far). Aborting instead of returning a silently truncated pull, ' +
      'since the caller\'s scope-replace delete step would otherwise remove un-refetched rows from a prior ' +
      'successful sync.',
    )
  }

  /** Social-commerce orders for the range. Its end_date is EXCLUSIVE (verified) -> +1 day. */
  private fetchSocialOrders(cid: number, range: WmsDateRange): Promise<SocialOrder[]> {
    const key = cid + ':' + range.start + ':' + range.end
    const cached = this.socialOrdersCache.get(key)
    if (cached) return cached

    const scEnd = addDaysISO(range.end, 1)
    const promise = this.getAllPages<SocialOrder>(
      SC_PAGE_SIZE,
      (page) =>
        `/v1/open/social-commerce/orders?client_id=${cid}&start_date=${range.start}&end_date=${scEnd}` +
        `&page=${page}&length=${SC_PAGE_SIZE}`,
    )
    this.socialOrdersCache.set(key, promise)
    return promise
  }

  fetchSales = async (brand: Brand, range: WmsDateRange): Promise<WithWmsId<SalesRow>[]> => {
    const cid = BRAND_CLIENT_ID[brand]
    const rows: WithWmsId<SalesRow>[] = []

    // 1) Marketplace (Shopee/TikTok/Tokopedia/Lazada) from /orders/list. Channel -3 (CS) is
    //    intentionally NOT mapped here (channelForId returns null) — CS comes from social-commerce.
    const orders = await this.getAllPages<WmsOrder>(
      PAGE_SIZE,
      (page) =>
        `/v1/open/orders/list?client_id=${cid}&start_date=${range.start}&end_date=${range.end}` +
        `&date_type=order_date&page=${page}&length=${PAGE_SIZE}`,
    )
    for (const o of orders) {
      const channel = channelForId(o.channel_id)
      if (!channel) continue // untracked (Manual, Distributor, CS-via-orders, …)
      if (!isRevenueStatus(o.status)) continue // drop cancelled / returned
      const revenue = num(o.amount) + num(o.discount_order) // GROSS (pre-discount), matches finance
      const cogs = num(o.cogs)
      rows.push({
        wmsId: `ord-${o.id}`,
        date: dateOnly(o.order_at),
        product: o.product_summary ?? '',
        qty: num(o.qty),
        revenue,
        channel,
        cogs,
        grossProfit: revenue - cogs,
        source: 'organic',
        origin: 'wms',
      })
    }

    // 2) CS "Soscom" = social-commerce orders, customer_type new|renew -> channel 'cs'
    //    (Acquisition by CS). `repeat` customers go to fetchCRM -> Retention by CRM.
    const social = await this.fetchSocialOrders(cid, range)
    for (const o of social) {
      if (o.customer_type === 'repeat') continue
      if (!isRevenueStatus(o.status)) continue
      const revenue = num(o.amount) + num(o.discount_amount)
      rows.push({
        wmsId: `sc-${o.id}`,
        date: dateOnly(o.order_at),
        product: o.product_summary ?? '',
        qty: num(o.qty),
        revenue,
        channel: 'cs',
        cogs: 0,
        grossProfit: 0,
        source: 'organic',
        origin: 'wms',
      })
    }

    return rows
  }

  fetchCRM = async (brand: Brand, range: WmsDateRange): Promise<WithWmsId<CRMRow>[]> => {
    const cid = BRAND_CLIENT_ID[brand]
    const social = await this.fetchSocialOrders(cid, range)
    const rows: WithWmsId<CRMRow>[] = []
    for (const o of social) {
      if (o.customer_type !== 'repeat') continue // retention = repeat customers only
      if (!isRevenueStatus(o.status)) continue
      rows.push({
        wmsId: `sc-${o.id}`,
        date: dateOnly(o.order_at),
        customerName: o.customer_name ?? '',
        phone: o.customer_phone ?? '',
        product: o.product_summary ?? '',
        qty: num(o.qty),
        revenue: num(o.amount) + num(o.discount_amount),
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

interface WmsOrder {
  id: number
  order_at: string
  qty: number
  amount: number
  discount_order: number
  cogs: number
  channel_id: number
  status: string
  product_summary: string
}

interface SocialOrder {
  id: number
  order_at: string
  qty: number
  amount: number
  discount_amount: number
  status: string
  customer_type: string
  customer_name: string
  customer_phone: string
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

// Deliberately does NOT attempt to parse numeric strings (e.g. "150000"): the WMS response
// types (WmsOrder/SocialOrder below) declare these fields as `number`, and a string coming
// through here would already be a contract violation. Naively calling Number() on it would
// risk silently mis-parsing a locale-formatted value (e.g. Indonesian "150.000" meaning
// 150000, not 150.0) into a plausible-looking but WRONG nonzero amount with no warning at
// all — worse than the zero it replaces. Warn-and-zero is the safer default for revenue.
const num = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (v !== null && v !== undefined && v !== '') {
    console.warn('[httpAdapter] num(): unparseable numeric value, defaulting to 0:', v)
  }
  return 0
}
const dateOnly = (ts: unknown): string => String(ts ?? '').slice(0, 10)
const addDaysISO = (d: string, days: number): string => {
  const dt = new Date(`${d}T00:00:00Z`)
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

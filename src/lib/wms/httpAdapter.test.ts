import { describe, it, expect, vi, afterEach } from 'vitest'
import { HttpWmsAdapter } from './httpAdapter'

const BASE = 'https://wms.example.com'
const KEY = 'test-key'

type Json = Record<string, unknown>

/** Stub global fetch with a handler mapping request URL -> JSON body. */
function stubFetch(handler: (url: string) => Json) {
  const fn = vi.fn(async (url: string | URL, _init?: RequestInit) => {
    const body = handler(String(url))
    return { ok: true, status: 200, json: async () => body } as unknown as Response
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const pageOf = (url: string) => Number(url.match(/[?&]page=(\d+)/)?.[1] ?? 1)

afterEach(() => vi.unstubAllGlobals())

describe('HttpWmsAdapter.fetchSales', () => {
  it('merges marketplace + social-commerce into SalesRow with prefixed wmsId', async () => {
    stubFetch((url) => {
      if (url.includes('/orders/list')) {
        return {
          code: 200,
          data: [{
            id: 2980909, order_at: '2026-06-21T10:55:25+07:00', qty: 3,
            amount: 252720, cogs: 274000, channel_name: 'Shopee',
            product_summary: '1 RG-CB-30,1 RG-SL-30',
            customer_name: '****', customer_phone: '****',
          }],
          metadata: { count: 1 },
        }
      }
      if (url.includes('/social-commerce/orders')) {
        return {
          code: 200,
          data: [{
            id: 95549, order_at: '2026-06-20T15:14:36+07:00', qty: 4,
            amount: 284000, product_summary: '1 RG-RJ-20',
            customer_name: 'Umi Khulsum', customer_phone: '6281212078085',
          }],
          metadata: { count: 1 },
        }
      }
      return { code: 200, data: [], metadata: {} }
    })

    const rows = await new HttpWmsAdapter(BASE, KEY).fetchSales('reglow', { start: '2026-06-01', end: '2026-06-21' })

    expect(rows).toHaveLength(2)

    const mp = rows.find((r) => r.wmsId === 'mp-2980909')!
    expect(mp).toMatchObject({
      date: '2026-06-21', qty: 3, revenue: 252720, channel: 'Shopee',
      cogs: 274000, grossProfit: 252720 - 274000, origin: 'wms',
      product: '1 RG-CB-30,1 RG-SL-30',
    })

    const sc = rows.find((r) => r.wmsId === 'sc-95549')!
    expect(sc).toMatchObject({
      date: '2026-06-20', revenue: 284000, channel: 'Social Commerce', origin: 'wms',
    })
    // CRM deferred (V1.2): customer PII not written, even when the endpoint exposes it.
    expect(sc.customerName).toBeUndefined()
    expect(sc.phone).toBeUndefined()
  })

  it('sends the brand client_id and X-Api-Key header', async () => {
    const fn = stubFetch(() => ({ code: 200, data: [], metadata: {} }))
    await new HttpWmsAdapter(BASE, KEY).fetchSales('amura', { start: '2026-06-01', end: '2026-06-02' })

    const urls = fn.mock.calls.map((c) => String(c[0]))
    expect(urls.some((u) => u.includes('client_id=2'))).toBe(true) // amura -> 2
    const init = fn.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['X-Api-Key']).toBe(KEY)
  })

  it('extends only social-commerce end_date by one day (exclusive vs inclusive boundary)', async () => {
    const fn = stubFetch(() => ({ code: 200, data: [], metadata: {} }))
    await new HttpWmsAdapter(BASE, KEY).fetchSales('reglow', { start: '2026-06-01', end: '2026-06-20' })

    const urls = fn.mock.calls.map((c) => String(c[0]))
    const mpUrl = urls.find((u) => u.includes('/orders/list'))!
    const scUrl = urls.find((u) => u.includes('/social-commerce/orders'))!
    expect(mpUrl).toContain('start_date=2026-06-01')
    expect(mpUrl).toContain('end_date=2026-06-20') // inclusive -> as-is
    expect(scUrl).toContain('start_date=2026-06-01')
    expect(scUrl).toContain('end_date=2026-06-21') // exclusive -> +1 day
  })

  it('paginates orders/list until a short page', async () => {
    const PAGE = 250
    stubFetch((url) => {
      if (url.includes('/orders/list')) {
        const page = pageOf(url)
        const n = page === 1 ? PAGE : 3 // page 2 short -> stop
        return {
          code: 200,
          data: Array.from({ length: n }, (_, i) => ({
            id: page * 1000 + i, order_at: '2026-06-10T00:00:00+07:00',
            qty: 1, amount: 1000, cogs: 0, channel_name: 'Manual', product_summary: 'X',
          })),
          metadata: {},
        }
      }
      return { code: 200, data: [], metadata: {} } // social-commerce empty
    })

    const rows = await new HttpWmsAdapter(BASE, KEY).fetchSales('reglow', { start: '2026-06-01', end: '2026-06-30' })
    expect(rows).toHaveLength(PAGE + 3)
  })

  it('throws on an API error code (e.g. reseller 500)', async () => {
    stubFetch(() => ({ code: 500, error: "Unknown column 'orders.client_id'", data: null, metadata: {} }))
    await expect(
      new HttpWmsAdapter(BASE, KEY).fetchSales('reglow', { start: '2026-06-01', end: '2026-06-02' }),
    ).rejects.toThrow()
  })
})

describe('HttpWmsAdapter.fetchProducts', () => {
  it('builds a deduped catalog from the brand integration warehouses', async () => {
    stubFetch((url) => {
      if (url.includes('/integrations/list')) {
        return {
          code: 200,
          data: [
            { id: 8, warehouse_id: 6 },
            { id: 9, warehouse_id: 1 },
            { id: 13, warehouse_id: 6 }, // duplicate warehouse -> fetched once
          ],
        }
      }
      if (url.includes('/stock-by-warehouse')) {
        const wid = Number(url.match(/warehouse_id=(\d+)/)?.[1])
        if (wid === 6) {
          return {
            code: 200,
            data: [
              { id: 654, sku: 'RG-TE-20', name: 'Triple Exfoliate', sell_price: 89000, purchase_price: 0 },
              { id: 655, sku: 'RG-SL-30', name: 'Sunscreen', sell_price: 99000, purchase_price: 0 },
            ],
          }
        }
        if (wid === 1) {
          return {
            code: 200,
            data: [
              { id: 654, sku: 'RG-TE-20', name: 'Triple Exfoliate', sell_price: 89000, purchase_price: 0 }, // dup id
              { id: 700, sku: 'RG-XX-10', name: 'Other', sell_price: 50000, purchase_price: 0 },
            ],
          }
        }
      }
      return { code: 200, data: [] }
    })

    const products = await new HttpWmsAdapter(BASE, KEY).fetchProducts('reglow')

    expect(products.map((p) => p.id).sort()).toEqual(['654', '655', '700']) // deduped by id
    expect(products.find((p) => p.id === '654')).toMatchObject({
      wmsId: 'prod-654', sku: 'RG-TE-20', name: 'Triple Exfoliate',
      price: 89000, brand: 'reglow', origin: 'wms',
    })
  })

  it('does not implement deferred tables (crm / ads)', () => {
    const a = new HttpWmsAdapter(BASE, KEY) as unknown as Record<string, unknown>
    expect(a.fetchCRM).toBeUndefined()
    expect(a.fetchGoogleAds).toBeUndefined()
    expect(a.fetchMetaAds).toBeUndefined()
  })
})

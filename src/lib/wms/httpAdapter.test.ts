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
  it('maps orders/list orders to SalesRow across all channels', async () => {
    stubFetch((url) => {
      if (url.includes('/orders/list')) {
        return {
          code: 200,
          data: [
            { id: 2980909, order_at: '2026-06-21T10:55:25+07:00', qty: 3, amount: 252720, cogs: 274000, channel_name: 'Shopee', product_summary: '1 RG-CB-30,1 RG-SL-30' },
            { id: 2980910, order_at: '2026-06-21T11:00:00+07:00', qty: 1, amount: 95000, cogs: 40000, channel_name: 'Customer Services', product_summary: '1 RG-RJ-20' },
          ],
          metadata: { count: 2 },
        }
      }
      return { code: 200, data: [], metadata: { count: 0 } }
    })

    const rows = await new HttpWmsAdapter(BASE, KEY).fetchSales('reglow', { start: '2026-06-01', end: '2026-06-21' })

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      wmsId: 'ord-2980909', date: '2026-06-21', qty: 3, revenue: 252720,
      channel: 'Shopee', cogs: 274000, grossProfit: 252720 - 274000, origin: 'wms',
      product: '1 RG-CB-30,1 RG-SL-30',
    })
    // CS / social-commerce orders arrive via orders/list directly (channel name preserved).
    expect(rows[1]).toMatchObject({ wmsId: 'ord-2980910', channel: 'Customer Services', revenue: 95000 })
  })

  it('does NOT call the social-commerce endpoint (CS orders already in orders/list -> no double-count)', async () => {
    const fn = stubFetch(() => ({ code: 200, data: [], metadata: { count: 0 } }))
    await new HttpWmsAdapter(BASE, KEY).fetchSales('reglow', { start: '2026-06-01', end: '2026-06-02' })
    const urls = fn.mock.calls.map((c) => String(c[0]))
    expect(urls.some((u) => u.includes('/social-commerce'))).toBe(false)
    expect(urls.some((u) => u.includes('/orders/list'))).toBe(true)
  })

  it('sends the brand client_id and X-Api-Key header', async () => {
    const fn = stubFetch(() => ({ code: 200, data: [], metadata: { count: 0 } }))
    await new HttpWmsAdapter(BASE, KEY).fetchSales('amura', { start: '2026-06-01', end: '2026-06-02' })

    const urls = fn.mock.calls.map((c) => String(c[0]))
    expect(urls.some((u) => u.includes('client_id=2'))).toBe(true) // amura -> 2
    const init = fn.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['X-Api-Key']).toBe(KEY)
  })

  it('paginates across pages using metadata.count', async () => {
    const TOTAL = 4228
    stubFetch((url) => {
      if (url.includes('/orders/list')) {
        const len = Number(url.match(/[?&]length=(\d+)/)?.[1] ?? 0)
        const page = pageOf(url)
        const start = (page - 1) * len
        const n = Math.max(0, Math.min(len, TOTAL - start))
        return {
          code: 200,
          data: Array.from({ length: n }, (_, i) => ({
            id: start + i, order_at: '2026-06-10T00:00:00+07:00',
            qty: 1, amount: 1000, cogs: 0, channel_name: 'Manual', product_summary: 'X',
          })),
          metadata: { count: TOTAL },
        }
      }
      return { code: 200, data: [], metadata: { count: 0 } }
    })

    const rows = await new HttpWmsAdapter(BASE, KEY).fetchSales('reglow', { start: '2026-06-01', end: '2026-06-30' })
    expect(rows).toHaveLength(TOTAL)
  })

  it('retries a transient network failure, then succeeds', async () => {
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls++
        if (calls === 1) throw new TypeError('terminated') // simulate WMS dropping the socket
        return { ok: true, status: 200, json: async () => ({ code: 200, data: [], metadata: { count: 0 } }) } as unknown as Response
      }),
    )
    const rows = await new HttpWmsAdapter(BASE, KEY).fetchSales('reglow', { start: '2026-06-01', end: '2026-06-01' })
    expect(rows).toEqual([])
    expect(calls).toBeGreaterThanOrEqual(2) // first attempt threw, retry recovered
  })

  it('throws on an API error code (deterministic, no retry)', async () => {
    stubFetch(() => ({ code: 500, error: 'boom', data: null, metadata: {} }))
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

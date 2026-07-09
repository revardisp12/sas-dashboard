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
  it('marketplace from orders/list (CS ch -3 excluded) + Soscom from social-commerce (new/renew); gross revenue', async () => {
    stubFetch((url) => {
      if (url.includes('/orders/list')) {
        return {
          code: 200,
          data: [
            { id: 1, channel_id: 4, status: 'completed', order_at: '2026-06-21T10:00:00+07:00', qty: 1, amount: 100000, discount_order: 20000, cogs: 90000, product_summary: 'A' }, // Shopee, gross 120000
            { id: 2, channel_id: -3, status: 'completed', order_at: '2026-06-21T10:00:00+07:00', qty: 1, amount: 99999, discount_order: 0, cogs: 0, product_summary: 'X' },          // CS-via-orders -> DROPPED (sourced from social-commerce)
            { id: 3, channel_id: 1, status: 'completed', order_at: '2026-06-21T10:00:00+07:00', qty: 1, amount: 999, discount_order: 0, cogs: 0, product_summary: 'C' },             // Manual -> dropped (channel)
            { id: 4, channel_id: 4, status: 'cancelled', order_at: '2026-06-21T10:00:00+07:00', qty: 1, amount: 777, discount_order: 0, cogs: 0, product_summary: 'D' },             // cancelled -> dropped (status)
          ],
          metadata: { count: 4 },
        }
      }
      if (url.includes('/social-commerce/orders')) {
        return {
          code: 200,
          data: [
            { id: 50, customer_type: 'new', status: 'completed', order_at: '2026-06-21T10:00:00+07:00', qty: 1, amount: 60000, discount_amount: 5000, product_summary: 'S', customer_name: 'Budi', customer_phone: '08123' },  // new -> cs sales, gross 65000
            { id: 51, customer_type: 'repeat', status: 'completed', order_at: '2026-06-21T10:00:00+07:00', qty: 1, amount: 40000, discount_amount: 0, product_summary: 'R', customer_name: 'Sari', customer_phone: '08999' },   // repeat -> CRM, NOT sales
          ],
          metadata: { count: 2 },
        }
      }
      return { code: 200, data: [], metadata: { count: 0 } }
    })

    const rows = await new HttpWmsAdapter(BASE, KEY).fetchSales('reglow', { start: '2026-06-01', end: '2026-06-21' })

    expect(rows.map(r => r.wmsId)).toEqual(['ord-1', 'sc-50'])           // shopee + CS-new; CS-via-orders/Manual/cancelled/repeat excluded
    expect(rows[0]).toMatchObject({ channel: 'shopee', revenue: 120000 }) // gross = amount + discount_order
    expect(rows[1]).toMatchObject({ channel: 'cs', revenue: 65000 })      // social-commerce new, gross = amount + discount_amount
  })

  it('DOES call the social-commerce endpoint (CS / Soscom source)', async () => {
    const fn = stubFetch(() => ({ code: 200, data: [], metadata: { count: 0 } }))
    await new HttpWmsAdapter(BASE, KEY).fetchSales('reglow', { start: '2026-06-01', end: '2026-06-02' })
    const urls = fn.mock.calls.map((c) => String(c[0]))
    expect(urls.some((u) => u.includes('/orders/list'))).toBe(true)
    expect(urls.some((u) => u.includes('/social-commerce'))).toBe(true)
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
            id: start + i, channel_id: 4, status: 'completed', order_at: '2026-06-10T00:00:00+07:00',
            qty: 1, amount: 1000, cogs: 0, channel_name: 'Shopee', product_summary: 'X',
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

  it('implements fetchCRM but not the deferred ads tables', () => {
    const a = new HttpWmsAdapter(BASE, KEY) as unknown as Record<string, unknown>
    expect(typeof a.fetchCRM).toBe('function')
    expect(a.fetchGoogleAds).toBeUndefined()
    expect(a.fetchMetaAds).toBeUndefined()
  })
})

describe('HttpWmsAdapter.fetchCRM', () => {
  it('returns only repeat social-commerce customers (with name/phone), gross revenue', async () => {
    stubFetch((url) => {
      if (url.includes('/social-commerce/orders')) {
        return {
          code: 200,
          data: [
            { id: 50, customer_type: 'new', status: 'completed', order_at: '2026-06-21T10:00:00+07:00', qty: 1, amount: 60000, discount_amount: 0, product_summary: 'S', customer_name: 'Budi', customer_phone: '08123' },   // new -> Acquisition (skip)
            { id: 51, customer_type: 'repeat', status: 'completed', order_at: '2026-06-21T10:00:00+07:00', qty: 2, amount: 40000, discount_amount: 5000, product_summary: 'R', customer_name: 'Sari', customer_phone: '08999' }, // repeat -> CRM, gross 45000
            { id: 52, customer_type: 'repeat', status: 'cancelled', order_at: '2026-06-21T10:00:00+07:00', qty: 1, amount: 10000, discount_amount: 0, product_summary: 'Z', customer_name: 'Cancelled', customer_phone: '08000' }, // cancelled -> dropped
          ],
          metadata: { count: 3 },
        }
      }
      return { code: 200, data: [], metadata: { count: 0 } }
    })

    const rows = await new HttpWmsAdapter(BASE, KEY).fetchCRM('reglow', { start: '2026-06-01', end: '2026-06-21' })

    expect(rows).toHaveLength(1) // only the non-cancelled repeat customer
    expect(rows[0]).toMatchObject({ wmsId: 'sc-51', customerName: 'Sari', phone: '08999', qty: 2, revenue: 45000 })
  })

  it('does not read the marketplace orders/list endpoint', async () => {
    const fn = stubFetch(() => ({ code: 200, data: [], metadata: { count: 0 } }))
    await new HttpWmsAdapter(BASE, KEY).fetchCRM('reglow', { start: '2026-06-01', end: '2026-06-02' })
    const urls = fn.mock.calls.map((c) => String(c[0]))
    expect(urls.some((u) => u.includes('/social-commerce'))).toBe(true)
    expect(urls.some((u) => u.includes('/orders/list'))).toBe(false)
  })

  it('shares ONE social-commerce fetch between fetchSales and fetchCRM on the same instance (same cid+range)', async () => {
    const fn = stubFetch((url) => {
      if (url.includes('/social-commerce/orders')) {
        // Single short page -> terminates in exactly 1 page.
        return { code: 200, data: [], metadata: { count: 0 } }
      }
      return { code: 200, data: [], metadata: { count: 0 } }
    })

    const adapter = new HttpWmsAdapter(BASE, KEY)
    const range = { start: '2026-06-01', end: '2026-06-21' }
    await adapter.fetchSales('reglow', range)
    await adapter.fetchCRM('reglow', range)

    const socialCommerceCalls = fn.mock.calls.filter((c) => String(c[0]).includes('/social-commerce')).length
    expect(socialCommerceCalls).toBe(1)
  })

  it('getAllPages throws instead of silently truncating when MAX_PAGES is exceeded', async () => {
    stubFetch((url) => {
      if (url.includes('/social-commerce/orders')) {
        const page = pageOf(url)
        // Always a full 250-item page, no metadata.count -> can only stop by hitting MAX_PAGES.
        return {
          code: 200,
          data: Array.from({ length: 250 }, (_, i) => ({
            id: page * 1000 + i,
            order_at: '2026-06-21T10:00:00+07:00',
            qty: 1,
            amount: 1000,
            discount_amount: 0,
            status: 'completed',
            customer_type: 'repeat',
            customer_name: 'Sari',
            customer_phone: '08999',
            product_summary: 'R',
          })),
        }
      }
      return { code: 200, data: [], metadata: { count: 0 } }
    })

    await expect(
      new HttpWmsAdapter(BASE, KEY).fetchCRM('reglow', { start: '2026-06-01', end: '2026-06-21' }),
    ).rejects.toThrow()
  })
})

describe('HttpWmsAdapter num() coercion (via fetchSales)', () => {
  it('defaults a numeric-LOOKING string amount to 0 and warns, rather than guessing at parsing it', async () => {
    // num() deliberately does not parse numeric strings at all — a value shaped like
    // "150000" could just as easily be a locale-formatted "150.000" upstream quirk (meaning
    // 150000, not 150.0), and guessing wrong would silently produce a plausible-but-wrong
    // revenue number instead of an obviously-wrong zero. Warn-and-zero every non-number.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubFetch((url) => {
      if (url.includes('/orders/list')) {
        return {
          code: 200,
          data: [
            { id: 1, channel_id: 4, status: 'completed', order_at: '2026-06-21T10:00:00+07:00', qty: 1, amount: '150000', discount_order: 0, cogs: 0, product_summary: 'A' },
          ],
          metadata: { count: 1 },
        }
      }
      return { code: 200, data: [], metadata: { count: 0 } }
    })

    const rows = await new HttpWmsAdapter(BASE, KEY).fetchSales('reglow', { start: '2026-06-01', end: '2026-06-21' })
    expect(rows[0]).toMatchObject({ revenue: 0 })
    expect(warnSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  it('defaults to 0 and warns when a value cannot be interpreted as a number', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubFetch((url) => {
      if (url.includes('/orders/list')) {
        return {
          code: 200,
          data: [
            { id: 1, channel_id: 4, status: 'completed', order_at: '2026-06-21T10:00:00+07:00', qty: 1, amount: 'N/A', discount_order: 0, cogs: 0, product_summary: 'A' },
          ],
          metadata: { count: 1 },
        }
      }
      return { code: 200, data: [], metadata: { count: 0 } }
    })

    const rows = await new HttpWmsAdapter(BASE, KEY).fetchSales('reglow', { start: '2026-06-01', end: '2026-06-21' })
    expect(rows[0]).toMatchObject({ revenue: 0 })
    expect(warnSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
  })
})

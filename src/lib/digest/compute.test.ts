import { describe, it, expect } from 'vitest'
import { computeDigest, ComputeInput } from './compute'
import type { SalesRow, CRMRow } from '@/lib/types'

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

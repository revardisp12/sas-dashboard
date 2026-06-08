import type { Brand, SalesRow, CRMRow, ProductMaster, GoogleAdsRow, MetaAdsRow } from '@/lib/types'
import type { WmsAdapter, WithWmsId, WmsDateRange } from './types'

// Tiny deterministic hash → number in [0,1). Stable across runs (no Math.random).
function seeded(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 10000) / 10000
}

function datesInRange(range: WmsDateRange): string[] {
  const out: string[] = []
  const d = new Date(range.start + 'T00:00:00Z')
  const end = new Date(range.end + 'T00:00:00Z')
  while (d <= end) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1) }
  return out
}

export class MockWmsAdapter implements WmsAdapter {
  readonly mode = 'mock' as const

  async fetchSales(brand: Brand, range: WmsDateRange): Promise<WithWmsId<SalesRow>[]> {
    const rows: WithWmsId<SalesRow>[] = []
    for (const date of datesInRange(range)) {
      const n = 1 + Math.floor(seeded(`${brand}${date}count`) * 3)
      for (let i = 0; i < n; i++) {
        const rev = 50000 + Math.floor(seeded(`${brand}${date}${i}rev`) * 200000)
        const cogs = Math.floor(rev * 0.4)
        rows.push({
          wmsId: `${brand}-sales-${date}-${i}`, date,
          product: `SKU${1 + Math.floor(seeded(`${brand}${date}${i}p`) * 5)}`,
          qty: 1 + Math.floor(seeded(`${brand}${date}${i}q`) * 3),
          revenue: rev, channel: 'cs', cogs, grossProfit: rev - cogs,
          customerName: `Customer ${Math.floor(seeded(`${brand}${date}${i}c`) * 1000)}`,
          phone: `08${Math.floor(seeded(`${brand}${date}${i}ph`) * 1e9)}`,
          address: 'Mock address', source: 'meta-ads',
        })
      }
    }
    return rows
  }

  async fetchCRM(brand: Brand, range: WmsDateRange): Promise<WithWmsId<CRMRow>[]> {
    return datesInRange(range).map((date, i) => ({
      wmsId: `${brand}-crm-${date}-${i}`, date,
      customerName: `Customer ${Math.floor(seeded(`${brand}${date}crm`) * 1000)}`,
      phone: `08${Math.floor(seeded(`${brand}${date}crmph`) * 1e9)}`,
      product: `SKU${1 + Math.floor(seeded(`${brand}${date}crmp`) * 5)}`,
      qty: 1, revenue: 50000 + Math.floor(seeded(`${brand}${date}crmr`) * 150000),
    }))
  }

  async fetchProducts(brand: Brand): Promise<WithWmsId<ProductMaster>[]> {
    return Array.from({ length: 5 }, (_, i) => {
      const price = 80000 + Math.floor(seeded(`${brand}prod${i}`) * 120000)
      const cogs = Math.floor(price * 0.4)
      return { wmsId: `${brand}-prod-${i}`, id: `${brand}-prod-${i}`, sku: `SKU${i + 1}`, name: `Mock Product ${i + 1}`, price, cogs, margin: 0, brand }
    })
  }

  async fetchGoogleAds(brand: Brand, range: WmsDateRange): Promise<WithWmsId<GoogleAdsRow>[]> {
    return datesInRange(range).map((date) => {
      const clicks = 50 + Math.floor(seeded(`${brand}${date}gclk`) * 500)
      const spend = 100000 + Math.floor(seeded(`${brand}${date}gsp`) * 900000)
      return {
        wmsId: `${brand}-ga-${date}`, date, campaign: 'Mock GA',
        impressions: clicks * 20, clicks, ctr: 5, cpc: Math.round(spend / clicks),
        spend, conversions: Math.floor(clicks * 0.05), convRate: 5, roas: 3,
      }
    })
  }

  async fetchMetaAds(brand: Brand, range: WmsDateRange): Promise<WithWmsId<MetaAdsRow>[]> {
    return datesInRange(range).map((date) => {
      const clicks = 80 + Math.floor(seeded(`${brand}${date}mclk`) * 600)
      const spend = 150000 + Math.floor(seeded(`${brand}${date}msp`) * 1000000)
      return {
        wmsId: `${brand}-ma-${date}`, date, campaign: 'Mock Meta',
        reach: clicks * 30, impressions: clicks * 25, clicks, ctr: 4, spend,
        purchases: Math.floor(clicks * 0.06), roas: 3.2, cpm: 20000,
        results: Math.floor(clicks * 0.06),
      }
    })
  }
}

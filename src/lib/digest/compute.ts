import type { Brand, SalesRow, CRMRow, GoogleAdsRow, MetaAdsRow, TikTokShopRow, ShopeeRow, SalesSource } from '@/lib/types'
import { isoWeekNumber, ymd } from './dateRange'
import type { DigestPayload, DigestKPIs, KPIDelta, KPIDirection, TopMover } from './types'

export interface CustomerFirstSeen {
  key: string         // (customerName || phone), lowercased + trimmed
  firstSeen: string   // 'YYYY-MM-DD'
}

export interface ComputeInput {
  brand: Brand
  weekStart: Date
  weekEnd: Date

  // Current period rows (already filtered to brand + within range)
  sales: SalesRow[]
  crm: CRMRow[]
  googleAds: GoogleAdsRow[]
  metaAds: MetaAdsRow[]
  tiktokShop: TikTokShopRow[]
  shopee: ShopeeRow[]

  // Previous period (Mon-Sun before)
  previousSales: SalesRow[]
  previousCrm: CRMRow[]
  previousGoogleAds: GoogleAdsRow[]
  previousMetaAds: MetaAdsRow[]
  previousTiktokShop: TikTokShopRow[]
  previousShopee: ShopeeRow[]

  // Customer first-seen records (all-time, brand-scoped)
  customersAllTime: CustomerFirstSeen[]
  customersPreviousAllTime: CustomerFirstSeen[]  // snapshot from end of previous week

  // Champions counts computed externally (RFM is heavy; pass result in)
  championsCurrent: number
  championsPrevious: number
}

export function computeDigest(input: ComputeInput): DigestPayload {
  // ── Revenue ──
  const currentRevenue = sumRevenue(input.sales) + sumCrmRevenue(input.crm)
  const previousRevenue = sumRevenue(input.previousSales) + sumCrmRevenue(input.previousCrm)

  // ── Orders ──
  const currentOrders = input.sales.length + input.crm.length
  const previousOrders = input.previousSales.length + input.previousCrm.length

  // ── Blended ROAS ──
  const currentSpend = sumSpend(input.googleAds, input.metaAds, input.tiktokShop, input.shopee)
  const previousSpend = sumSpend(input.previousGoogleAds, input.previousMetaAds, input.previousTiktokShop, input.previousShopee)
  const currentRoas = currentSpend > 0 ? currentRevenue / currentSpend : 0
  const previousRoas = previousSpend > 0 ? previousRevenue / previousSpend : 0

  // ── New customers ──
  const weekStartYmd = ymd(input.weekStart)
  const weekEndYmd = ymd(input.weekEnd)
  const newCurrent = countNewInRange(input.customersAllTime, weekStartYmd, weekEndYmd)
  const prevWeekStart = new Date(input.weekStart)
  prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7)
  const prevWeekEnd = new Date(input.weekEnd)
  prevWeekEnd.setUTCDate(prevWeekEnd.getUTCDate() - 7)
  const newPrevious = countNewInRange(input.customersPreviousAllTime, ymd(prevWeekStart), ymd(prevWeekEnd))

  // ── Top mover ──
  const topMover = selectTopMover(input.sales, input.previousSales)

  const kpis: DigestKPIs = {
    revenue: delta(currentRevenue, previousRevenue),
    orders: delta(currentOrders, previousOrders),
    blendedRoas: delta(roundTo(currentRoas, 2), roundTo(previousRoas, 2)),
    newCustomers: delta(newCurrent, newPrevious),
    champions: delta(input.championsCurrent, input.championsPrevious),
  }

  return {
    brand: input.brand,
    weekStart: weekStartYmd,
    weekEnd: weekEndYmd,
    weekNumber: isoWeekNumber(input.weekStart),
    generatedAt: new Date().toISOString(),
    kpis,
    topMover,
  }
}

// ── pure helpers ──

function sumRevenue(rows: SalesRow[]): number {
  return rows.reduce((s, r) => s + (r.revenue || 0), 0)
}
function sumCrmRevenue(rows: CRMRow[]): number {
  return rows.reduce((s, r) => s + (r.revenue || 0), 0)
}
function sumSpend(g: GoogleAdsRow[], m: MetaAdsRow[], t: TikTokShopRow[], s: ShopeeRow[]): number {
  const gs = g.reduce((acc, r) => acc + (r.spend || 0), 0)
  const ms = m.reduce((acc, r) => acc + (r.spend || 0), 0)
  const ts = t.reduce((acc, r) => acc + (r.adSpent || 0), 0)
  const ss = s.reduce((acc, r) => acc + (r.adSpend || 0), 0)
  return gs + ms + ts + ss
}
function countNewInRange(records: CustomerFirstSeen[], startYmd: string, endYmd: string): number {
  return records.filter(c => c.firstSeen >= startYmd && c.firstSeen <= endYmd).length
}
function selectTopMover(current: SalesRow[], previous: SalesRow[]): TopMover | null {
  const channels: SalesSource[] = ['google-ads', 'meta-ads', 'tiktok-ads']
  let best: { channel: SalesSource; change: number } | null = null
  for (const ch of channels) {
    const cur = current.filter(s => s.source === ch).reduce((acc, r) => acc + r.revenue, 0)
    const prv = previous.filter(s => s.source === ch).reduce((acc, r) => acc + r.revenue, 0)
    if (cur === 0 && prv === 0) continue
    const change = cur - prv
    if (best === null || Math.abs(change) > Math.abs(best.change)) {
      best = { channel: ch, change }
    }
  }
  if (best === null) return null
  if (best.change === 0) return null
  const direction = best.change > 0 ? 'positive' : 'negative'
  const caption = direction === 'positive'
    ? `${best.channel} +Rp ${best.change.toLocaleString('id-ID')} revenue WoW`
    : `${best.channel} -Rp ${Math.abs(best.change).toLocaleString('id-ID')} revenue WoW`
  return { channel: best.channel, direction, revenueChange: best.change, caption }
}
function delta(current: number, previous: number): KPIDelta {
  const diff = current - previous
  const percent = previous === 0 ? null : (diff / previous) * 100
  let direction: KPIDirection = 'flat'
  if (diff > 0) direction = 'up'
  else if (diff < 0) direction = 'down'
  return { current, previous, diff, percent, direction }
}
function roundTo(n: number, places: number): number {
  const factor = 10 ** places
  return Math.round(n * factor) / factor
}

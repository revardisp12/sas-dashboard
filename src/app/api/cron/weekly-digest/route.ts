import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/database.types'
import type { Brand, SalesRow, CRMRow, GoogleAdsRow, MetaAdsRow, TikTokShopRow, ShopeeRow, SalesSource } from '@/lib/types'
import { computeDigest, CustomerFirstSeen } from '@/lib/digest/compute'
import { previousMonSunWeek, ymd } from '@/lib/digest/dateRange'
import { calcRFM, filterByDaysCRM } from '@/lib/rfm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BRANDS: Brand[] = ['reglow', 'amura', 'purela']

export async function POST(req: NextRequest) {
  // Cron auth
  const auth = req.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (!auth || auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Missing env' }, { status: 500 })
  }

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { weekStart, weekEnd } = previousMonSunWeek(new Date())
  const startYmd = ymd(weekStart)
  const endYmd = ymd(weekEnd)

  // Previous week range
  const prevWeekStart = new Date(weekStart)
  prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7)
  const prevWeekEnd = new Date(weekEnd)
  prevWeekEnd.setUTCDate(prevWeekEnd.getUTCDate() - 7)
  const prevStartYmd = ymd(prevWeekStart)
  const prevEndYmd = ymd(prevWeekEnd)

  const results: { brand: Brand; ok: boolean; error?: string }[] = []

  for (const brand of BRANDS) {
    try {
      const payload = await computeForBrand(supabase, brand, weekStart, weekEnd, startYmd, endYmd, prevStartYmd, prevEndYmd)
      const { error: rpcErr } = await supabase.rpc('upsert_digest', {
        p_brand: brand,
        p_week_start: startYmd,
        p_week_end: endYmd,
        p_payload: payload as unknown as Json,
      })
      if (rpcErr) throw new Error(rpcErr.message)
      results.push({ brand, ok: true })
    } catch (e) {
      console.error(`[cron/weekly-digest] ${brand} failed:`, e)
      results.push({ brand, ok: false })
    }
  }

  const okCount = results.filter(r => r.ok).length
  const status = okCount === BRANDS.length ? 200 : okCount === 0 ? 500 : 207
  return NextResponse.json({ digestsGenerated: okCount, perBrand: results }, { status })
}

async function computeForBrand(
  supabase: ReturnType<typeof createClient<Database>>,
  brand: Brand,
  weekStart: Date,
  weekEnd: Date,
  startYmd: string,
  endYmd: string,
  prevStartYmd: string,
  prevEndYmd: string,
) {
  // Fetch raw rows in parallel
  const [salesCur, salesPrv, crmCur, crmPrv, gaCur, gaPrv, maCur, maPrv, ttsCur, ttsPrv, shopCur, shopPrv, crmAll] = await Promise.all([
    fetchInRange<SalesRow>(supabase, 'sales', brand, startYmd, endYmd, salesMap),
    fetchInRange<SalesRow>(supabase, 'sales', brand, prevStartYmd, prevEndYmd, salesMap),
    fetchInRange<CRMRow>(supabase, 'crm', brand, startYmd, endYmd, crmMap),
    fetchInRange<CRMRow>(supabase, 'crm', brand, prevStartYmd, prevEndYmd, crmMap),
    fetchInRange<GoogleAdsRow>(supabase, 'google_ads', brand, startYmd, endYmd, googleAdsMap),
    fetchInRange<GoogleAdsRow>(supabase, 'google_ads', brand, prevStartYmd, prevEndYmd, googleAdsMap),
    fetchInRange<MetaAdsRow>(supabase, 'meta_ads', brand, startYmd, endYmd, metaAdsMap),
    fetchInRange<MetaAdsRow>(supabase, 'meta_ads', brand, prevStartYmd, prevEndYmd, metaAdsMap),
    fetchInRange<TikTokShopRow>(supabase, 'tiktok_shop', brand, startYmd, endYmd, ttsMap),
    fetchInRange<TikTokShopRow>(supabase, 'tiktok_shop', brand, prevStartYmd, prevEndYmd, ttsMap),
    fetchInRange<ShopeeRow>(supabase, 'shopee', brand, startYmd, endYmd, shopeeMap),
    fetchInRange<ShopeeRow>(supabase, 'shopee', brand, prevStartYmd, prevEndYmd, shopeeMap),
    // All-time CRM for first-seen tracking (sales is per-row, CRM is the canonical customer ledger)
    fetchAll<CRMRow>(supabase, 'crm', brand, crmMap),
  ])

  // Build customer first-seen ledger (key = phone || name, both trimmed/lowered)
  const firstSeenMap = new Map<string, string>()
  for (const c of crmAll) {
    const key = customerKey(c.customerName, c.phone)
    if (!key) continue
    const existing = firstSeenMap.get(key)
    if (!existing || c.date < existing) firstSeenMap.set(key, c.date)
  }
  const customersAllTime: CustomerFirstSeen[] = Array.from(firstSeenMap.entries()).map(([key, firstSeen]) => ({ key, firstSeen }))

  // For "customersPreviousAllTime" we use the same ledger; the compute function
  // re-filters by the previous week range. This is correct because the ledger
  // is monotonic (first-seen dates don't change).
  const customersPreviousAllTime = customersAllTime

  // Compute Champions count via existing RFM logic — uses 90-day window per existing pattern
  const championsCurrent = calcRFM(filterByDaysCRM(crmAll, 90)).filter(c => c.segment === 'Champions').length
  // Previous Champions: RFM relative to the previous week's end. Use a snapshot of CRM rows up to prevWeekEnd.
  const crmUpToPrevEnd = crmAll.filter(r => r.date <= prevEndYmd)
  const championsPrevious = calcRFM(filterByDaysCRM(crmUpToPrevEnd, 90)).filter(c => c.segment === 'Champions').length

  return computeDigest({
    brand,
    weekStart, weekEnd,
    sales: salesCur, crm: crmCur,
    googleAds: gaCur, metaAds: maCur, tiktokShop: ttsCur, shopee: shopCur,
    previousSales: salesPrv, previousCrm: crmPrv,
    previousGoogleAds: gaPrv, previousMetaAds: maPrv, previousTiktokShop: ttsPrv, previousShopee: shopPrv,
    customersAllTime, customersPreviousAllTime,
    championsCurrent, championsPrevious,
  })
}

// ── row mappers (snake_case DB → camelCase TS) ──
type Mapper<T> = (r: Record<string, unknown>) => T

function salesMap(r: Record<string, unknown>): SalesRow {
  return {
    date: String(r.date ?? ''),
    product: String(r.product ?? ''),
    qty: Number(r.qty ?? 0),
    revenue: Number(r.revenue ?? 0),
    channel: String(r.channel ?? ''),
    cogs: Number(r.cogs ?? 0),
    grossProfit: Number(r.gross_profit ?? 0),
    customerName: r.customer_name ? String(r.customer_name) : '',
    phone: r.phone ? String(r.phone) : '',
    address: r.address ? String(r.address) : '',
    source: (r.source ?? 'organic') as SalesSource,
  }
}
function crmMap(r: Record<string, unknown>): CRMRow {
  return {
    date: String(r.date ?? ''),
    customerName: r.customer_name ? String(r.customer_name) : '',
    phone: r.phone ? String(r.phone) : '',
    product: String(r.product ?? ''),
    qty: Number(r.qty ?? 0),
    revenue: Number(r.revenue ?? 0),
  }
}
function googleAdsMap(r: Record<string, unknown>): GoogleAdsRow {
  return {
    date: String(r.date ?? ''),
    campaign: String(r.campaign ?? ''),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    ctr: Number(r.ctr ?? 0),
    cpc: Number(r.cpc ?? 0),
    spend: Number(r.spend ?? 0),
    conversions: Number(r.conversions ?? 0),
    convRate: Number(r.conv_rate ?? 0),
    roas: Number(r.roas ?? 0),
  }
}
function metaAdsMap(r: Record<string, unknown>): MetaAdsRow {
  return {
    date: String(r.date ?? ''),
    campaign: String(r.campaign ?? ''),
    reach: Number(r.reach ?? 0),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    ctr: Number(r.ctr ?? 0),
    spend: Number(r.spend ?? 0),
    purchases: Number(r.purchases ?? 0),
    roas: Number(r.roas ?? 0),
    cpm: Number(r.cpm ?? 0),
    results: Number(r.results ?? 0),
  }
}
function ttsMap(r: Record<string, unknown>): TikTokShopRow {
  return {
    date: String(r.date ?? ''),
    gmv: Number(r.gmv ?? 0),
    orders: Number(r.orders ?? 0),
    unitsSold: Number(r.units_sold ?? 0),
    revenue: Number(r.revenue ?? 0),
    productViews: Number(r.product_views ?? 0),
    adSpent: Number(r.ad_spent ?? 0),
  }
}
function shopeeMap(r: Record<string, unknown>): ShopeeRow {
  return {
    date: String(r.date ?? ''),
    gmv: Number(r.gmv ?? 0),
    orders: Number(r.orders ?? 0),
    unitsSold: Number(r.units_sold ?? 0),
    revenue: Number(r.revenue ?? 0),
    productViews: Number(r.product_views ?? 0),
    adSpend: Number(r.ad_spend ?? 0),
    adClicks: Number(r.ad_clicks ?? 0),
    adImpressions: Number(r.ad_impressions ?? 0),
  }
}

// PostgREST caps a single request at 1000 rows — paginate so a high-volume brand/week
// (Purela) doesn't silently truncate the digest's revenue/order counts.
const PAGE = 1000

async function fetchInRange<T>(
  supabase: ReturnType<typeof createClient<Database>>,
  table: 'sales' | 'crm' | 'google_ads' | 'meta_ads' | 'tiktok_shop' | 'shopee',
  brand: Brand,
  startYmd: string,
  endYmd: string,
  mapper: Mapper<T>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').eq('brand', brand)
      .gte('date', startYmd).lte('date', endYmd).order('date').order('id').range(from, from + PAGE - 1)
    if (error) throw error
    const batch = data ?? []
    for (const r of batch) rows.push(mapper(r as Record<string, unknown>))
    if (batch.length < PAGE) break
  }
  return rows
}

async function fetchAll<T>(
  supabase: ReturnType<typeof createClient<Database>>,
  table: 'crm',
  brand: Brand,
  mapper: Mapper<T>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').eq('brand', brand).order('date').order('id').range(from, from + PAGE - 1)
    if (error) throw error
    const batch = data ?? []
    for (const r of batch) rows.push(mapper(r as Record<string, unknown>))
    if (batch.length < PAGE) break
  }
  return rows
}

function customerKey(name: string | undefined, phone: string | undefined): string | null {
  const n = (name ?? '').trim().toLowerCase()
  const p = (phone ?? '').trim()
  const key = p || n
  return key || null
}

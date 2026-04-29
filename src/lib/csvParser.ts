import Papa from 'papaparse'
import {
  GoogleAdsRow, MetaAdsRow, TikTokShopRow, InstagramRow, TikTokOrganicRow, Platform
} from './types'

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const s = String(v).replace(/[%,Rp.\s]/g, '').replace(',', '.')
  return parseFloat(s) || 0
}

function parseCSV(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => resolve(r.data as Record<string, string>[]),
      error: (e) => reject(e),
    })
  })
}

export async function parseGoogleAds(file: File): Promise<GoogleAdsRow[]> {
  const rows = await parseCSV(file)
  return rows.map((r) => ({
    date: r['Date'] || r['date'] || '',
    campaign: r['Campaign'] || r['campaign'] || '',
    impressions: toNum(r['Impressions'] || r['impressions']),
    clicks: toNum(r['Clicks'] || r['clicks']),
    ctr: toNum(r['CTR'] || r['ctr']),
    cpc: toNum(r['Avg. CPC'] || r['CPC'] || r['cpc']),
    spend: toNum(r['Cost'] || r['Spend'] || r['spend'] || r['cost']),
    conversions: toNum(r['Conversions'] || r['conversions']),
    convRate: toNum(r['Conv. rate'] || r['Conv rate'] || r['conv_rate']),
    roas: toNum(r['Conv. value / cost'] || r['ROAS'] || r['roas']),
  }))
}

export async function parseMetaAds(file: File): Promise<MetaAdsRow[]> {
  const rows = await parseCSV(file)
  return rows.map((r) => ({
    date: r['Date'] || r['Reporting starts'] || r['date'] || '',
    campaign: r['Campaign name'] || r['Campaign'] || r['campaign'] || '',
    reach: toNum(r['Reach'] || r['reach']),
    impressions: toNum(r['Impressions'] || r['impressions']),
    clicks: toNum(r['Link clicks'] || r['Clicks'] || r['clicks']),
    ctr: toNum(r['CTR (link click-through rate)'] || r['CTR'] || r['ctr']),
    spend: toNum(r['Amount spent (IDR)'] || r['Amount spent'] || r['Spend'] || r['spend']),
    purchases: toNum(r['Purchases'] || r['Conversions'] || r['purchases']),
    roas: toNum(r['Purchase ROAS (return on ad spend)'] || r['ROAS'] || r['roas']),
    cpm: toNum(r['CPM (cost per 1,000 impressions)'] || r['CPM'] || r['cpm']),
  }))
}

export async function parseTikTokShop(file: File): Promise<TikTokShopRow[]> {
  const rows = await parseCSV(file)
  return rows.map((r) => ({
    date: r['Date'] || r['date'] || '',
    gmv: toNum(r['GMV'] || r['gmv']),
    orders: toNum(r['Orders'] || r['orders'] || r['Total orders']),
    unitsSold: toNum(r['Units sold'] || r['units_sold'] || r['Qty sold']),
    revenue: toNum(r['Revenue'] || r['revenue'] || r['Net revenue']),
    convRate: toNum(r['Conversion rate'] || r['conv_rate'] || r['CVR']),
    avgOrderValue: toNum(r['Avg order value'] || r['AOV'] || r['Average order value']),
  }))
}

export async function parseInstagram(file: File): Promise<InstagramRow[]> {
  const rows = await parseCSV(file)
  return rows.map((r) => ({
    date: r['Date'] || r['date'] || '',
    followers: toNum(r['Followers'] || r['followers'] || r['Total followers']),
    reach: toNum(r['Reach'] || r['reach']),
    impressions: toNum(r['Impressions'] || r['impressions']),
    profileVisits: toNum(r['Profile visits'] || r['profile_visits']),
    engagements: toNum(r['Post engagements'] || r['Engagements'] || r['engagements']),
  }))
}

export async function parseTikTokOrganic(file: File): Promise<TikTokOrganicRow[]> {
  const rows = await parseCSV(file)
  return rows.map((r) => ({
    date: r['Date'] || r['date'] || '',
    followers: toNum(r['Followers'] || r['followers'] || r['Total followers']),
    views: toNum(r['Video views'] || r['Views'] || r['views']),
    likes: toNum(r['Likes'] || r['likes']),
    comments: toNum(r['Comments'] || r['comments']),
    shares: toNum(r['Shares'] || r['shares']),
  }))
}

export function parseFile(platform: Platform, file: File) {
  switch (platform) {
    case 'google-ads': return parseGoogleAds(file)
    case 'meta-ads': return parseMetaAds(file)
    case 'tiktok-shop': return parseTikTokShop(file)
    case 'instagram': return parseInstagram(file)
    case 'tiktok-organic': return parseTikTokOrganic(file)
  }
}

export const CSV_TEMPLATES: Record<Platform, { name: string; headers: string[] }> = {
  'google-ads': {
    name: 'google_ads_template.csv',
    headers: ['Date', 'Campaign', 'Impressions', 'Clicks', 'CTR', 'Avg. CPC', 'Cost', 'Conversions', 'Conv. rate', 'ROAS'],
  },
  'meta-ads': {
    name: 'meta_ads_template.csv',
    headers: ['Date', 'Campaign name', 'Reach', 'Impressions', 'Link clicks', 'CTR', 'Amount spent (IDR)', 'Purchases', 'Purchase ROAS (return on ad spend)', 'CPM (cost per 1,000 impressions)'],
  },
  'tiktok-shop': {
    name: 'tiktok_shop_template.csv',
    headers: ['Date', 'GMV', 'Orders', 'Units sold', 'Revenue', 'Conversion rate', 'Avg order value'],
  },
  instagram: {
    name: 'instagram_template.csv',
    headers: ['Date', 'Followers', 'Reach', 'Impressions', 'Profile visits', 'Post engagements'],
  },
  'tiktok-organic': {
    name: 'tiktok_organic_template.csv',
    headers: ['Date', 'Followers', 'Video views', 'Likes', 'Comments', 'Shares'],
  },
}

export function downloadTemplate(platform: Platform) {
  const tpl = CSV_TEMPLATES[platform]
  const csv = tpl.headers.join(',') + '\n2024-01-01,' + tpl.headers.slice(1).map(() => '0').join(',')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = tpl.name
  a.click()
  URL.revokeObjectURL(url)
}

export type Brand = 'reglow' | 'amura'
export type Platform = 'google-ads' | 'meta-ads' | 'tiktok-shop' | 'instagram' | 'tiktok-organic'
export type ActiveView = Platform | 'overview' | 'funnel' | 'sales'
export type Timeframe = 7 | 14 | 30 | 90 | 0

export interface GoogleAdsRow {
  date: string; campaign: string; impressions: number; clicks: number
  ctr: number; cpc: number; spend: number; conversions: number; convRate: number; roas: number
}
export interface MetaAdsRow {
  date: string; campaign: string; reach: number; impressions: number; clicks: number
  ctr: number; spend: number; purchases: number; roas: number; cpm: number
}
export interface TikTokShopRow {
  date: string; gmv: number; orders: number; unitsSold: number
  revenue: number; convRate: number; avgOrderValue: number
}
export interface InstagramRow {
  date: string; followers: number; reach: number; impressions: number
  profileVisits: number; engagements: number
}
export interface TikTokOrganicRow {
  date: string; followers: number; views: number; likes: number; comments: number; shares: number
}
export interface SalesRow {
  date: string; product: string; qty: number; revenue: number
  channel: string; cogs: number; grossProfit: number
}

export interface BrandData {
  googleAds: GoogleAdsRow[]
  metaAds: MetaAdsRow[]
  tiktokShop: TikTokShopRow[]
  instagram: InstagramRow[]
  tiktokOrganic: TikTokOrganicRow[]
  sales: SalesRow[]
}

export const emptyBrandData = (): BrandData => ({
  googleAds: [], metaAds: [], tiktokShop: [], instagram: [], tiktokOrganic: [], sales: [],
})

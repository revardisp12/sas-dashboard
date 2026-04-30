export type Brand = 'reglow' | 'amura'
export type Platform = 'google-ads' | 'meta-ads' | 'tiktok-shop' | 'instagram' | 'tiktok-organic'
export type ActiveView = Platform | 'overview' | 'funnel' | 'sales' | 'crm' | 'product-analysis'
export type Timeframe = 7 | 14 | 30 | 90 | 0
export type CRMTimeframe = 30 | 90 | 180 | 365 | 0

export type RFMSegment =
  | 'Champions' | 'Loyal Customers' | 'Potential Loyalist' | 'New Customers'
  | 'Promising' | 'Need Attention' | 'About to Sleep' | "Can't Lose Them"
  | 'At Risk' | 'Hibernating'

export interface CRMRow {
  date: string
  customerName: string
  phone: string
  product: string
  qty: number
  revenue: number
}

export interface FollowUpTask {
  id: string
  customerName: string
  phone: string
  segment: RFMSegment
  note: string
  dueDate: string
  status: 'todo' | 'ongoing' | 'done'
  brand: Brand
  createdAt: string
}

export interface CustomerRFM {
  customerName: string
  phone: string
  lastOrderDate: string
  recencyDays: number
  frequency: number
  monetary: number
  rScore: number
  fScore: number
  mScore: number
  segment: RFMSegment
  transactions: CRMRow[]
}

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
  crm: CRMRow[]
}

export const emptyBrandData = (): BrandData => ({
  googleAds: [], metaAds: [], tiktokShop: [], instagram: [], tiktokOrganic: [], sales: [], crm: [],
})

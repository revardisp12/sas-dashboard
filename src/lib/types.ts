export type Brand = 'reglow' | 'amura'
export type Platform = 'google-ads' | 'meta-ads' | 'tiktok-shop' | 'shopee' | 'instagram' | 'tiktok-organic'
export type ActiveView = Platform | 'overview' | 'funnel' | 'sales' | 'crm' | 'product-analysis' | 'settings'
export type Timeframe = 7 | 14 | 30 | 90 | 0
export interface DateRange { from: string; to: string }
export type CRMTimeframe = 30 | 90 | 180 | 365 | 0

export interface ProductMaster {
  id: string
  sku: string
  name: string
  price: number
  cogs: number
  margin: number
  brand: Brand
}

export interface BundleComponent {
  sku: string
  qty: number
}

export interface BundleMaster {
  id: string
  name: string
  components: BundleComponent[]
  price: number
  cogs: number
  margin: number
  brand: Brand
}

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
  revenue: number; productViews: number
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
  customerName?: string; phone?: string; address?: string
  source?: string
}

export interface ShopeeRow {
  date: string
  gmv: number
  orders: number
  unitsSold: number
  revenue: number
  productViews: number
  adSpend: number
  adClicks: number
  adImpressions: number
}

export interface BrandData {
  googleAds: GoogleAdsRow[]
  metaAds: MetaAdsRow[]
  tiktokShop: TikTokShopRow[]
  shopee: ShopeeRow[]
  instagram: InstagramRow[]
  tiktokOrganic: TikTokOrganicRow[]
  sales: SalesRow[]
  crm: CRMRow[]
}

export const emptyBrandData = (): BrandData => ({
  googleAds: [], metaAds: [], tiktokShop: [], shopee: [], instagram: [], tiktokOrganic: [], sales: [], crm: [],
})

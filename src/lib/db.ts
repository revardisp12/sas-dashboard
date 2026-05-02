import { supabase } from './supabase'
import type { Brand, ProductMaster, BundleMaster, SalesRow, CRMRow, GoogleAdsRow, MetaAdsRow, TikTokShopRow, ShopeeRow, InstagramRow, TikTokOrganicRow, FollowUpTask } from './types'

// ── Products ─────────────────────────────────────────────────────────────────

export async function getProducts(): Promise<ProductMaster[]> {
  const { data, error } = await supabase.from('products').select('*').order('created_at')
  if (error) throw error
  return (data ?? []).map(r => ({
    id: r.id, sku: r.sku, name: r.name,
    price: r.price, cogs: r.cogs, margin: r.margin, brand: r.brand,
  }))
}

export async function upsertProduct(p: ProductMaster): Promise<void> {
  const margin = p.price > 0 ? ((p.price - p.cogs) / p.price) * 100 : 0
  const { error } = await supabase.from('products').upsert({
    id: p.id, sku: p.sku, name: p.name,
    price: p.price, cogs: p.cogs, margin, brand: p.brand,
  })
  if (error) throw error
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

// ── Bundles ──────────────────────────────────────────────────────────────────

export async function getBundles(): Promise<BundleMaster[]> {
  const { data, error } = await supabase.from('bundles').select('*').order('created_at')
  if (error) throw error
  return (data ?? []).map(r => ({
    id: r.id, name: r.name, components: r.components ?? [],
    price: r.price, cogs: r.cogs, margin: r.margin, brand: r.brand,
  }))
}

export async function upsertBundle(b: BundleMaster): Promise<void> {
  const margin = b.price > 0 ? ((b.price - b.cogs) / b.price) * 100 : 0
  const { error } = await supabase.from('bundles').upsert({
    id: b.id, name: b.name, components: b.components,
    price: b.price, cogs: b.cogs, margin, brand: b.brand,
  })
  if (error) throw error
}

export async function deleteBundle(id: string): Promise<void> {
  const { error } = await supabase.from('bundles').delete().eq('id', id)
  if (error) throw error
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export async function getTasks(brand: Brand): Promise<FollowUpTask[]> {
  const { data, error } = await supabase.from('tasks').select('*').eq('brand', brand).order('created_at')
  if (error) throw error
  return (data ?? []).map(r => ({
    id: r.id, customerName: r.customer_name, phone: r.phone,
    segment: r.segment, note: r.note, dueDate: r.due_date,
    status: r.status, brand: r.brand, createdAt: r.created_at,
  }))
}

export async function upsertTask(t: FollowUpTask): Promise<void> {
  const { error } = await supabase.from('tasks').upsert({
    id: t.id, customer_name: t.customerName, phone: t.phone,
    segment: t.segment, note: t.note, due_date: t.dueDate,
    status: t.status, brand: t.brand,
  })
  if (error) throw error
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

// ── Sales ────────────────────────────────────────────────────────────────────

export async function getSales(brand: Brand): Promise<SalesRow[]> {
  const { data, error } = await supabase.from('sales').select('*').eq('brand', brand).order('date')
  if (error) throw error
  return (data ?? []).map(r => ({
    date: r.date, product: r.product, qty: r.qty, revenue: r.revenue,
    channel: r.channel ?? '', cogs: r.cogs ?? 0, grossProfit: r.gross_profit ?? 0,
    customerName: r.customer_name ?? '', phone: r.phone ?? '',
    address: r.address ?? '', source: r.source ?? 'organic',
  }))
}

export async function appendSales(rows: SalesRow[], brand: Brand): Promise<void> {
  if (!rows.length) return
  const { error } = await supabase.from('sales').insert(
    rows.map(r => ({
      brand, date: r.date, product: r.product, qty: r.qty, revenue: r.revenue,
      channel: r.channel, cogs: r.cogs, gross_profit: r.grossProfit,
      customer_name: r.customerName, phone: r.phone,
      address: r.address, source: r.source ?? 'organic',
    }))
  )
  if (error) throw error
}

export async function replaceSales(rows: SalesRow[], brand: Brand): Promise<void> {
  const { error: delErr } = await supabase.from('sales').delete().eq('brand', brand)
  if (delErr) throw delErr
  if (rows.length) await appendSales(rows, brand)
}

// ── CRM ──────────────────────────────────────────────────────────────────────

export async function getCRM(brand: Brand): Promise<CRMRow[]> {
  const { data, error } = await supabase.from('crm').select('*').eq('brand', brand).order('date')
  if (error) throw error
  return (data ?? []).map(r => ({
    date: r.date, customerName: r.customer_name ?? '',
    phone: r.phone ?? '', product: r.product, qty: r.qty, revenue: r.revenue,
  }))
}

export async function appendCRM(rows: CRMRow[], brand: Brand): Promise<void> {
  if (!rows.length) return
  const { error } = await supabase.from('crm').insert(
    rows.map(r => ({
      brand, date: r.date, customer_name: r.customerName,
      phone: r.phone, product: r.product, qty: r.qty, revenue: r.revenue,
    }))
  )
  if (error) throw error
}

export async function replaceCRM(rows: CRMRow[], brand: Brand): Promise<void> {
  const { error: delErr } = await supabase.from('crm').delete().eq('brand', brand)
  if (delErr) throw delErr
  if (rows.length) await appendCRM(rows, brand)
}

// ── Google Ads ───────────────────────────────────────────────────────────────

export async function getGoogleAds(brand: Brand): Promise<GoogleAdsRow[]> {
  const { data, error } = await supabase.from('google_ads').select('*').eq('brand', brand).order('date')
  if (error) throw error
  return (data ?? []).map(r => ({
    date: r.date, campaign: r.campaign ?? '', impressions: r.impressions ?? 0,
    clicks: r.clicks ?? 0, ctr: r.ctr ?? 0, cpc: r.cpc ?? 0,
    spend: r.spend ?? 0, conversions: r.conversions ?? 0,
    convRate: r.conv_rate ?? 0, roas: r.roas ?? 0,
  }))
}

export async function replaceGoogleAds(rows: GoogleAdsRow[], brand: Brand): Promise<void> {
  const { error: delErr } = await supabase.from('google_ads').delete().eq('brand', brand)
  if (delErr) throw delErr
  if (!rows.length) return
  const { error } = await supabase.from('google_ads').insert(
    rows.map(r => ({
      brand, date: r.date, campaign: r.campaign, impressions: r.impressions,
      clicks: r.clicks, ctr: r.ctr, cpc: r.cpc, spend: r.spend,
      conversions: r.conversions, conv_rate: r.convRate, roas: r.roas,
    }))
  )
  if (error) throw error
}

export async function appendGoogleAds(rows: GoogleAdsRow[], brand: Brand): Promise<void> {
  if (!rows.length) return
  const { error } = await supabase.from('google_ads').insert(
    rows.map(r => ({
      brand, date: r.date, campaign: r.campaign, impressions: r.impressions,
      clicks: r.clicks, ctr: r.ctr, cpc: r.cpc, spend: r.spend,
      conversions: r.conversions, conv_rate: r.convRate, roas: r.roas,
    }))
  )
  if (error) throw error
}

// ── Meta Ads ─────────────────────────────────────────────────────────────────

export async function getMetaAds(brand: Brand): Promise<MetaAdsRow[]> {
  const { data, error } = await supabase.from('meta_ads').select('*').eq('brand', brand).order('date')
  if (error) throw error
  return (data ?? []).map(r => ({
    date: r.date, campaign: r.campaign ?? '', reach: r.reach ?? 0,
    impressions: r.impressions ?? 0, clicks: r.clicks ?? 0, ctr: r.ctr ?? 0,
    spend: r.spend ?? 0, purchases: r.purchases ?? 0, roas: r.roas ?? 0, cpm: r.cpm ?? 0,
    results: r.results ?? 0,
  }))
}

export async function replaceMetaAds(rows: MetaAdsRow[], brand: Brand): Promise<void> {
  const { error: delErr } = await supabase.from('meta_ads').delete().eq('brand', brand)
  if (delErr) throw delErr
  if (!rows.length) return
  const { error } = await supabase.from('meta_ads').insert(
    rows.map(r => ({
      brand, date: r.date, campaign: r.campaign, reach: r.reach,
      impressions: r.impressions, clicks: r.clicks, ctr: r.ctr,
      spend: r.spend, purchases: r.purchases, roas: r.roas, cpm: r.cpm,
      results: r.results ?? 0,
    }))
  )
  if (error) throw error
}

export async function appendMetaAds(rows: MetaAdsRow[], brand: Brand): Promise<void> {
  if (!rows.length) return
  const { error } = await supabase.from('meta_ads').insert(
    rows.map(r => ({
      brand, date: r.date, campaign: r.campaign, reach: r.reach,
      impressions: r.impressions, clicks: r.clicks, ctr: r.ctr,
      spend: r.spend, purchases: r.purchases, roas: r.roas, cpm: r.cpm,
      results: r.results ?? 0,
    }))
  )
  if (error) throw error
}

// ── TikTok Shop ──────────────────────────────────────────────────────────────

export async function getTikTokShop(brand: Brand): Promise<TikTokShopRow[]> {
  const { data, error } = await supabase.from('tiktok_shop').select('*').eq('brand', brand).order('date')
  if (error) throw error
  return (data ?? []).map(r => ({
    date: r.date, gmv: r.gmv ?? 0, orders: r.orders ?? 0,
    unitsSold: r.units_sold ?? 0, revenue: r.revenue ?? 0, productViews: r.product_views ?? 0,
  }))
}

export async function replaceTikTokShop(rows: TikTokShopRow[], brand: Brand): Promise<void> {
  const { error: delErr } = await supabase.from('tiktok_shop').delete().eq('brand', brand)
  if (delErr) throw delErr
  if (!rows.length) return
  const { error } = await supabase.from('tiktok_shop').insert(
    rows.map(r => ({
      brand, date: r.date, gmv: r.gmv, orders: r.orders,
      units_sold: r.unitsSold, revenue: r.revenue, product_views: r.productViews,
    }))
  )
  if (error) throw error
}

export async function appendTikTokShop(rows: TikTokShopRow[], brand: Brand): Promise<void> {
  if (!rows.length) return
  const { error } = await supabase.from('tiktok_shop').insert(
    rows.map(r => ({
      brand, date: r.date, gmv: r.gmv, orders: r.orders,
      units_sold: r.unitsSold, revenue: r.revenue, product_views: r.productViews,
    }))
  )
  if (error) throw error
}

// ── Shopee ───────────────────────────────────────────────────────────────────

export async function getShopee(brand: Brand): Promise<ShopeeRow[]> {
  const { data, error } = await supabase.from('shopee').select('*').eq('brand', brand).order('date')
  if (error) throw error
  return (data ?? []).map(r => ({
    date: r.date, gmv: r.gmv ?? 0, orders: r.orders ?? 0,
    unitsSold: r.units_sold ?? 0, revenue: r.revenue ?? 0, productViews: r.product_views ?? 0,
    adSpend: r.ad_spend ?? 0, adClicks: r.ad_clicks ?? 0, adImpressions: r.ad_impressions ?? 0,
  }))
}

export async function replaceShopee(rows: ShopeeRow[], brand: Brand): Promise<void> {
  const { error: delErr } = await supabase.from('shopee').delete().eq('brand', brand)
  if (delErr) throw delErr
  if (!rows.length) return
  const { error } = await supabase.from('shopee').insert(
    rows.map(r => ({
      brand, date: r.date, gmv: r.gmv, orders: r.orders,
      units_sold: r.unitsSold, revenue: r.revenue, product_views: r.productViews,
      ad_spend: r.adSpend, ad_clicks: r.adClicks, ad_impressions: r.adImpressions,
    }))
  )
  if (error) throw error
}

export async function appendShopee(rows: ShopeeRow[], brand: Brand): Promise<void> {
  if (!rows.length) return
  const { error } = await supabase.from('shopee').insert(
    rows.map(r => ({
      brand, date: r.date, gmv: r.gmv, orders: r.orders,
      units_sold: r.unitsSold, revenue: r.revenue, product_views: r.productViews,
      ad_spend: r.adSpend, ad_clicks: r.adClicks, ad_impressions: r.adImpressions,
    }))
  )
  if (error) throw error
}

// ── Instagram ────────────────────────────────────────────────────────────────

export async function getInstagram(brand: Brand): Promise<InstagramRow[]> {
  const { data, error } = await supabase.from('instagram').select('*').eq('brand', brand).order('date')
  if (error) throw error
  return (data ?? []).map(r => ({
    date: r.date, followers: r.followers ?? 0, reach: r.reach ?? 0,
    impressions: r.impressions ?? 0, profileVisits: r.profile_visits ?? 0, engagements: r.engagements ?? 0,
  }))
}

export async function replaceInstagram(rows: InstagramRow[], brand: Brand): Promise<void> {
  const { error: delErr } = await supabase.from('instagram').delete().eq('brand', brand)
  if (delErr) throw delErr
  if (!rows.length) return
  const { error } = await supabase.from('instagram').insert(
    rows.map(r => ({
      brand, date: r.date, followers: r.followers, reach: r.reach,
      impressions: r.impressions, profile_visits: r.profileVisits, engagements: r.engagements,
    }))
  )
  if (error) throw error
}

export async function appendInstagram(rows: InstagramRow[], brand: Brand): Promise<void> {
  if (!rows.length) return
  const { error } = await supabase.from('instagram').insert(
    rows.map(r => ({
      brand, date: r.date, followers: r.followers, reach: r.reach,
      impressions: r.impressions, profile_visits: r.profileVisits, engagements: r.engagements,
    }))
  )
  if (error) throw error
}

// ── TikTok Organic ───────────────────────────────────────────────────────────

export async function getTikTokOrganic(brand: Brand): Promise<TikTokOrganicRow[]> {
  const { data, error } = await supabase.from('tiktok_organic').select('*').eq('brand', brand).order('date')
  if (error) throw error
  return (data ?? []).map(r => ({
    date: r.date, followers: r.followers ?? 0, views: r.views ?? 0,
    likes: r.likes ?? 0, comments: r.comments ?? 0, shares: r.shares ?? 0,
  }))
}

export async function replaceTikTokOrganic(rows: TikTokOrganicRow[], brand: Brand): Promise<void> {
  const { error: delErr } = await supabase.from('tiktok_organic').delete().eq('brand', brand)
  if (delErr) throw delErr
  if (!rows.length) return
  const { error } = await supabase.from('tiktok_organic').insert(
    rows.map(r => ({
      brand, date: r.date, followers: r.followers, views: r.views,
      likes: r.likes, comments: r.comments, shares: r.shares,
    }))
  )
  if (error) throw error
}

export async function appendTikTokOrganic(rows: TikTokOrganicRow[], brand: Brand): Promise<void> {
  if (!rows.length) return
  const { error } = await supabase.from('tiktok_organic').insert(
    rows.map(r => ({
      brand, date: r.date, followers: r.followers, views: r.views,
      likes: r.likes, comments: r.comments, shares: r.shares,
    }))
  )
  if (error) throw error
}

// ── Load all brand data ──────────────────────────────────────────────────────

export async function loadBrandData(brand: Brand) {
  const [sales, crm, googleAds, metaAds, tiktokShop, shopee, instagram, tiktokOrganic] =
    await Promise.all([
      getSales(brand), getCRM(brand), getGoogleAds(brand), getMetaAds(brand),
      getTikTokShop(brand), getShopee(brand), getInstagram(brand), getTikTokOrganic(brand),
    ])
  return { sales, crm, googleAds, metaAds, tiktokShop, shopee, instagram, tiktokOrganic }
}

import type { Brand, SalesRow, CRMRow, ProductMaster, GoogleAdsRow, MetaAdsRow } from '@/lib/types'
import type { WithWmsId } from './types'

const margin = (price: number, cogs: number) => (price > 0 ? Math.round(((price - cogs) / price) * 100) : 0)

export function salesToDb(r: WithWmsId<SalesRow>, brand: Brand) {
  return {
    brand, wms_id: r.wmsId, origin: 'wms' as const,
    date: r.date, product: r.product, qty: r.qty, revenue: r.revenue,
    channel: r.channel, cogs: r.cogs, gross_profit: r.grossProfit,
    customer_name: r.customerName, phone: r.phone, address: r.address,
    source: r.source ?? 'organic',
  }
}

export function crmToDb(r: WithWmsId<CRMRow>, brand: Brand) {
  return {
    brand, wms_id: r.wmsId, origin: 'wms' as const,
    date: r.date, customer_name: r.customerName, phone: r.phone,
    product: r.product, qty: r.qty, revenue: r.revenue,
  }
}

export function productToDb(r: WithWmsId<ProductMaster>, brand: Brand) {
  return {
    brand, wms_id: r.wmsId, origin: 'wms' as const,
    sku: r.sku, name: r.name, price: r.price, cogs: r.cogs,
    margin: margin(r.price, r.cogs),
  }
}

export function googleAdsToDb(r: WithWmsId<GoogleAdsRow>, brand: Brand) {
  return {
    brand, wms_id: r.wmsId, origin: 'wms' as const,
    date: r.date, campaign: r.campaign, impressions: r.impressions, clicks: r.clicks,
    ctr: r.ctr, cpc: r.cpc, spend: r.spend, conversions: r.conversions,
    conv_rate: r.convRate, roas: r.roas,
  }
}

export function metaAdsToDb(r: WithWmsId<MetaAdsRow>, brand: Brand) {
  return {
    brand, wms_id: r.wmsId, origin: 'wms' as const,
    date: r.date, campaign: r.campaign, reach: r.reach, impressions: r.impressions,
    clicks: r.clicks, ctr: r.ctr, spend: r.spend, purchases: r.purchases,
    roas: r.roas, cpm: r.cpm, results: r.results,
  }
}

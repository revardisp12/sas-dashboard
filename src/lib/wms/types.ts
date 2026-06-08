import type { SalesRow, CRMRow, ProductMaster, GoogleAdsRow, MetaAdsRow, Brand } from '@/lib/types'

/** Tables the WMS can be a source of truth for. */
export type WmsTable = 'sales' | 'crm' | 'products' | 'google_ads' | 'meta_ads'

/** A date range (inclusive), YYYY-MM-DD. */
export interface DateRange { start: string; end: string }

/**
 * Each fetch returns the dashboard's existing row type plus a stable WMS id.
 * `wmsId` is the WMS's own record id — used for idempotent upsert.
 */
export type WithWmsId<T> = T & { wmsId: string }

/**
 * The seam. MockWmsAdapter (now) and HttpWmsAdapter (later) both implement this.
 * Methods a given WMS doesn't expose may be omitted; the core skips absent tables.
 */
export interface WmsAdapter {
  readonly mode: 'mock' | 'live'
  fetchSales?(brand: Brand, range: DateRange): Promise<WithWmsId<SalesRow>[]>
  fetchCRM?(brand: Brand, range: DateRange): Promise<WithWmsId<CRMRow>[]>
  fetchProducts?(brand: Brand): Promise<WithWmsId<ProductMaster>[]>
  fetchGoogleAds?(brand: Brand, range: DateRange): Promise<WithWmsId<GoogleAdsRow>[]>
  fetchMetaAds?(brand: Brand, range: DateRange): Promise<WithWmsId<MetaAdsRow>[]>
}

export interface SyncOptions {
  brands: Brand[]
  tables: WmsTable[]
  range: DateRange
  trigger: 'cron' | 'webhook' | 'manual'
  triggeredBy?: string
}

export interface SyncResult {
  status: 'success' | 'partial' | 'failed'
  tables: Record<string, number>           // table -> rows upserted
  perBrand: { brand: Brand; ok: boolean; error?: string }[]
  error?: string
}

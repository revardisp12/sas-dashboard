import type { SalesRow, CRMRow, ProductMaster, GoogleAdsRow, MetaAdsRow, Brand } from '@/lib/types'

/** Tables the WMS can be a source of truth for. */
export type WmsTable = 'sales' | 'crm' | 'products' | 'google_ads' | 'meta_ads'

/** A date range (inclusive), YYYY-MM-DD. */
export interface WmsDateRange { start: string; end: string }

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
  fetchSales?(brand: Brand, range: WmsDateRange): Promise<WithWmsId<SalesRow>[]>
  fetchCRM?(brand: Brand, range: WmsDateRange): Promise<WithWmsId<CRMRow>[]>
  fetchProducts?(brand: Brand): Promise<WithWmsId<ProductMaster>[]>
  fetchGoogleAds?(brand: Brand, range: WmsDateRange): Promise<WithWmsId<GoogleAdsRow>[]>
  fetchMetaAds?(brand: Brand, range: WmsDateRange): Promise<WithWmsId<MetaAdsRow>[]>
}

export interface SyncOptions {
  brands: Brand[]
  tables: readonly WmsTable[]
  range: WmsDateRange
  trigger: 'cron' | 'webhook' | 'manual'
  triggeredBy?: string
}

export interface SyncResult {
  /** 'skipped' = didn't run at all because a sync already in flight could overlap with one
   * of the requested brands (see runWmsSync's concurrency guard) — distinct from 'failed',
   * which means it DID run and errored. */
  status: 'success' | 'partial' | 'failed' | 'skipped'
  tables: Record<string, number>           // table -> rows upserted
  perBrand: { brand: Brand; ok: boolean; error?: string }[]
  error?: string
}

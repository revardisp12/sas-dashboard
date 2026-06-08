import type { Brand, SalesRow, CRMRow, ProductMaster, GoogleAdsRow, MetaAdsRow } from '@/lib/types'
import type { WmsAdapter, WithWmsId, WmsDateRange } from './types'

const NOT_IMPLEMENTED = 'HttpWmsAdapter not implemented yet — implement fetch methods before enabling live mode (see docs/wms-go-live-runbook.md)'

/**
 * Real WMS HTTP adapter — IMPLEMENTED AT GO-LIVE once the WMS API docs + token exist.
 * Until then every method throws, so enabling live mode before implementation fails
 * LOUDLY (sync status 'failed', error logged) instead of silently syncing zero rows.
 * To implement: replace each stub with a fetch() to WMS_API_BASE_URL using
 * Authorization: Bearer WMS_API_TOKEN, mapping WMS fields -> WithWmsId<RowType>.
 */
export class HttpWmsAdapter implements WmsAdapter {
  readonly mode = 'live' as const
  constructor(private baseUrl: string, private token: string) {}

  async fetchSales(_brand: Brand, _range: WmsDateRange): Promise<WithWmsId<SalesRow>[]> { throw new Error(NOT_IMPLEMENTED) }
  async fetchCRM(_brand: Brand, _range: WmsDateRange): Promise<WithWmsId<CRMRow>[]> { throw new Error(NOT_IMPLEMENTED) }
  async fetchProducts(_brand: Brand): Promise<WithWmsId<ProductMaster>[]> { throw new Error(NOT_IMPLEMENTED) }
  async fetchGoogleAds(_brand: Brand, _range: WmsDateRange): Promise<WithWmsId<GoogleAdsRow>[]> { throw new Error(NOT_IMPLEMENTED) }
  async fetchMetaAds(_brand: Brand, _range: WmsDateRange): Promise<WithWmsId<MetaAdsRow>[]> { throw new Error(NOT_IMPLEMENTED) }
}

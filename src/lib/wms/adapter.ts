import type { WmsAdapter } from './types'
import { MockWmsAdapter } from './mockAdapter'
import { HttpWmsAdapter } from './httpAdapter'

export function getWmsAdapter(): WmsAdapter {
  const mode = process.env.WMS_SYNC_ENABLED ?? 'mock'
  if (mode === 'live') {
    const baseUrl = process.env.WMS_API_BASE_URL
    const apiKey = process.env.WMS_API_KEY
    if (!baseUrl || !apiKey) throw new Error('WMS live mode requires WMS_API_BASE_URL + WMS_API_KEY')
    return new HttpWmsAdapter(baseUrl, apiKey)
  }
  // In production, never silently fall back to fabricated data: if WMS_SYNC_ENABLED gets
  // lost (e.g. an env var dropped during a redeploy), a manual sync or webhook call would
  // otherwise run the Mock adapter's scope-replace (delete+reinsert) against real revenue
  // rows via service_role. The cron route already no-ops in this case (see cron/wms-sync);
  // this is the same guard centralized here so it also covers manual sync + webhook, which
  // both call getWmsAdapter() directly. Non-production (local/preview) still gets Mock, so
  // on-demand testing keeps working before WMS_SYNC_ENABLED is ever set.
  if (process.env.VERCEL_ENV === 'production') {
    throw new Error('WMS_SYNC_ENABLED is not "live" in production — refusing to run the Mock adapter against production data')
  }
  return new MockWmsAdapter()
}

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
  return new MockWmsAdapter()
}

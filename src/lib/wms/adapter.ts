import type { WmsAdapter } from './types'
import { MockWmsAdapter } from './mockAdapter'
import { HttpWmsAdapter } from './httpAdapter'

export function getWmsAdapter(): WmsAdapter {
  const mode = process.env.WMS_SYNC_ENABLED ?? 'mock'
  if (mode === 'live') {
    const baseUrl = process.env.WMS_API_BASE_URL
    const token = process.env.WMS_API_TOKEN
    if (!baseUrl || !token) throw new Error('WMS live mode requires WMS_API_BASE_URL + WMS_API_TOKEN')
    return new HttpWmsAdapter(baseUrl, token)
  }
  return new MockWmsAdapter()
}

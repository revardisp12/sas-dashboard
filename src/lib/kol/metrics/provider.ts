import type { KolMetricsProvider } from './types'
import { ManualProvider } from './manualProvider'
import { RapidApiProvider } from './rapidApiProvider'
export function getKolMetricsProvider(): KolMetricsProvider {
  if ((process.env.KOL_METRICS_ENABLED ?? 'manual') === 'live') {
    const key = process.env.RAPIDAPI_KEY
    if (!key) throw new Error('KOL live mode requires RAPIDAPI_KEY')
    return new RapidApiProvider(key)
  }
  return new ManualProvider()
}

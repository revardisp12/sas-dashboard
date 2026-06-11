import type { KolMetricsProvider, FetchedMetrics } from './types'
const NOT_IMPL = 'RapidApiProvider not implemented — set up RapidAPI + implement before KOL_METRICS_ENABLED=live (see docs/kol-go-live-runbook.md)'
/** Go-live: call RapidAPI Instagram Statistics API by URL, map response → FetchedMetrics. */
export class RapidApiProvider implements KolMetricsProvider {
  readonly mode = 'live' as const
  constructor(private apiKey: string) {}
  async fetch(_url: string, _platform: string): Promise<FetchedMetrics | null> { throw new Error(NOT_IMPL) }
}

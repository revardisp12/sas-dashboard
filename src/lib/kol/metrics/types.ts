export interface FetchedMetrics { likes: number; comments: number; saved: number; shares: number; views: number }
export interface KolMetricsProvider {
  readonly mode: 'manual' | 'live'
  fetch(url: string, platform: string): Promise<FetchedMetrics | null>
}

/**
 * `saved`/`shares` are optional — a provider that can't supply a given metric (e.g. Instagram
 * doesn't expose saves/shares to the scraping API this dashboard uses) must OMIT the key
 * entirely rather than sending 0, so callers can tell "not provided, keep whatever's already
 * there" apart from "provided, and the real value is zero".
 */
export interface FetchedMetrics { likes: number; comments: number; saved?: number; shares?: number; views: number }
export interface KolMetricsProvider {
  readonly mode: 'manual' | 'live'
  fetch(url: string, platform: string): Promise<FetchedMetrics | null>
}

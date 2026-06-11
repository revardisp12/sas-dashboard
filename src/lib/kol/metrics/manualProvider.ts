import type { KolMetricsProvider } from './types'
// No-op: in manual mode metrics are entered by hand. Always returns null.
export class ManualProvider implements KolMetricsProvider {
  readonly mode = 'manual' as const
  async fetch(_url: string, _platform: string): Promise<null> { return null }
}

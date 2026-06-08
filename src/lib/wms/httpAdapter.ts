import type { WmsAdapter } from './types'

/**
 * Real WMS HTTP adapter — IMPLEMENTED AT GO-LIVE once the WMS API docs + token exist.
 * Until then it throws so a misconfigured 'live' mode fails loudly instead of silently.
 * To implement: read WMS API docs, add fetch* methods calling WMS_API_BASE_URL with
 * Authorization: Bearer WMS_API_TOKEN, and map WMS fields -> WithWmsId<RowType>.
 */
export class HttpWmsAdapter implements WmsAdapter {
  readonly mode = 'live' as const
  constructor(private baseUrl: string, private token: string) {}
  // No fetch* methods yet — the core skips absent tables, but in 'live' mode we want a
  // loud failure if someone enables live before implementing. The factory enforces that.
}

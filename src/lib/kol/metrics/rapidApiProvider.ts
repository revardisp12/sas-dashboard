import type { KolMetricsProvider, FetchedMetrics } from './types'

const HOST = 'instagram-statistics-api.p.rapidapi.com'

interface PostByUrlResponse {
  meta?: { code?: number; message?: string }
  data?: { likes?: number; comments?: number; views?: number }
}

/**
 * Go-live: RapidAPI "Instagram Statistics API" — `GET /posts/one?postUrl=<url>`.
 * Confirmed against the live playground 2026-07-09: only handles Instagram post/reel URLs
 * (a TikTok URL returns `{meta:{code:400,message:"Bad request. Use for Instagram only."}}`),
 * despite the marketplace listing's description mentioning other platforms — that coverage
 * evidently applies to its profile/audience-stats endpoints, not this one. TikTok/YouTube
 * stay on manual entry until a separate provider is added for them (see
 * docs/kol-go-live-runbook.md); this provider intentionally no-ops (returns null, same as
 * ManualProvider) for any platform other than Instagram, without spending an API call on a
 * request guaranteed to be rejected.
 *
 * The response never includes `saved`/`shares` (Instagram doesn't expose those to this kind
 * of API) — both keys are OMITTED from the returned object (not set to 0), so a caller can
 * tell "this provider doesn't know" apart from "the real count is zero" and leave whatever
 * manual value is already on the content alone instead of clobbering it to 0.
 */
export class RapidApiProvider implements KolMetricsProvider {
  readonly mode = 'live' as const
  constructor(private apiKey: string) {}

  async fetch(url: string, platform: string): Promise<FetchedMetrics | null> {
    if (platform !== 'Instagram') return null

    const res = await fetch(`https://${HOST}/posts/one?postUrl=${encodeURIComponent(url)}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': HOST,
        'x-rapidapi-key': this.apiKey,
      },
    })
    if (!res.ok) throw new Error(`RapidAPI posts/one -> HTTP ${res.status}`)

    const body = (await res.json()) as PostByUrlResponse
    if (body.meta?.code !== 200 || !body.data) {
      throw new Error(`RapidAPI posts/one -> ${body.meta?.code ?? 'unknown'} ${body.meta?.message ?? ''}`.trim())
    }

    return {
      views: body.data.views ?? 0,
      likes: body.data.likes ?? 0,
      comments: body.data.comments ?? 0,
      // saved/shares intentionally omitted — see class doc comment above.
    }
  }
}

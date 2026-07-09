import type { KolMetricsProvider, FetchedMetrics } from './types'
import { isAllowedContentUrl } from '@/lib/kol/contentUrl'

const IG_HOST = 'instagram-statistics-api.p.rapidapi.com'
const TT_HOST = 'tiktok-api23.p.rapidapi.com'

interface InstagramPostResponse {
  meta?: { code?: number; message?: string }
  data?: { likes?: number; comments?: number; views?: number }
}

interface TikTokPostResponse {
  statusCode?: number
  statusMsg?: string
  itemInfo?: {
    itemStruct?: {
      stats?: {
        diggCount?: number
        commentCount?: number
        playCount?: number
        shareCount?: number
        /** Confirmed via a live example response to be a STRING here, unlike the other counts. */
        collectCount?: string | number
      }
    }
  }
}

/**
 * Extract a TikTok numeric video ID from a content URL. Canonical URLs
 * (`tiktok.com/@user/video/<id>` or `.../photo/<id>`) carry the ID directly. Short share
 * links (`vt.tiktok.com/...`, `vm.tiktok.com/...`) don't — those are resolved by following
 * the redirect to find the canonical URL first (a plain HTTP call to TikTok itself, no
 * RapidAPI/API-key involved).
 */
async function extractTikTokVideoId(url: string): Promise<string | null> {
  const direct = url.match(/\/(?:video|photo)\/(\d+)/)
  if (direct) return direct[1]
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    const resolved = res.url.match(/\/(?:video|photo)\/(\d+)/)
    return resolved ? resolved[1] : null
  } catch {
    return null
  }
}

/**
 * Go-live: two RapidAPI subscriptions behind one `RAPIDAPI_KEY` —
 *  - Instagram: "Instagram Statistics API" — `GET /posts/one?postUrl=<url>`. Confirmed
 *    against the live playground 2026-07-09: only handles Instagram post/reel URLs (a
 *    TikTok URL returns `{meta:{code:400,message:"Bad request. Use for Instagram only."}}`),
 *    despite the marketplace listing's description mentioning other platforms — that
 *    coverage evidently applies to its profile/audience-stats endpoints, not this one. Its
 *    response never includes `saved`/`shares` (Instagram doesn't expose those to this kind
 *    of API) — both keys are OMITTED from the returned object (not set to 0), so a caller
 *    can tell "this provider doesn't know" apart from "the real count is zero" and leave
 *    whatever manual value is already on the content alone instead of clobbering it to 0.
 *  - TikTok: "TikTok API" (RapidAPI-verified listing) — `GET /api/post/detail?videoId=<id>`,
 *    confirmed live 2026-07-09. Unlike Instagram's, this DOES return shares (`shareCount`)
 *    and saves (`collectCount`, oddly a STRING in the response, parsed with Number() here).
 *    Success is indicated by `statusCode === 0` (not an HTTP-style 200) — a different
 *    envelope convention than the Instagram API's `meta.code`. The endpoint takes a numeric
 *    video ID, not a URL, so `extractTikTokVideoId` runs first.
 *
 * YouTube stays on manual entry — no API found so far covers per-post stats across all
 * three platforms despite marketing claims to the contrary (see docs/kol-go-live-runbook.md
 * for what adding it would take; YouTube specifically has a free official option worth using
 * directly instead of another paid scraper).
 */
export class RapidApiProvider implements KolMetricsProvider {
  readonly mode = 'live' as const
  constructor(private apiKey: string) {}

  private headers(host: string): Record<string, string> {
    return { 'Content-Type': 'application/json', 'x-rapidapi-host': host, 'x-rapidapi-key': this.apiKey }
  }

  async fetch(url: string, platform: string): Promise<FetchedMetrics | null> {
    if (platform !== 'Instagram' && platform !== 'TikTok') return null
    // Re-validated here, not just at the API-route boundary that calls this: content_url
    // reaches this provider from other paths too (the cron refresh reads it straight from
    // the DB with no host check of its own, and bulk CSV import persists it with none at
    // all). fetchTikTok resolves short links via an outbound fetch to the URL itself — an
    // unchecked URL there is a real SSRF vector, so this is the last line of defense, not
    // the first.
    if (!isAllowedContentUrl(url)) {
      throw new Error(`Refusing to pull metrics for a URL outside the allowed hosts: ${url}`)
    }
    if (platform === 'Instagram') return this.fetchInstagram(url)
    return this.fetchTikTok(url)
  }

  private async fetchInstagram(url: string): Promise<FetchedMetrics> {
    const res = await fetch(`https://${IG_HOST}/posts/one?postUrl=${encodeURIComponent(url)}`, {
      headers: this.headers(IG_HOST),
    })
    if (!res.ok) throw new Error(`RapidAPI posts/one -> HTTP ${res.status}`)

    const body = (await res.json()) as InstagramPostResponse
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

  private async fetchTikTok(url: string): Promise<FetchedMetrics> {
    const videoId = await extractTikTokVideoId(url)
    if (!videoId) throw new Error(`Could not extract a TikTok video ID from URL: ${url}`)

    const res = await fetch(`https://${TT_HOST}/api/post/detail?videoId=${encodeURIComponent(videoId)}`, {
      headers: this.headers(TT_HOST),
    })
    if (!res.ok) throw new Error(`RapidAPI post/detail -> HTTP ${res.status}`)

    const body = (await res.json()) as TikTokPostResponse
    const stats = body.itemInfo?.itemStruct?.stats
    if (body.statusCode !== 0 || !stats) {
      throw new Error(`RapidAPI post/detail -> ${body.statusCode ?? 'unknown'} ${body.statusMsg ?? ''}`.trim())
    }

    return {
      views: stats.playCount ?? 0,
      likes: stats.diggCount ?? 0,
      comments: stats.commentCount ?? 0,
      saved: Number(stats.collectCount ?? 0),
      shares: stats.shareCount ?? 0,
    }
  }
}

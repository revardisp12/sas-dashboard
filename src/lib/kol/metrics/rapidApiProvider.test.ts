import { describe, it, expect, vi, afterEach } from 'vitest'
import { RapidApiProvider } from './rapidApiProvider'

const KEY = 'test-rapidapi-key'

function stubFetch(handler: (url: string, init?: RequestInit) => { status: number; body?: unknown; resolvedUrl?: string }) {
  const fn = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const { status, body, resolvedUrl } = handler(String(url), init)
    return {
      ok: status >= 200 && status < 300,
      status,
      url: resolvedUrl ?? String(url),
      json: async () => body,
    } as unknown as Response
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

describe('RapidApiProvider', () => {
  it('returns null for a platform with no provider at all (YouTube) without making any network call', async () => {
    const fn = stubFetch(() => ({ status: 200, body: {} }))
    const result = await new RapidApiProvider(KEY).fetch('https://www.youtube.com/watch?v=abc', 'YouTube')
    expect(result).toBeNull()
    expect(fn).not.toHaveBeenCalled()
  })

  it('SSRF guard: refuses a non-allowlisted URL for a supported platform WITHOUT making any network call, even one that would otherwise directly regex-match a video ID', async () => {
    const fn = stubFetch(() => ({ status: 200, body: {} }))
    // content_url reaches this provider from the cron refresh (reads straight from the DB,
    // no host check of its own) and from bulk CSV import (persisted with none at all) — this
    // proves the provider itself refuses an unsafe URL rather than trusting the caller did.
    await expect(
      new RapidApiProvider(KEY).fetch('https://evil.example.com/video/123', 'TikTok'),
    ).rejects.toThrow(/Refusing to pull metrics/)
    expect(fn).not.toHaveBeenCalled()
  })

  it('SSRF guard: refuses an internal/link-local address disguised with an allowed-looking path', async () => {
    const fn = stubFetch(() => ({ status: 200, body: {} }))
    await expect(
      new RapidApiProvider(KEY).fetch('https://169.254.169.254/latest/meta-data/video/123', 'TikTok'),
    ).rejects.toThrow(/Refusing to pull metrics/)
    expect(fn).not.toHaveBeenCalled()
  })

  it('SSRF guard: refuses a non-https URL on an otherwise-allowed host', async () => {
    const fn = stubFetch(() => ({ status: 200, body: {} }))
    await expect(
      new RapidApiProvider(KEY).fetch('http://www.tiktok.com/@x/video/123', 'TikTok'),
    ).rejects.toThrow(/Refusing to pull metrics/)
    expect(fn).not.toHaveBeenCalled()
  })

  describe('Instagram', () => {
    it('maps a successful response to FetchedMetrics, OMITTING saved/shares rather than zeroing them', async () => {
      stubFetch((url) => {
        expect(url).toBe(
          'https://instagram-statistics-api.p.rapidapi.com/posts/one?postUrl=' +
            encodeURIComponent('https://www.instagram.com/reel/DaePLapSsd6/'),
        )
        return { status: 200, body: { meta: { code: 200, message: 'OK' }, data: { likes: 38262, comments: 102, views: 1620841 } } }
      })

      const result = await new RapidApiProvider(KEY).fetch('https://www.instagram.com/reel/DaePLapSsd6/', 'Instagram')
      expect(result).toEqual({ views: 1620841, likes: 38262, comments: 102 })
      // Explicitly not just "falsy" — the keys must be genuinely absent, not present-and-0,
      // so a caller's `pulled.saved !== undefined` check can tell the two apart.
      expect(result).not.toHaveProperty('saved')
      expect(result).not.toHaveProperty('shares')
    })

    it('sends the RapidAPI host + key headers', async () => {
      const fn = stubFetch(() => ({ status: 200, body: { meta: { code: 200 }, data: { likes: 0, comments: 0, views: 0 } } }))
      await new RapidApiProvider(KEY).fetch('https://www.instagram.com/p/abc/', 'Instagram')
      const init = fn.mock.calls[0][1] as RequestInit
      const headers = init.headers as Record<string, string>
      expect(headers['x-rapidapi-host']).toBe('instagram-statistics-api.p.rapidapi.com')
      expect(headers['x-rapidapi-key']).toBe(KEY)
    })

    it('throws when the API rejects the URL (e.g. a non-Instagram link mislabeled as Instagram)', async () => {
      stubFetch(() => ({ status: 200, body: { meta: { code: 400, message: 'Bad request. Use for Instagram only.' } } }))
      await expect(
        new RapidApiProvider(KEY).fetch('https://www.tiktok.com/@x/video/123', 'Instagram'),
      ).rejects.toThrow(/Bad request/)
    })

    it('throws on a non-2xx HTTP response', async () => {
      stubFetch(() => ({ status: 500, body: {} }))
      await expect(
        new RapidApiProvider(KEY).fetch('https://www.instagram.com/p/abc/', 'Instagram'),
      ).rejects.toThrow(/HTTP 500/)
    })

    it('throws when the response body is missing data despite a 200 meta code', async () => {
      stubFetch(() => ({ status: 200, body: { meta: { code: 200 } } }))
      await expect(
        new RapidApiProvider(KEY).fetch('https://www.instagram.com/p/abc/', 'Instagram'),
      ).rejects.toThrow()
    })
  })

  describe('TikTok', () => {
    const statsBody = {
      statusCode: 0,
      statusMsg: 'ok',
      itemInfo: { itemStruct: { stats: { diggCount: 5300000, commentCount: 68700, playCount: 44400000, shareCount: 91200, collectCount: '291901' } } },
    }

    it('extracts the video ID directly from a canonical /video/ URL and maps all 5 metrics, including saved (parsed from a string) and shares', async () => {
      stubFetch((url) => {
        expect(url).toBe('https://tiktok-api23.p.rapidapi.com/api/post/detail?videoId=7306132438047116586')
        return { status: 200, body: statsBody }
      })
      const result = await new RapidApiProvider(KEY).fetch(
        'https://www.tiktok.com/@taylorswift/video/7306132438047116586',
        'TikTok',
      )
      expect(result).toEqual({ views: 44400000, likes: 5300000, comments: 68700, saved: 291901, shares: 91200 })
    })

    it('also extracts the ID from a /photo/ URL', async () => {
      stubFetch((url) => {
        expect(url).toContain('videoId=7306132438047116586')
        return { status: 200, body: statsBody }
      })
      const result = await new RapidApiProvider(KEY).fetch(
        'https://www.tiktok.com/@taylorswift/photo/7306132438047116586',
        'TikTok',
      )
      expect(result?.views).toBe(44400000)
    })

    it('resolves a short vt.tiktok.com link via redirect before calling the stats endpoint', async () => {
      const fn = stubFetch((url, init) => {
        if (url === 'https://vt.tiktok.com/ZSabcdef/') {
          expect(init?.method).toBe('HEAD')
          return { status: 200, resolvedUrl: 'https://www.tiktok.com/@taylorswift/video/7306132438047116586' }
        }
        expect(url).toBe('https://tiktok-api23.p.rapidapi.com/api/post/detail?videoId=7306132438047116586')
        return { status: 200, body: statsBody }
      })
      const result = await new RapidApiProvider(KEY).fetch('https://vt.tiktok.com/ZSabcdef/', 'TikTok')
      expect(result?.views).toBe(44400000)
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('throws when a video ID cannot be extracted or resolved (e.g. a profile URL, or a redirect that fails)', async () => {
      stubFetch(() => ({ status: 200, resolvedUrl: 'https://www.tiktok.com/@taylorswift' }))
      await expect(
        new RapidApiProvider(KEY).fetch('https://www.tiktok.com/@taylorswift', 'TikTok'),
      ).rejects.toThrow(/Could not extract/)
    })

    it('throws on a non-zero statusCode', async () => {
      stubFetch(() => ({ status: 200, body: { statusCode: 10202, statusMsg: 'item_not_found' } }))
      await expect(
        new RapidApiProvider(KEY).fetch('https://www.tiktok.com/@x/video/999999999999999999', 'TikTok'),
      ).rejects.toThrow(/item_not_found/)
    })

    it('throws on a non-2xx HTTP response', async () => {
      stubFetch(() => ({ status: 500, body: {} }))
      await expect(
        new RapidApiProvider(KEY).fetch('https://www.tiktok.com/@x/video/123', 'TikTok'),
      ).rejects.toThrow(/HTTP 500/)
    })

    it('sends the TikTok RapidAPI host + key headers', async () => {
      const fn = stubFetch(() => ({ status: 200, body: statsBody }))
      await new RapidApiProvider(KEY).fetch('https://www.tiktok.com/@x/video/123', 'TikTok')
      const init = fn.mock.calls[0][1] as RequestInit
      const headers = init.headers as Record<string, string>
      expect(headers['x-rapidapi-host']).toBe('tiktok-api23.p.rapidapi.com')
      expect(headers['x-rapidapi-key']).toBe(KEY)
    })
  })
})

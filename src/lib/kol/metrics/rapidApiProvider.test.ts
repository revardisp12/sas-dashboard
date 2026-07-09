import { describe, it, expect, vi, afterEach } from 'vitest'
import { RapidApiProvider } from './rapidApiProvider'

const KEY = 'test-rapidapi-key'

function stubFetch(handler: (url: string, init?: RequestInit) => { status: number; body: unknown }) {
  const fn = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const { status, body } = handler(String(url), init)
    return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

describe('RapidApiProvider', () => {
  it('returns null for a non-Instagram platform without making any network call', async () => {
    const fn = stubFetch(() => ({ status: 200, body: {} }))
    const result = await new RapidApiProvider(KEY).fetch('https://www.tiktok.com/@x/video/123', 'TikTok')
    expect(result).toBeNull()
    expect(fn).not.toHaveBeenCalled()
  })

  it('maps a successful Instagram response to FetchedMetrics, OMITTING saved/shares rather than zeroing them', async () => {
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

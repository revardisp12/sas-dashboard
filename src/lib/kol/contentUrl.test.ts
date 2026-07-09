import { describe, it, expect } from 'vitest'
import { isAllowedContentUrl } from './contentUrl'

describe('isAllowedContentUrl', () => {
  it('allows https TikTok, Instagram, and YouTube URLs (including short-link hosts)', () => {
    expect(isAllowedContentUrl('https://www.tiktok.com/@x/video/123')).toBe(true)
    expect(isAllowedContentUrl('https://tiktok.com/@x/video/123')).toBe(true)
    expect(isAllowedContentUrl('https://vt.tiktok.com/ZSabcdef/')).toBe(true)
    expect(isAllowedContentUrl('https://vm.tiktok.com/ZSabcdef/')).toBe(true)
    expect(isAllowedContentUrl('https://www.instagram.com/reel/abc/')).toBe(true)
    expect(isAllowedContentUrl('https://instagram.com/p/abc/')).toBe(true)
    expect(isAllowedContentUrl('https://www.youtube.com/watch?v=abc')).toBe(true)
    expect(isAllowedContentUrl('https://youtu.be/abc')).toBe(true)
  })

  it('rejects a host outside the allowlist, including an internal/link-local address', () => {
    expect(isAllowedContentUrl('https://evil.example.com/video/123')).toBe(false)
    expect(isAllowedContentUrl('https://169.254.169.254/latest/meta-data/')).toBe(false)
    expect(isAllowedContentUrl('https://localhost/foo')).toBe(false)
  })

  it('rejects a non-https URL even on an otherwise-allowed host (SSRF via internal http:// targets)', () => {
    expect(isAllowedContentUrl('http://www.tiktok.com/@x/video/123')).toBe(false)
    expect(isAllowedContentUrl('http://169.254.169.254/latest/meta-data/')).toBe(false)
  })

  it('rejects a malformed URL instead of throwing', () => {
    expect(isAllowedContentUrl('not a url')).toBe(false)
    expect(isAllowedContentUrl('')).toBe(false)
  })

  it('is case-insensitive on hostname', () => {
    expect(isAllowedContentUrl('https://WWW.TIKTOK.COM/@x/video/123')).toBe(true)
  })
})

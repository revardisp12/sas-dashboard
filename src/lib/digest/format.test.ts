import { describe, it, expect } from 'vitest'
import { formatDigestText } from './format'
import type { DigestPayload } from './types'

function mkPayload(overrides?: Partial<DigestPayload>): DigestPayload {
  return {
    brand: 'reglow',
    weekStart: '2026-05-18',
    weekEnd: '2026-05-24',
    weekNumber: 21,
    generatedAt: '2026-05-25T02:00:00Z',
    kpis: {
      revenue: { current: 245_000_000, previous: 218_000_000, diff: 27_000_000, percent: 12.39, direction: 'up' },
      orders: { current: 287, previous: 295, diff: -8, percent: -2.71, direction: 'down' },
      blendedRoas: { current: 4.8, previous: 4.5, diff: 0.3, percent: 6.67, direction: 'up' },
      newCustomers: { current: 142, previous: 154, diff: -12, percent: -7.79, direction: 'down' },
      champions: { current: 87, previous: 75, diff: 12, percent: 16, direction: 'up' },
    },
    topMover: {
      channel: 'meta-ads',
      direction: 'positive',
      revenueChange: 89_000_000,
      caption: 'meta-ads +Rp 89.000.000 revenue WoW',
    },
    ...overrides,
  }
}

describe('formatDigestText', () => {
  it('includes brand label and week number in header', () => {
    const text = formatDigestText(mkPayload(), 'https://dash.example.com')
    expect(text).toContain('Reglow Weekly Digest')
    expect(text).toContain('Week 21')
    expect(text).toContain('2026-05-18')
    expect(text).toContain('2026-05-24')
  })

  it('renders revenue with IDR thousands separator and up arrow', () => {
    const text = formatDigestText(mkPayload(), 'x')
    expect(text).toMatch(/Revenue: Rp 245\.000\.000 \(\+12\.4% WoW\) ✅/)
  })

  it('uses warning emoji for down direction', () => {
    const text = formatDigestText(mkPayload(), 'x')
    expect(text).toMatch(/Orders: 287 \(-2\.7% WoW\) ⚠️/)
  })

  it('renders ROAS as Nx with one decimal', () => {
    const text = formatDigestText(mkPayload(), 'x')
    expect(text).toMatch(/ROAS: 4\.8x/)
  })

  it('renders top mover section when present', () => {
    const text = formatDigestText(mkPayload(), 'x')
    expect(text).toContain('TOP MOVER')
    expect(text).toContain('meta-ads')
  })

  it('renders WATCH OUT for negative top mover', () => {
    const p = mkPayload({
      topMover: { channel: 'tiktok-ads', direction: 'negative', revenueChange: -45_000_000, caption: 'tiktok-ads -Rp 45.000.000 revenue WoW' },
    })
    const text = formatDigestText(p, 'x')
    expect(text).toContain('WATCH OUT')
    expect(text).toContain('tiktok-ads')
  })

  it('omits top mover section when null', () => {
    const text = formatDigestText(mkPayload({ topMover: null }), 'x')
    expect(text).not.toContain('TOP MOVER')
    expect(text).not.toContain('WATCH OUT')
  })

  it('includes dashboard URL at the bottom', () => {
    const text = formatDigestText(mkPayload(), 'https://dash.example.com')
    expect(text).toContain('https://dash.example.com/digest/reglow')
  })

  it('shows "—" instead of percent when previous is zero', () => {
    const p = mkPayload()
    p.kpis.revenue = { current: 100, previous: 0, diff: 100, percent: null, direction: 'up' }
    const text = formatDigestText(p, 'x')
    expect(text).toContain('Revenue: Rp 100 (new) ✅')
  })
})

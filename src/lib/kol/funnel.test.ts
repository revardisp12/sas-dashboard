import { describe, it, expect } from 'vitest'
import { awarenessSig, considerationSig, tierTotals, TIER } from './funnel'
import type { KolContent } from './types'

const c = (over: Partial<KolContent>): KolContent => ({
  id: 'x', brand: 'reglow', campaignId: null, influencerId: null, platform: 'TikTok',
  product: '', task: '', objective: 'awareness', contentUrl: '', status: 'uploaded', fee: 0,
  likes: 0, comments: 0, saved: 0, shares: 0, views: 0, metricsSource: 'manual',
  metricsFetchedAt: null, postedAt: null, ...over,
})

describe('funnel signals', () => {
  it('awareness = views + likes', () => { expect(awarenessSig(c({ views: 1000, likes: 50 }))).toBe(1050) })
  it('consideration = comments + saved + shares', () => { expect(considerationSig(c({ comments: 10, saved: 5, shares: 2 }))).toBe(17) })
  it('tierTotals sums per tier across content', () => {
    const t = tierTotals([c({ views: 100, likes: 10 }), c({ comments: 3, saved: 1, shares: 1 })])
    expect(t.awareness).toBe(110); expect(t.consideration).toBe(5)
  })
  it('TIER has 3 tiers', () => { expect(Object.keys(TIER)).toEqual(['awareness', 'consideration', 'action']) })
})

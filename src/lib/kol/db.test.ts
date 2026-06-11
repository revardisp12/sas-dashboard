import { describe, it, expect, vi } from 'vitest'

// Mock supabase so the module-level createClient() doesn't fail in unit tests
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { contentToRow, rowToContent } from './db'

describe('kol content mapping', () => {
  it('round-trips content row (camel↔snake)', () => {
    const row = { id: 'k1', brand: 'reglow', campaign_id: 'c1', influencer_id: 'i1', platform: 'TikTok',
      product: 'Serum', task: 'Review', funnel_objective: 'consideration', content_url: 'tiktok.com/x',
      status: 'uploaded', fee: 1000, likes: 5, comments: 2, saved: 1, shares: 1, video_views: 900,
      metrics_source: 'manual', metrics_fetched_at: null, posted_at: '2026-06-01' }
    const c = rowToContent(row)
    expect(c.objective).toBe('consideration'); expect(c.views).toBe(900); expect(c.campaignId).toBe('c1')
    const back = contentToRow(c, 'reglow')
    expect(back.video_views).toBe(900); expect(back.funnel_objective).toBe('consideration'); expect(back.brand).toBe('reglow')
  })
})

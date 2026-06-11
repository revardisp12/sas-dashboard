import type { Tier, KolContent } from './types'

// Marcomm funnel mapping — single source of truth. Tune here only.
export const TIER: Record<Tier, { label: string; color: string; bg: string; fg: string; desc: string }> = {
  awareness:     { label: 'Awareness',     color: '#0EA5E9', bg: '#E0F2FE', fg: '#075985', desc: 'Views + Likes' },
  consideration: { label: 'Consideration', color: '#8B5CF6', bg: '#EDE9FE', fg: '#5B21B6', desc: 'Comments + Saves + Shares' },
  action:        { label: 'Action',        color: '#10B981', bg: '#D1FAE5', fg: '#065F46', desc: 'Clicks + Promo (Phase 3)' },
}
export const awarenessSig = (c: KolContent) => c.views + c.likes
export const considerationSig = (c: KolContent) => c.comments + c.saved + c.shares
export function tierTotals(contents: KolContent[]) {
  return contents.reduce(
    (acc, c) => ({ awareness: acc.awareness + awarenessSig(c), consideration: acc.consideration + considerationSig(c), action: acc.action }),
    { awareness: 0, consideration: 0, action: 0 },
  )
}

export type Tier = 'awareness' | 'consideration' | 'action'
export type KolPlatform = 'Instagram' | 'TikTok' | 'YouTube'

export interface KolInfluencer {
  id: string; brand: string; name: string; username: string; platform: string
  followers: number; niche: string; contact: string; notes: string
}
export interface KolBudget { id: string; brand: string; name: string; nominal: number }
export interface KolCampaign {
  id: string; brand: string; name: string; budgetId: string | null
  periodStart: string | null; periodEnd: string | null; description: string; status: 'active' | 'ended'
}
export interface KolContent {
  id: string; brand: string; campaignId: string | null; influencerId: string | null
  platform: string; product: string; task: string; objective: Tier; contentUrl: string
  status: 'uploaded' | 'broken' | 'pending'; fee: number
  likes: number; comments: number; saved: number; shares: number; views: number
  metricsSource: 'api' | 'manual'; metricsFetchedAt: string | null; postedAt: string | null
}

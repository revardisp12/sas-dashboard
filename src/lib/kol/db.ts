import { supabase } from '@/lib/supabase'
import type { KolInfluencer, KolBudget, KolCampaign, KolContent, Tier } from './types'

type Row = Record<string, unknown>
const s = (v: unknown) => (v == null ? '' : String(v))
const n = (v: unknown) => Number(v ?? 0)

// NOTE: kol_* tables are not yet in database.types.ts (added in Task 10 types regen).
// Casts are confined here and will be removed when types are regenerated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (table: string) => (supabase as any).from(table)

// ── content ──
export function rowToContent(r: Row): KolContent {
  return {
    id: s(r.id), brand: s(r.brand), campaignId: r.campaign_id ? s(r.campaign_id) : null,
    influencerId: r.influencer_id ? s(r.influencer_id) : null, platform: s(r.platform),
    product: s(r.product), task: s(r.task), objective: (s(r.funnel_objective) || 'awareness') as Tier,
    contentUrl: s(r.content_url), status: (s(r.status) || 'pending') as KolContent['status'], fee: n(r.fee),
    likes: n(r.likes), comments: n(r.comments), saved: n(r.saved), shares: n(r.shares), views: n(r.video_views),
    metricsSource: (s(r.metrics_source) || 'manual') as 'api' | 'manual',
    metricsFetchedAt: r.metrics_fetched_at ? s(r.metrics_fetched_at) : null,
    postedAt: r.posted_at ? s(r.posted_at) : null,
  }
}
export function contentToRow(c: Partial<KolContent>, brand: string) {
  return {
    brand, campaign_id: c.campaignId ?? null, influencer_id: c.influencerId ?? null, platform: c.platform,
    product: c.product, task: c.task, funnel_objective: c.objective ?? 'awareness', content_url: c.contentUrl,
    status: c.status ?? 'pending', fee: c.fee ?? 0, likes: c.likes ?? 0, comments: c.comments ?? 0,
    saved: c.saved ?? 0, shares: c.shares ?? 0, video_views: c.views ?? 0,
    metrics_source: c.metricsSource ?? 'manual', metrics_fetched_at: c.metricsFetchedAt ?? null,
    posted_at: c.postedAt ?? null,
  }
}
export async function getContents(brand: string, campaignId?: string): Promise<KolContent[]> {
  let q = db('kol_contents').select('*').eq('brand', brand)
  if (campaignId) q = q.eq('campaign_id', campaignId)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r: Row) => rowToContent(r))
}
export async function upsertContent(c: Partial<KolContent> & { id?: string }, brand: string): Promise<void> {
  const payload = contentToRow(c, brand)
  const { error } = c.id
    ? await db('kol_contents').update(payload).eq('id', c.id)
    : await db('kol_contents').insert(payload)
  if (error) throw error
}
export async function deleteContent(id: string): Promise<void> {
  const { error } = await db('kol_contents').delete().eq('id', id)
  if (error) throw error
}
export async function bulkInsertContents(rows: Partial<KolContent>[], brand: string): Promise<void> {
  if (!rows.length) return
  const { error } = await db('kol_contents').insert(rows.map(r => contentToRow(r, brand)))
  if (error) throw error
}

// ── influencer ──
export function rowToInfluencer(r: Row): KolInfluencer {
  return { id: s(r.id), brand: s(r.brand), name: s(r.name), username: s(r.username), platform: s(r.platform),
    followers: n(r.followers), niche: s(r.niche), contact: s(r.contact), notes: s(r.notes) }
}
export function influencerToRow(i: Partial<KolInfluencer>, brand: string) {
  return { brand, name: i.name, username: i.username, platform: i.platform, followers: i.followers ?? 0,
    niche: i.niche, contact: i.contact, notes: i.notes }
}
export async function getInfluencers(brand: string): Promise<KolInfluencer[]> {
  const { data, error } = await db('kol_influencers').select('*').eq('brand', brand).order('name')
  if (error) throw error
  return (data ?? []).map((r: Row) => rowToInfluencer(r))
}
export async function upsertInfluencer(i: Partial<KolInfluencer> & { id?: string }, brand: string): Promise<void> {
  const payload = influencerToRow(i, brand)
  const { error } = i.id
    ? await db('kol_influencers').update(payload).eq('id', i.id)
    : await db('kol_influencers').insert(payload)
  if (error) throw error
}
export async function deleteInfluencer(id: string): Promise<void> {
  const { error } = await db('kol_influencers').delete().eq('id', id)
  if (error) throw error
}
export async function bulkInsertInfluencers(rows: Partial<KolInfluencer>[], brand: string): Promise<void> {
  if (!rows.length) return
  const { error } = await db('kol_influencers').insert(rows.map(r => influencerToRow(r, brand)))
  if (error) throw error
}

// ── budget ──
export function rowToBudget(r: Row): KolBudget {
  return { id: s(r.id), brand: s(r.brand), name: s(r.name), nominal: n(r.nominal) }
}
export function budgetToRow(b: Partial<KolBudget>, brand: string) {
  return { brand, name: b.name, nominal: b.nominal ?? 0 }
}
export async function getBudgets(brand: string): Promise<KolBudget[]> {
  const { data, error } = await db('kol_budgets').select('*').eq('brand', brand).order('name')
  if (error) throw error
  return (data ?? []).map((r: Row) => rowToBudget(r))
}
export async function upsertBudget(b: Partial<KolBudget> & { id?: string }, brand: string): Promise<void> {
  const payload = budgetToRow(b, brand)
  const { error } = b.id
    ? await db('kol_budgets').update(payload).eq('id', b.id)
    : await db('kol_budgets').insert(payload)
  if (error) throw error
}
export async function deleteBudget(id: string): Promise<void> {
  const { error } = await db('kol_budgets').delete().eq('id', id)
  if (error) throw error
}

// ── campaign ──
export function rowToCampaign(r: Row): KolCampaign {
  return {
    id: s(r.id), brand: s(r.brand), name: s(r.name),
    budgetId: r.budget_id ? s(r.budget_id) : null,
    periodStart: r.period_start ? s(r.period_start) : null,
    periodEnd: r.period_end ? s(r.period_end) : null,
    description: s(r.description),
    status: (s(r.status) || 'active') as KolCampaign['status'],
  }
}
export function campaignToRow(c: Partial<KolCampaign>, brand: string) {
  return {
    brand, name: c.name, budget_id: c.budgetId ?? null,
    period_start: c.periodStart ?? null, period_end: c.periodEnd ?? null,
    description: c.description, status: c.status ?? 'active',
  }
}
export async function getCampaigns(brand: string): Promise<KolCampaign[]> {
  const { data, error } = await db('kol_campaigns').select('*').eq('brand', brand).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r: Row) => rowToCampaign(r))
}
export async function upsertCampaign(c: Partial<KolCampaign> & { id?: string }, brand: string): Promise<void> {
  const payload = campaignToRow(c, brand)
  const { error } = c.id
    ? await db('kol_campaigns').update(payload).eq('id', c.id)
    : await db('kol_campaigns').insert(payload)
  if (error) throw error
}
export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await db('kol_campaigns').delete().eq('id', id)
  if (error) throw error
}

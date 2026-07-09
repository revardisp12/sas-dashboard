import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getKolMetricsProvider } from '@/lib/kol/metrics/provider'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BRANDS = ['reglow', 'amura', 'purela']

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // No-op in manual mode — activates automatically once KOL_METRICS_ENABLED=live.
  if ((process.env.KOL_METRICS_ENABLED ?? 'manual') !== 'live') {
    return NextResponse.json({ skipped: true, reason: 'manual mode' }, { status: 200 })
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return NextResponse.json({ error: 'Missing env' }, { status: 500 })
  const supabase = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const provider = getKolMetricsProvider()
  try {
    let updated = 0
    for (const brand of BRANDS) {
      // active campaigns for this brand
      const { data: camps, error: cErr } = await supabase.from('kol_campaigns').select('id').eq('brand', brand).eq('status', 'active')
      if (cErr) throw new Error(cErr.message)
      const campIds = (camps ?? []).map(c => c.id)
      if (!campIds.length) continue
      const { data: contents, error: coErr } = await supabase.from('kol_contents').select('id, content_url, platform').eq('brand', brand).in('campaign_id', campIds)
      if (coErr) throw new Error(coErr.message)
      for (const c of contents ?? []) {
        if (!c.content_url) continue
        const m = await provider.fetch(c.content_url, c.platform ?? '')
        if (!m) continue
        // saved/shares only included when the provider actually supplied them (see
        // FetchedMetrics doc comment) — omitting the key here leaves the existing
        // manually-entered value alone instead of clobbering it to 0.
        const { error: uErr } = await supabase.from('kol_contents').update({
          likes: m.likes, comments: m.comments, video_views: m.views,
          metrics_source: 'api', metrics_fetched_at: new Date().toISOString(),
          ...(m.saved !== undefined ? { saved: m.saved } : {}),
          ...(m.shares !== undefined ? { shares: m.shares } : {}),
        }).eq('id', c.id)
        if (uErr) throw new Error(uErr.message)
        updated++
      }
    }
    return NextResponse.json({ updated }, { status: 200 })
  } catch (e) {
    console.error('[cron/kol-metrics-refresh]', e)
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 })
  }
}

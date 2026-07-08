import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import type { Brand } from '@/lib/types'
import { getWmsAdapter } from '@/lib/wms/adapter'
import { runWmsSync } from '@/lib/wms/sync'
import { dbPort, logPort } from '@/lib/wms/serverPorts'
import type { WmsTable } from '@/lib/wms/types'
import { daysAgoWIB } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // live sync paginates thousands of orders across 3 brands

const BRANDS: Brand[] = ['reglow', 'amura', 'purela']
const MAX_RANGE_DAYS_BY_BRAND: Record<Brand, number> = { reglow: 31, amura: 31, purela: 10 }
// Revenue scope: marketplace + CS Soscom (sales), repeat customers (crm), product catalog.
const TABLES: WmsTable[] = ['sales', 'products', 'crm']

// The business runs in WIB (Asia/Jakarta); anchor "today" there, not the server's UTC clock,
// so a cron/manual sync run between 00:00-06:59 WIB still pulls the correct WIB calendar day.
function lastNDays(n: number) {
  return { start: daysAgoWIB(n), end: daysAgoWIB(0) }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const jwt = auth.slice(7).trim()
  if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anonKey || !serviceKey) return NextResponse.json({ error: 'Missing env' }, { status: 500 })

  const userClient = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await userClient.from('user_profiles').select('role, brand').eq('id', userData.user.id).single()
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Optional brand scope + date range from the dashboard popover.
  const body = (await req.json().catch(() => null)) as { brand?: string; start?: string; end?: string } | null

  // Non-super admins are scoped to their own brand — reject a request for a different brand
  // rather than silently redirecting it (this previously let ANY admin sync/overwrite another
  // brand's data via service_role). super_admin may target any brand, or omit it to sync all three.
  let brands: Brand[]
  if (profile.role === 'admin') {
    if (body?.brand && body.brand !== profile.brand) {
      return NextResponse.json({ error: 'Anda hanya bisa sync brand Anda sendiri' }, { status: 403 })
    }
    if (!profile.brand || !(BRANDS as string[]).includes(profile.brand)) {
      return NextResponse.json({ error: 'Akun admin tidak memiliki brand yang valid' }, { status: 403 })
    }
    brands = [profile.brand as Brand]
  } else {
    brands = body?.brand && (BRANDS as string[]).includes(body.brand) ? [body.brand as Brand] : BRANDS
  }

  // Purela's volume (~5.8k orders/day, ~14x Reglow/Amura) makes a 31-day pull realistically
  // take several minutes against Vercel's 300s function timeout — cap it tighter so a manual
  // pull can't run out the clock mid-sync. When multiple brands are targeted, the tightest
  // cap among them applies.
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  const maxRangeDays = Math.min(...brands.map(b => MAX_RANGE_DAYS_BY_BRAND[b]))
  let range = lastNDays(1)
  if (body?.start && body?.end && dateRe.test(body.start) && dateRe.test(body.end)) {
    if (body.end < body.start) {
      return NextResponse.json({ error: 'end_date sebelum start_date' }, { status: 400 })
    }
    const days = Math.round((Date.parse(body.end) - Date.parse(body.start)) / 86_400_000)
    if (days > maxRangeDays) {
      // Note: when brands.length > 1 (super_admin syncing all three), this is the tightest
      // cap among them (currently Purela's), not necessarily every targeted brand's own limit.
      return NextResponse.json({ error: `Maksimal ${maxRangeDays} hari per tarikan` }, { status: 400 })
    }
    range = { start: body.start, end: body.end }
  }

  const service = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const result = await runWmsSync({
      adapter: getWmsAdapter(),
      db: dbPort(service), log: logPort(service),
      opts: { brands, tables: TABLES, range, trigger: 'manual', triggeredBy: userData.user.email ?? undefined },
    })

    // Best-effort: record the pulled range for the dashboard's duplicate-pull guard.
    // A failure here must not fail the sync itself (the sync already succeeded) — but it
    // should be visible in server logs, since a silently-broken insert here means the
    // duplicate-pull guard silently stops working with no signal anywhere.
    if (brands.length === 1 && body?.start && body?.end && result.status !== 'failed') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: pullLogErr } = await (service as any).from('wms_pull_log').insert({
        brand: brands[0], range_start: range.start, range_end: range.end, rows: result.tables?.sales ?? 0,
      })
      if (pullLogErr) console.error('[wms/sync] wms_pull_log insert failed:', pullLogErr.message)
    }

    const code = result.status === 'success' ? 200 : result.status === 'failed' ? 500 : 207
    return NextResponse.json(result, { status: code })
  } catch (e) {
    console.error('[wms/sync]', e)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}

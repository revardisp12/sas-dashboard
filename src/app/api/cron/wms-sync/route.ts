import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import type { Brand } from '@/lib/types'
import { getWmsAdapter } from '@/lib/wms/adapter'
import { runWmsSync } from '@/lib/wms/sync'
import { dbPort, logPort } from '@/lib/wms/serverPorts'
import type { WmsTable } from '@/lib/wms/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BRANDS: Brand[] = ['reglow', 'amura', 'purela']
const TABLES: WmsTable[] = ['sales', 'crm', 'products', 'google_ads', 'meta_ads']

function lastNDays(n: number) {
  const end = new Date()
  const start = new Date(); start.setUTCDate(start.getUTCDate() - n)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // The unattended hourly cron must not write mock data into production tables.
  // It activates automatically once WMS_SYNC_ENABLED=live. Manual Sync Now + webhook
  // still run in mock mode for on-demand testing.
  if ((process.env.WMS_SYNC_ENABLED ?? 'mock') !== 'live') {
    return NextResponse.json({ skipped: true, reason: 'WMS_SYNC_ENABLED is not live; cron no-op in mock mode' }, { status: 200 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return NextResponse.json({ error: 'Missing env' }, { status: 500 })

  const supabase = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const result = await runWmsSync({
      adapter: getWmsAdapter(),
      db: dbPort(supabase), log: logPort(supabase),
      opts: { brands: BRANDS, tables: TABLES, range: lastNDays(7), trigger: 'cron' },
    })
    const code = result.status === 'success' ? 200 : result.status === 'failed' ? 500 : 207
    return NextResponse.json(result, { status: code })
  } catch (e) {
    console.error('[cron/wms-sync]', e)
    return NextResponse.json({ error: 'Sync failed', detail: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

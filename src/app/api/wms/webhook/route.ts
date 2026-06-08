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

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-wms-signature')
  if (!process.env.WMS_WEBHOOK_SECRET || secret !== process.env.WMS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return NextResponse.json({ error: 'Missing env' }, { status: 500 })

  const today = new Date().toISOString().slice(0, 10)
  const supabase = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const result = await runWmsSync({
      adapter: getWmsAdapter(),
      db: dbPort(supabase), log: logPort(supabase),
      opts: { brands: BRANDS, tables: TABLES, range: { start: today, end: today }, trigger: 'webhook' },
    })
    const code = result.status === 'success' ? 200 : result.status === 'failed' ? 500 : 207
    return NextResponse.json(result, { status: code })
  } catch (e) {
    console.error('[wms/webhook]', e)
    return NextResponse.json({ error: 'Sync failed', detail: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

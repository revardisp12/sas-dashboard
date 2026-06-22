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
export const maxDuration = 300 // live sync paginates thousands of orders across 3 brands

const BRANDS: Brand[] = ['reglow', 'amura', 'purela']
// V1.2 scope = revenue only. CRM + ads deferred; reseller endpoint has a backend bug.
const TABLES: WmsTable[] = ['sales', 'products']

function lastNDays(n: number) {
  const end = new Date(); const start = new Date(); start.setUTCDate(start.getUTCDate() - n)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
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

  const { data: profile } = await userClient.from('user_profiles').select('role').eq('id', userData.user.id).single()
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const result = await runWmsSync({
      adapter: getWmsAdapter(),
      db: dbPort(service), log: logPort(service),
      opts: { brands: BRANDS, tables: TABLES, range: lastNDays(1), trigger: 'manual', triggeredBy: userData.user.email ?? undefined },
    })
    const code = result.status === 'success' ? 200 : result.status === 'failed' ? 500 : 207
    return NextResponse.json(result, { status: code })
  } catch (e) {
    console.error('[wms/sync]', e)
    return NextResponse.json({ error: 'Sync failed', detail: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

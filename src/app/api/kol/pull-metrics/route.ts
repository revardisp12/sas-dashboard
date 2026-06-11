import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getKolMetricsProvider } from '@/lib/kol/metrics/provider'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const jwt = auth.slice(7).trim()
  if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return NextResponse.json({ error: 'Missing env' }, { status: 500 })

  const supabase = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profErr } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  if (profErr) return NextResponse.json({ error: 'Profile lookup failed', detail: profErr.message }, { status: 500 })
  if (!profile || !(['super_admin', 'admin', 'kol_specialist'] as string[]).includes(profile.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = (await req.json()) as { url?: string; platform?: string }
    if (!body.url) return NextResponse.json({ metrics: null }, { status: 200 })
    const metrics = await getKolMetricsProvider().fetch(body.url, body.platform ?? '')
    return NextResponse.json({ metrics }, { status: 200 })
  } catch (e) {
    return NextResponse.json(
      { error: 'Pull failed', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}

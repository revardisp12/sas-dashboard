import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getKolMetricsProvider } from '@/lib/kol/metrics/provider'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Content URLs are expected to be public social-platform links (see KontenTab's placeholder
// text). Both metrics providers today are no-ops (ManualProvider) or unimplemented
// (RapidApiProvider throws), so there is no live outbound fetch yet — but validating here,
// at the API boundary, means whichever provider implementation lands later inherits this
// guard automatically instead of depending on that implementation remembering it.
const ALLOWED_HOSTS = [
  'tiktok.com', 'www.tiktok.com', 'vt.tiktok.com',
  'instagram.com', 'www.instagram.com',
  'youtube.com', 'www.youtube.com', 'youtu.be',
]
function isAllowedContentUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:') return false
    return ALLOWED_HOSTS.includes(u.hostname.toLowerCase())
  } catch {
    return false
  }
}

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

  if (profErr) {
    console.error('[kol/pull-metrics] profile lookup failed:', profErr.message)
    return NextResponse.json({ error: 'Profile lookup failed' }, { status: 500 })
  }
  if (!profile || !(['super_admin', 'admin', 'kol_specialist'] as string[]).includes(profile.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = (await req.json()) as { url?: string; platform?: string }
    if (!body.url) return NextResponse.json({ metrics: null }, { status: 200 })
    if (!isAllowedContentUrl(body.url)) {
      return NextResponse.json({ error: 'URL harus link TikTok/Instagram/YouTube yang valid' }, { status: 400 })
    }
    const metrics = await getKolMetricsProvider().fetch(body.url, body.platform ?? '')
    return NextResponse.json({ metrics }, { status: 200 })
  } catch (e) {
    console.error('[kol/pull-metrics]', e)
    return NextResponse.json({ error: 'Pull failed' }, { status: 500 })
  }
}

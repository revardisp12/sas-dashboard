import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import type { Database } from '@/lib/database.types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALL_ROLES = ['super_admin', 'admin', 'manager', 'cs', 'crm', 'kol_specialist'] as const
const ADMIN_CREATABLE_ROLES = ['manager', 'cs', 'crm'] as const // what a (non-super) admin may create
const BRANDS = ['reglow', 'amura', 'purela'] as const
type Role = (typeof ALL_ROLES)[number]

// Strong, shareable temp password — unambiguous charset (no O/0/I/l), ~95 bits entropy.
function genPassword(len = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%*'
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length]
  return out
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const jwt = authHeader.slice(7).trim()
  if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anonKey || !serviceKey) return NextResponse.json({ error: 'Missing env' }, { status: 500 })

  // Identify the caller from their session token (never trust a client-sent role).
  const userClient = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: caller } = await userClient.from('user_profiles').select('role, brand').eq('id', userData.user.id).single()
  if (!caller || !['super_admin', 'admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as { full_name?: string; email?: string; role?: string; brand?: string | null } | null
  const full_name = (body?.full_name ?? '').trim()
  const email = (body?.email ?? '').trim().toLowerCase()
  const role = body?.role as Role
  let brand = (body?.brand ?? null) as string | null

  // Validation
  if (!full_name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 })
  if (full_name.length > 200) return NextResponse.json({ error: 'Nama terlalu panjang' }, { status: 400 })
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'Email tidak valid' }, { status: 400 })
  if (!ALL_ROLES.includes(role)) return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 })

  // Scoping — mirrors admin_update_user_profile (anti privilege-escalation).
  if (caller.role === 'admin') {
    if (!(ADMIN_CREATABLE_ROLES as readonly string[]).includes(role)) {
      return NextResponse.json({ error: 'Admin hanya bisa membuat Manager/CS/CRM' }, { status: 403 })
    }
    brand = caller.brand // force to the admin's own brand; ignore any client-sent brand
  }

  // Brand invariant: super_admin has no brand; everyone else needs a valid one.
  if (role === 'super_admin') brand = null
  else if (!brand || !(BRANDS as readonly string[]).includes(brand)) {
    return NextResponse.json({ error: 'Brand wajib dipilih' }, { status: 400 })
  }

  const service = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // 1) Create the auth user (email pre-confirmed so they can log in immediately).
  const password = genPassword()
  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name },
  })
  if (createErr || !created?.user) {
    const dup = /already.*registered|exists/i.test(createErr?.message ?? '')
    return NextResponse.json({ error: dup ? 'Email sudah terdaftar' : (createErr?.message ?? 'Gagal membuat akun') }, { status: 400 })
  }

  // 2) Set role/brand/name. The signup trigger inserts a default profile (role 'cs');
  //    upsert overwrites it so the result is correct regardless of trigger timing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profErr } = await (service as any)
    .from('user_profiles')
    .upsert({ id: created.user.id, full_name, role, brand }, { onConflict: 'id' })

  if (profErr) {
    return NextResponse.json(
      { error: `Akun dibuat tapi gagal set role (${profErr.message}). Edit role manual di tabel.`, email, password },
      { status: 207 },
    )
  }

  return NextResponse.json({ email, password, role, brand, full_name }, { status: 201 })
}

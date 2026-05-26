import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const MAX_MESSAGES = 20
const MAX_TOTAL_CHARS = 8000

const SYSTEM_PROMPT = `Kamu adalah AI Support Assistant untuk SAS Dashboard — platform marketing analytics untuk brand skincare (Reglow Skincare, Amura, dan Purela).

Dashboard ini punya fitur:
- Overview: KPI cards, paid traffic, organic, CRM snapshot, product snapshot
- Funnel Analysis: tracking konversi dari ads sampai pembelian
- Product Analysis: fast/slow moving indicator, RFM per produk
- Paid Traffic: Google Ads, Meta Ads, TikTok Shop, Shopee
- Organic: Instagram, TikTok Organic, Facebook Organic
- Sales Data: Acquisition by CS (data penjualan), Retention by CRM (RFM analysis)
- Settings: Product Master (SKU, harga, COGS), Bundle Master (paket produk)

Data disimpan di Supabase (cloud DB).

Tugasmu:
1. Bantu user diagnosa masalah/bug yang mereka temui
2. Jelaskan cara penggunaan fitur
3. Kasih solusi yang actionable dan spesifik
4. Kalau itu bug nyata (bukan user error), akui dan catat dengan jelas

Jawab dalam Bahasa Indonesia, singkat dan langsung ke inti. Maksimal 3-4 kalimat per respons kecuali perlu penjelasan panjang. Jangan terlalu formal.`

const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function badInput(reason: string) {
  return NextResponse.json({ error: `Invalid input: ${reason}` }, { status: 400 })
}

export async function POST(req: NextRequest) {
  try {
    if (!anthropic) {
      console.error('[/api/chat] ANTHROPIC_API_KEY not configured')
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return unauthorized()
    const jwt = authHeader.slice('Bearer '.length).trim()
    if (!jwt) return unauthorized()

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) return unauthorized()

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return badInput('not valid JSON')
    }
    if (!body || typeof body !== 'object') return badInput('body must be an object')
    const { messages, context } = body as {
      messages?: { role?: string; content?: string }[]
      context?: unknown
    }
    if (!Array.isArray(messages) || messages.length === 0) return badInput('messages required')
    if (messages.length > MAX_MESSAGES) return badInput(`max ${MAX_MESSAGES} messages`)
    let totalChars = 0
    for (const m of messages) {
      if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
        return badInput('each message needs role (user|assistant) and string content')
      }
      totalChars += m.content.length
      if (totalChars > MAX_TOTAL_CHARS) return badInput(`max ${MAX_TOTAL_CHARS} total chars`)
    }
    if (!context || typeof context !== 'object') return badInput('context required')
    const ctx = context as {
      currentView?: unknown
      brand?: unknown
      timeframe?: unknown
      hasData?: unknown
      productCount?: unknown
      bundleCount?: unknown
    }
    if (typeof ctx.currentView !== 'string') return badInput('context.currentView must be string')
    if (typeof ctx.brand !== 'string') return badInput('context.brand must be string')
    if (typeof ctx.timeframe !== 'string' && typeof ctx.timeframe !== 'number') {
      return badInput('context.timeframe must be string or number')
    }
    if (!ctx.hasData || typeof ctx.hasData !== 'object') return badInput('context.hasData must be object')
    if (typeof ctx.productCount !== 'number') return badInput('context.productCount must be number')
    if (typeof ctx.bundleCount !== 'number') return badInput('context.bundleCount must be number')

    const { data: rlRows, error: rlErr } = await supabase.rpc('check_chat_rate_limit')
    if (rlErr) {
      console.error('[/api/chat] rate limit RPC error:', rlErr.message)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
    const rl = Array.isArray(rlRows) ? rlRows[0] : rlRows
    if (!rl || typeof rl.allowed !== 'boolean') {
      console.error('[/api/chat] rate limit RPC returned malformed result')
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
    if (!rl.allowed) {
      const resetAt = rl.reset_at as string
      const secondsUntilReset = Math.max(1, Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000))
      return NextResponse.json(
        { error: 'Rate limit exceeded', resetAt },
        {
          status: 429,
          headers: {
            'Retry-After': String(secondsUntilReset),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetAt,
          },
        },
      )
    }

    const hasDataKeys = Object.entries(ctx.hasData as Record<string, unknown>)
      .filter(([, v]) => Boolean(v))
      .map(([k]) => k)
      .join(', ') || 'belum ada data'

    const contextBlock = `[Konteks saat ini]
- View aktif: ${ctx.currentView}
- Brand: ${ctx.brand}
- Timeframe: ${ctx.timeframe}
- Data tersedia: ${hasDataKeys}
- Product Master: ${ctx.productCount} produk
- Bundle Master: ${ctx.bundleCount} bundle`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      system: `${SYSTEM_PROMPT}\n\n${contextBlock}`,
      messages: messages as { role: 'user' | 'assistant'; content: string }[],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    return NextResponse.json(
      { reply: text },
      { headers: { 'X-RateLimit-Remaining': String(rl.remaining) } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/chat]', message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

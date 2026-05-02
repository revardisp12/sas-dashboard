import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `Kamu adalah AI Support Assistant untuk SAS Dashboard — platform marketing analytics untuk brand skincare (Reglow Skincare & Amura).

Dashboard ini punya fitur:
- Overview: KPI cards, paid traffic, organic, CRM snapshot, product snapshot
- Funnel Analysis: tracking konversi dari ads sampai pembelian
- Product Analysis: fast/slow moving indicator, RFM per produk
- Paid Traffic: Google Ads, Meta Ads, TikTok Shop, Shopee
- Organic: Instagram, TikTok Organic
- Sales Data: Acquisition by CS (data penjualan), Retention by CRM (RFM analysis)
- Settings: Product Master (SKU, harga, COGS), Bundle Master (paket produk)

Semua data disimpan di localStorage browser (bukan database server).

Tugasmu:
1. Bantu user diagnosa masalah/bug yang mereka temui
2. Jelaskan cara penggunaan fitur
3. Kasih solusi yang actionable dan spesifik
4. Kalau itu bug nyata (bukan user error), akui dan catat dengan jelas

Jawab dalam Bahasa Indonesia, singkat dan langsung ke inti. Maksimal 3-4 kalimat per respons kecuali perlu penjelasan panjang. Jangan terlalu formal.`

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const body = await req.json()
    const { messages, context } = body as {
      messages: { role: 'user' | 'assistant'; content: string }[]
      context: {
        currentView: string
        brand: string
        timeframe: string | number
        hasData: Record<string, boolean>
        productCount: number
        bundleCount: number
      }
    }

    if (!messages?.length) {
      return NextResponse.json({ error: 'No messages' }, { status: 400 })
    }

    const contextBlock = `[Konteks saat ini]
- View aktif: ${context.currentView}
- Brand: ${context.brand}
- Timeframe: ${context.timeframe}
- Data tersedia: ${Object.entries(context.hasData).filter(([, v]) => v).map(([k]) => k).join(', ') || 'belum ada data'}
- Product Master: ${context.productCount} produk
- Bundle Master: ${context.bundleCount} bundle`

    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      system: `${SYSTEM_PROMPT}\n\n${contextBlock}`,
      messages,
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ reply: text })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/chat]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

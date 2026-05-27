import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { supabase } from '@/lib/supabase'
import type { Brand } from '@/lib/types'
import type { DigestPayload } from '@/lib/digest/types'
import { formatDigestText } from '@/lib/digest/format'
import CopyButton from './CopyButton'
import RegenerateButton from './RegenerateButton'

const BRANDS = new Set<Brand>(['reglow', 'amura', 'purela'])

export default async function DigestPage({ params }: { params: Promise<{ brand: string }> }) {
  const { brand: brandParam } = await params
  if (!BRANDS.has(brandParam as Brand)) notFound()
  const brand = brandParam as Brand

  const { data, error } = await supabase
    .from('digest_log')
    .select('*')
    .eq('brand', brand)
    .order('week_start', { ascending: false })
    .limit(1)
    .single()

  // Get the origin for the dashboard URL embedded in the digest text
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const host = h.get('host') ?? 'localhost:3000'
  const origin = `${proto}://${host}`

  if (error || !data) {
    return (
      <div className="p-8">
        <h1 className="text-lg font-bold capitalize" style={{ color: '#111827' }}>{brand} Weekly Digest</h1>
        <p className="text-sm mt-2" style={{ color: '#6B7280' }}>
          Belum ada digest untuk brand ini. Klik Generate Now untuk membuat digest minggu lalu.
        </p>
        <RegenerateButton brand={brand} />
      </div>
    )
  }

  const payload = data.payload as unknown as DigestPayload
  const text = formatDigestText(payload, origin)

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-lg font-bold capitalize" style={{ color: '#111827' }}>{brand} Weekly Digest</h1>
          <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
            Week {payload.weekNumber} ({payload.weekStart} to {payload.weekEnd})
            <span className="ml-2">· Generated {new Date(payload.generatedAt).toLocaleString('id-ID')}</span>
          </p>
        </div>
        <RegenerateButton brand={brand} />
      </div>

      <div className="rounded-2xl p-5 mb-3" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
        <pre className="whitespace-pre-wrap text-sm font-mono" style={{ color: '#111827' }}>{text}</pre>
      </div>

      <CopyButton text={text} />
    </div>
  )
}

'use client'
import { use, useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Brand } from '@/lib/types'
import type { DigestPayload } from '@/lib/digest/types'
import { formatDigestText } from '@/lib/digest/format'
import CopyButton from './CopyButton'
import RegenerateButton from './RegenerateButton'

const BRANDS = new Set<Brand>(['reglow', 'amura', 'purela'])

interface DigestRow {
  brand: string
  week_start: string
  week_end: string
  payload: unknown
  generated_at: string
}

export default function DigestPage({ params }: { params: Promise<{ brand: string }> }) {
  const { brand: brandParam } = use(params)
  if (!BRANDS.has(brandParam as Brand)) notFound()
  const brand = brandParam as Brand

  const { profile, loading: authLoading } = useAuth()
  const [row, setRow] = useState<DigestRow | null>(null)
  const [fetching, setFetching] = useState(true)
  const [origin, setOrigin] = useState('http://localhost:3000')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setFetching(true)
      const { data } = await supabase
        .from('digest_log')
        .select('*')
        .eq('brand', brand)
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!cancelled) {
        setRow(data as DigestRow | null)
        setFetching(false)
      }
    }
    if (profile) load()
    return () => { cancelled = true }
  }, [brand, profile, refreshKey])

  // Loading state while auth resolves
  if (authLoading || !profile) {
    return <div className="p-8 text-sm" style={{ color: '#6B7280' }}>Memuat...</div>
  }

  // Brand isolation: non-super_admin must have brand matching the URL
  const canAccessBrand = profile.role === 'super_admin' || profile.brand === brand
  if (!canAccessBrand) {
    return (
      <div className="p-8 max-w-md">
        <h1 className="text-lg font-bold" style={{ color: '#991B1B' }}>Akses ditolak</h1>
        <p className="text-sm mt-2" style={{ color: '#4B5563' }}>
          Lo gak punya akses ke digest brand <span className="capitalize font-semibold">{brand}</span>.
          {profile.brand && (
            <> Brand lo: <span className="capitalize font-semibold">{profile.brand}</span>.</>
          )}
        </p>
      </div>
    )
  }

  // Role gate: only super_admin / admin / manager can use the digest page
  const allowedRoles = new Set(['super_admin', 'admin', 'manager'])
  if (!allowedRoles.has(profile.role)) {
    return (
      <div className="p-8 max-w-md">
        <h1 className="text-lg font-bold" style={{ color: '#991B1B' }}>Akses ditolak</h1>
        <p className="text-sm mt-2" style={{ color: '#4B5563' }}>
          Role lo (<span className="font-semibold">{profile.role}</span>) gak punya akses ke Weekly Digest.
        </p>
      </div>
    )
  }

  if (fetching) {
    return <div className="p-8 text-sm" style={{ color: '#6B7280' }}>Memuat digest...</div>
  }

  if (!row) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h1 className="text-lg font-bold capitalize" style={{ color: '#111827' }}>{brand} Weekly Digest</h1>
          <RegenerateButton brand={brand} onSuccess={() => setRefreshKey(k => k + 1)} />
        </div>
        <p className="text-sm" style={{ color: '#6B7280' }}>
          Belum ada digest untuk brand ini. Klik Generate Now untuk membuat digest minggu lalu.
        </p>
      </div>
    )
  }

  const payload = row.payload as DigestPayload
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
        <RegenerateButton brand={brand} onSuccess={() => setRefreshKey(k => k + 1)} />
      </div>

      <div className="rounded-2xl p-5 mb-3" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
        <pre className="whitespace-pre-wrap text-sm font-mono" style={{ color: '#111827' }}>{text}</pre>
      </div>

      <CopyButton text={text} />
    </div>
  )
}

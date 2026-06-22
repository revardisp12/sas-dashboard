'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Brand } from '@/lib/types'

const LABELS: Record<Brand, string> = { reglow: 'Reglow', amura: 'Amura', purela: 'Purela' }

/**
 * Compact top-bar button that syncs WMS data for ONLY the brand currently in view.
 * Scoping to one brand keeps it fast (Purela alone is ~5.8k orders/day); the hourly
 * cron still refreshes all brands in the background.
 */
export default function BrandSyncButton({
  brand,
  onResult,
}: {
  brand: Brand
  onResult?: (r: { ok: boolean; text: string }) => void
}) {
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        onResult?.({ ok: false, text: 'Sesi habis, login ulang.' })
        return
      }
      const res = await fetch('/api/wms/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        const n = json?.tables?.sales ?? 0
        onResult?.({ ok: true, text: `Sync ${LABELS[brand]} selesai — ${n} sales` })
      } else {
        onResult?.({ ok: false, text: `Sync gagal: ${json?.error ?? res.status}` })
      }
    } catch (e) {
      onResult?.({ ok: false, text: `Error: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={run}
      disabled={busy}
      title={`Tarik data WMS terbaru untuk ${LABELS[brand]}`}
      className="text-[11px] font-medium px-2.5 py-1 rounded-md transition-opacity"
      style={{
        border: '1px solid #E5E7EB',
        background: '#fff',
        color: '#4A9FD4',
        cursor: busy ? 'default' : 'pointer',
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? `Sync ${LABELS[brand]}…` : `↻ Sync ${LABELS[brand]}`}
    </button>
  )
}

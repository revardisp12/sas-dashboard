'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Brand } from '@/lib/types'

const LABELS: Record<Brand, string> = { reglow: 'Reglow', amura: 'Amura', purela: 'Purela' }
const iso = (d: Date) => d.toISOString().slice(0, 10)
function preset(kind: 'today' | 'yesterday' | 'last7'): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  if (kind === 'yesterday') { start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1) }
  if (kind === 'last7') start.setDate(start.getDate() - 6)
  return { start: iso(start), end: iso(end) }
}

export default function BrandSyncButton({ brand, onResult }: { brand: Brand; onResult?: (r: { ok: boolean; text: string }) => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [start, setStart] = useState(preset('today').start)
  const [end, setEnd] = useState(preset('today').end)

  async function run(range: { start: string; end: string }) {
    setBusy(true); setOpen(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { onResult?.({ ok: false, text: 'Sesi habis, login ulang.' }); return }
      const res = await fetch('/api/wms/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, ...range }),
      })
      const json = await res.json().catch(() => ({}))
      onResult?.(res.ok
        ? { ok: true, text: `Sync ${LABELS[brand]} selesai — ${json?.tables?.sales ?? 0} sales` }
        : { ok: false, text: `Sync gagal: ${json?.error ?? res.status}` })
    } catch (e) {
      onResult?.({ ok: false, text: `Error: ${e instanceof Error ? e.message : String(e)}` })
    } finally { setBusy(false) }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} disabled={busy}
        className="text-[11px] font-medium px-2.5 py-1 rounded-md"
        style={{ border: '1px solid #E5E7EB', background: '#fff', color: '#4A9FD4', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
        {busy ? `Sync ${LABELS[brand]}…` : `↻ Sync ${LABELS[brand]}`}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 50, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 12, width: 240, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>Tarik data WMS — {LABELS[brand]}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button onClick={() => run(preset('today'))} style={presetStyle}>Hari ini</button>
            <button onClick={() => run(preset('yesterday'))} style={presetStyle}>Kemarin</button>
            <button onClick={() => run(preset('last7'))} style={presetStyle}>7 hari terakhir</button>
          </div>
          <div style={{ borderTop: '1px solid #F3F4F6', marginTop: 8, paddingTop: 8 }}>
            <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 4 }}>Custom (maks 7 hari)</p>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="date" value={start} onChange={e => setStart(e.target.value)} style={dateStyle} />
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>–</span>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={dateStyle} />
            </div>
            <button onClick={() => run({ start, end })} style={{ ...presetStyle, marginTop: 8, background: '#4A9FD4', color: '#fff', textAlign: 'center' }}>Tarik Data</button>
          </div>
        </div>
      )}
    </div>
  )
}

const presetStyle: React.CSSProperties = { fontSize: 12, padding: '6px 8px', borderRadius: 6, border: 'none', background: '#F9FAFB', color: '#374151', cursor: 'pointer', textAlign: 'left' }
const dateStyle: React.CSSProperties = { fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid #E5E7EB', flex: 1 }

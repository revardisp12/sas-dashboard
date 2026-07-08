'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { daysAgoWIB } from '@/lib/utils'
import type { Brand } from '@/lib/types'

const LABELS: Record<Brand, string> = { reglow: 'Reglow', amura: 'Amura', purela: 'Purela' }
const daysBetween = (s: string, e: string) => Math.round((Date.parse(e) - Date.parse(s)) / 86_400_000)
function preset(kind: 'today' | 'yesterday' | 'last7'): { start: string; end: string } {
  if (kind === 'yesterday') { const d = daysAgoWIB(1); return { start: d, end: d } }
  if (kind === 'last7') return { start: daysAgoWIB(6), end: daysAgoWIB(0) }
  const d = daysAgoWIB(0)
  return { start: d, end: d }
}

type PulledRange = { range_start: string; range_end: string; created_at: string }
type Range = { start: string; end: string }

export default function BrandSyncButton({ brand, onResult }: { brand: Brand; onResult?: (r: { ok: boolean; text: string }) => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [start, setStart] = useState(preset('today').start)
  const [end, setEnd] = useState(preset('today').end)
  const [pulled, setPulled] = useState<PulledRange[]>([])
  const [warn, setWarn] = useState<{ range: Range; text: string } | null>(null)

  async function loadPulled() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).from('wms_pull_log')
      .select('range_start, range_end, created_at').eq('brand', brand)
      .order('created_at', { ascending: false }).limit(50)
    // Best-effort: a failure here just means the duplicate-pull guard silently has no
    // coverage data (still safe — worst case a redundant re-pull) — but it should be
    // visible in devtools rather than fully silent.
    if (error) console.warn('[BrandSyncButton] wms_pull_log read failed:', error.message)
    setPulled((data ?? []) as PulledRange[])
  }

  function toggle() {
    const next = !open
    setOpen(next)
    setWarn(null)
    if (next) loadPulled()
  }

  function overlap(r: Range): PulledRange | undefined {
    // Two ranges overlap when each starts on/before the other ends.
    return pulled.find(p => r.start <= p.range_end && p.range_start <= r.end)
  }

  function checkAndRun(r: Range) {
    const ov = overlap(r)
    const days = daysBetween(r.start, r.end)
    if (ov) {
      setWarn({ range: r, text: `Range ${r.start} → ${r.end} overlap sama yang udah ditarik (${ov.range_start} → ${ov.range_end}). Tarik ulang buat refresh data?` })
    } else if (days > 14) {
      setWarn({ range: r, text: `Range ${days} hari cukup gede — buat brand volume tinggi (Purela) bisa lama/timeout. Lanjut tarik?` })
    } else {
      run(r)
    }
  }

  async function run(range: Range) {
    setBusy(true); setOpen(false); setWarn(null)
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
      if (res.ok) loadPulled()
    } catch (e) {
      onResult?.({ ok: false, text: `Error: ${e instanceof Error ? e.message : String(e)}` })
    } finally { setBusy(false) }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={toggle} disabled={busy}
        className="text-[11px] font-medium px-2.5 py-1 rounded-md"
        style={{ border: '1px solid #E5E7EB', background: '#fff', color: '#4A9FD4', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
        {busy ? `Sync ${LABELS[brand]}…` : `↻ Sync ${LABELS[brand]}`}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 50, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 12, width: 260, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>Tarik data WMS — {LABELS[brand]}</p>

          {warn ? (
            <div style={{ fontSize: 12, color: '#374151' }}>
              <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: 10, marginBottom: 10, lineHeight: 1.4 }}>⚠️ {warn.text}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => run(warn.range)} style={{ ...presetStyle, flex: 1, background: '#4A9FD4', color: '#fff', textAlign: 'center' }}>Tarik Ulang</button>
                <button onClick={() => setWarn(null)} style={{ ...presetStyle, flex: 1, textAlign: 'center' }}>Batal</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button onClick={() => checkAndRun(preset('today'))} style={presetStyle}>Hari ini</button>
                <button onClick={() => checkAndRun(preset('yesterday'))} style={presetStyle}>Kemarin</button>
                <button onClick={() => checkAndRun(preset('last7'))} style={presetStyle}>7 hari terakhir</button>
              </div>
              <div style={{ borderTop: '1px solid #F3F4F6', marginTop: 8, paddingTop: 8 }}>
                <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 4 }}>Custom (maks 31 hari)</p>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="date" value={start} onChange={e => setStart(e.target.value)} style={dateStyle} />
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>–</span>
                  <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={dateStyle} />
                </div>
                <button onClick={() => checkAndRun({ start, end })} style={{ ...presetStyle, marginTop: 8, background: '#4A9FD4', color: '#fff', textAlign: 'center' }}>Tarik Data</button>
              </div>
              {pulled.length > 0 && (
                <div style={{ borderTop: '1px solid #F3F4F6', marginTop: 8, paddingTop: 8 }}>
                  <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 4 }}>Udah ditarik</p>
                  {pulled.slice(0, 4).map((p, i) => (
                    <p key={i} style={{ fontSize: 10, color: '#10B981' }}>✓ {p.range_start} → {p.range_end}</p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

const presetStyle: React.CSSProperties = { fontSize: 12, padding: '6px 8px', borderRadius: 6, border: 'none', background: '#F9FAFB', color: '#374151', cursor: 'pointer', textAlign: 'left' }
const dateStyle: React.CSSProperties = { fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid #E5E7EB', flex: 1 }

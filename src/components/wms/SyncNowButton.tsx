'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SyncNowButton({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function run() {
    setBusy(true); setMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setMsg('Sesi habis, login ulang.'); return }
      const res = await fetch('/api/wms/sync', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      setMsg(res.ok ? `Sync ${json.status}: ${JSON.stringify(json.tables)}` : `Gagal: ${json.error ?? res.status}`)
      onDone()
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setBusy(false) }
  }

  return (
    <div>
      <button onClick={run} disabled={busy} style={{ padding: '8px 16px', borderRadius: 8, background: '#4A9FD4', color: '#fff', opacity: busy ? 0.6 : 1, border: 'none', cursor: busy ? 'default' : 'pointer' }}>
        {busy ? 'Menyinkronkan…' : 'Sync Sekarang'}
      </button>
      {msg && <p style={{ marginTop: 8, fontSize: 13, color: '#6B7280' }}>{msg}</p>}
    </div>
  )
}

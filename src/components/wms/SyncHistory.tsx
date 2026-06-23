'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface LogRow { id: string; trigger: string; status: string; tables: Record<string, number> | null; error: string | null; started_at: string; finished_at: string | null }

export default function SyncHistory({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('sync_log').select('*').order('started_at', { ascending: false }).limit(20)
      if (!cancelled) { setRows((data ?? []) as LogRow[]); setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [refreshKey])

  if (loading) return <p style={{ color: '#6B7280' }}>Memuat riwayat…</p>
  if (!rows.length) return <p style={{ color: '#6B7280' }}>Belum ada sync.</p>
  return (
    <div className="overflow-x-auto">
    <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
      <thead><tr style={{ textAlign: 'left', color: '#6B7280' }}><th>Waktu</th><th>Trigger</th><th>Status</th><th>Baris</th><th>Error</th></tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id} style={{ borderTop: '1px solid #eee' }}>
            <td>{new Date(r.started_at).toLocaleString('id-ID')}</td>
            <td>{r.trigger}</td>
            <td>{r.status}</td>
            <td>{r.tables ? Object.entries(r.tables).map(([k, v]) => `${k}:${v}`).join(' ') : '-'}</td>
            <td style={{ color: '#DC2626' }}>{r.error ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}

'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { RefreshCw, Loader2 } from 'lucide-react'
import type { Brand } from '@/lib/types'

export default function RegenerateButton({ brand }: { brand: Brand }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRegenerate() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Session expired — please reload')

      const res = await fetch(`/api/digest/${brand}/regenerate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Server error' }))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      router.refresh()  // re-fetch the server component
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={handleRegenerate} disabled={busy}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
        style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#374151' }}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        {busy ? 'Generating...' : 'Generate Now'}
      </button>
      {error && <span className="text-xs" style={{ color: '#DC2626' }}>{error}</span>}
    </div>
  )
}

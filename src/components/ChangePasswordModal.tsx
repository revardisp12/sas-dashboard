'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { X, KeyRound, Check } from 'lucide-react'

interface Props { open: boolean; onClose: () => void; accent?: string }

export default function ChangePasswordModal({ open, onClose, accent = '#F07830' }: Props) {
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  if (!open) return null

  function close() { setPw(''); setConfirm(''); setErr(null); setOk(false); onClose() }

  async function submit() {
    setErr(null)
    if (pw.length < 8) { setErr('Password minimal 8 karakter.'); return }
    if (pw !== confirm) { setErr('Konfirmasi password tidak cocok.'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setOk(true); setPw(''); setConfirm('')
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={close}>
      <div className="w-full max-w-sm rounded-2xl p-5 space-y-4" style={{ background: '#fff' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound size={16} style={{ color: accent }} />
            <p className="text-sm font-semibold" style={{ color: '#111827' }}>Ganti Password</p>
          </div>
          <button onClick={close} className="p-1 rounded" style={{ color: '#9CA3AF' }}><X size={16} /></button>
        </div>

        {ok ? (
          <div className="py-4 text-center space-y-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto" style={{ background: '#ECFDF5' }}>
              <Check size={20} style={{ color: '#10B981' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: '#111827' }}>Password berhasil diganti</p>
            <button onClick={close} className="text-xs font-semibold px-4 py-2 rounded-lg" style={{ background: accent, color: '#fff' }}>Tutup</button>
          </div>
        ) : (
          <>
            <div>
              <label className="text-[11px] font-medium" style={{ color: '#6B7280' }}>Password Baru</label>
              <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Min 8 karakter"
                className="w-full mt-1 text-sm px-3 py-2 rounded-lg border outline-none" style={{ borderColor: '#E5E7EB', color: '#374151' }} />
            </div>
            <div>
              <label className="text-[11px] font-medium" style={{ color: '#6B7280' }}>Konfirmasi Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Ulangi password baru"
                className="w-full mt-1 text-sm px-3 py-2 rounded-lg border outline-none" style={{ borderColor: '#E5E7EB', color: '#374151' }} />
            </div>
            {err && <p className="text-xs" style={{ color: '#DC2626' }}>{err}</p>}
            <button onClick={submit} disabled={saving}
              className="w-full text-sm font-semibold px-4 py-2.5 rounded-lg" style={{ background: accent, color: '#fff', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Menyimpan…' : 'Simpan Password Baru'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

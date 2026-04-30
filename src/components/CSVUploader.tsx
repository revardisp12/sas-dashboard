'use client'
import { useState, useRef } from 'react'
import { Upload, CheckCircle, Download, AlertCircle, Loader2 } from 'lucide-react'
import { Platform } from '@/lib/types'
import { downloadTemplate } from '@/lib/csvParser'

interface Props {
  platform: Platform | 'sales' | 'crm'
  hasData: boolean
  onUpload: (file: File) => Promise<void>
  accent?: string
}

export default function CSVUploader({ platform, hasData, onUpload, accent = '#F07830' }: Props) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const r = parseInt(accent.slice(1, 3), 16)
  const g = parseInt(accent.slice(3, 5), 16)
  const b = parseInt(accent.slice(5, 7), 16)

  async function handle(file: File) {
    if (!file.name.endsWith('.csv')) { setError('File harus format .csv'); return }
    setError(''); setLoading(true)
    try { await onUpload(file) }
    catch { setError('Gagal membaca file. Cek format CSV sesuai template.') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handle(f) }}
        onClick={() => inputRef.current?.click()}
        className="rounded-xl p-5 text-center cursor-pointer transition-all duration-300 border"
        style={{
          background: dragging ? `rgba(${r},${g},${b},0.1)` : hasData ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
          borderColor: dragging ? accent : hasData ? '#10B981' : 'rgba(255,255,255,0.08)',
          borderStyle: 'dashed',
          boxShadow: dragging ? `0 0 20px rgba(${r},${g},${b},0.2)` : 'none',
        }}
      >
        <input ref={inputRef} type="file" accept=".csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = '' }} />

        {loading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Loader2 size={22} className="animate-spin" style={{ color: accent }} />
            <p className="text-xs" style={{ color: '#6B7280' }}>Memproses...</p>
          </div>
        ) : hasData ? (
          <div className="flex flex-col items-center gap-1 py-1">
            <CheckCircle size={22} className="text-emerald-400" />
            <p className="text-xs font-semibold text-emerald-400">Data loaded</p>
            <p className="text-[10px]" style={{ color: '#4B5563' }}>Klik untuk update</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 py-1">
            <Upload size={22} style={{ color: accent }} />
            <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>Drop CSV atau klik</p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs rounded-lg p-2"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
          <AlertCircle size={12} />{error}
        </div>
      )}

      <button onClick={() => downloadTemplate(platform)}
        className="flex items-center gap-1.5 text-[10px] transition-colors"
        style={{ color: '#4B5563' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#9CA3AF')}
        onMouseLeave={e => (e.currentTarget.style.color = '#4B5563')}>
        <Download size={10} />Download template CSV
      </button>
    </div>
  )
}

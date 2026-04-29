'use client'
import { useState, useRef } from 'react'
import { Upload, CheckCircle, Download, AlertCircle } from 'lucide-react'
import { Platform } from '@/lib/types'
import { downloadTemplate } from '@/lib/csvParser'

interface Props {
  platform: Platform
  hasData: boolean
  onUpload: (file: File) => Promise<void>
  accent?: string
}

export default function CSVUploader({ platform, hasData, onUpload, accent = '#F07830' }: Props) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handle(file: File) {
    if (!file.name.endsWith('.csv')) {
      setError('File harus berformat .csv')
      return
    }
    setError('')
    setLoading(true)
    try {
      await onUpload(file)
    } catch {
      setError('Gagal membaca file. Pastikan format CSV sesuai template.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handle(f) }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          dragging ? 'border-orange-400 bg-orange-50' : hasData ? 'border-emerald-300 bg-emerald-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = '' }}
        />
        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Memproses CSV...</p>
          </div>
        ) : hasData ? (
          <div className="flex flex-col items-center gap-2">
            <CheckCircle size={32} className="text-emerald-500" />
            <p className="text-sm font-medium text-emerald-700">Data berhasil dimuat</p>
            <p className="text-xs text-gray-500">Klik untuk upload ulang data baru</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={32} style={{ color: accent }} />
            <p className="text-sm font-medium text-gray-700">Drag & drop CSV atau klik untuk pilih file</p>
            <p className="text-xs text-gray-400">Format: .csv dari export platform</p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <button
        onClick={() => downloadTemplate(platform)}
        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
      >
        <Download size={12} />
        Download template CSV
      </button>
    </div>
  )
}

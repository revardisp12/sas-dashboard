'use client'
import { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import CSVUploader from '@/components/CSVUploader'
import type { Platform } from '@/lib/types'

interface Props {
  platformName: string
  platformKey: Platform
  accent: string
  accentRgb: string
  emptyIcon: ReactNode
  emptyTitle: string
  emptyDescription: string
  rowCount: number
  onUpload: (file: File) => Promise<void>
  onManualClick: () => void
  children: ReactNode
  modal?: ReactNode
}

export default function PlatformViewShell({
  platformName, platformKey, accent, accentRgb,
  emptyIcon, emptyTitle, emptyDescription,
  rowCount, onUpload, onManualClick,
  children, modal,
}: Props) {
  const hasData = rowCount > 0
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#4B5563' }}>{platformName}</span>
          </div>
          <p className="text-sm" style={{ color: '#4B5563' }}>{hasData ? `${rowCount} baris data` : 'Upload CSV untuk mulai'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onManualClick}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0"
            style={{ background: `rgba(${accentRgb},0.12)`, border: `1px solid rgba(${accentRgb},0.3)`, color: accent }}>
            <Plus size={14} /> Input Manual
          </button>
          <div className="w-56 flex-shrink-0">
            <CSVUploader platform={platformKey} hasData={hasData} onUpload={onUpload} accent={accent} />
          </div>
        </div>
      </div>

      {hasData ? children : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: `rgba(${accentRgb},0.1)`, border: `1px solid rgba(${accentRgb},0.2)`, boxShadow: `0 0 30px rgba(${accentRgb},0.1)` }}>
            {emptyIcon}
          </div>
          <p className="font-semibold mb-1" style={{ color: '#6B7280' }}>{emptyTitle}</p>
          <p className="text-sm" style={{ color: '#374151' }}>{emptyDescription}</p>
        </div>
      )}

      {modal}
    </div>
  )
}

'use client'
import { Timeframe } from '@/lib/types'

const OPTIONS: { label: string; value: Timeframe }[] = [
  { label: '7H', value: 7 },
  { label: '14H', value: 14 },
  { label: '30H', value: 30 },
  { label: '90H', value: 90 },
  { label: 'All', value: 0 },
]

interface Props {
  value: Timeframe
  onChange: (t: Timeframe) => void
}

export default function TimeframeSelector({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: value === opt.value ? '#F07830' : 'transparent',
            color: value === opt.value ? '#fff' : '#6B7280',
            boxShadow: value === opt.value ? '0 0 12px rgba(240,120,48,0.4)' : 'none',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

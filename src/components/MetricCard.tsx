import { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
  label: string
  value: string
  icon?: ReactNode
  change?: number
  accent?: string
  sub?: string
}

export default function MetricCard({ label, value, icon, change, accent = '#F07830', sub }: Props) {
  const r = parseInt(accent.slice(1, 3), 16)
  const g = parseInt(accent.slice(3, 5), 16)
  const b = parseInt(accent.slice(5, 7), 16)

  return (
    <div
      className="relative rounded-2xl p-5 flex flex-col gap-3 overflow-hidden transition-all duration-300 group"
      style={{
        background: '#FFFFFF',
        border: `1px solid rgba(${r},${g},${b},0.2)`,
        boxShadow: `0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(${r},${g},${b},0.04)`,
      }}
    >
      {/* Glow bg */}
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 transition-opacity group-hover:opacity-20"
        style={{ background: accent, filter: 'blur(30px)', transform: 'translate(30%, -30%)' }} />

      <div className="flex items-center justify-between relative z-10">
        <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#6B7280' }}>{label}</span>
        {icon && (
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: `rgba(${r},${g},${b},0.15)`, boxShadow: `0 0 12px rgba(${r},${g},${b},0.3)`, color: accent }}>
            {icon}
          </div>
        )}
      </div>

      <p className="text-xl font-bold tracking-tight relative z-10 break-words" style={{ color: '#111827' }}>{value}</p>

      {sub && <p className="text-[10px] relative z-10 truncate" style={{ color: '#4B5563' }}>{sub}</p>}

      {change !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-semibold relative z-10 ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          <span className="font-normal text-[10px]" style={{ color: '#4B5563' }}>vs sebelumnya</span>
        </div>
      )}
    </div>
  )
}

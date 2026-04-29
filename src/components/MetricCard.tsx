import { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
  label: string
  value: string
  icon?: ReactNode
  change?: number
  accent?: string
}

export default function MetricCard({ label, value, icon, change, accent = '#F07830' }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{label}</span>
        {icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: accent + '20', color: accent }}>
            {icon}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
      {change !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-medium ${change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {change >= 0 ? '+' : ''}{change.toFixed(1)}% vs periode sebelumnya
        </div>
      )}
    </div>
  )
}

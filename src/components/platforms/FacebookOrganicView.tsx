'use client'
import { useState } from 'react'
import { FacebookOrganicRow, Brand } from '@/lib/types'
import MetricCard from '@/components/MetricCard'
import ManualInputModal from '@/components/ManualInputModal'
import PlatformViewShell from '@/components/platforms/PlatformViewShell'
import { Globe, Eye, Activity, Heart, TrendingUp } from 'lucide-react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { fmtNum, chartTooltipStyle } from '@/lib/utils'

const PLATFORM_COLOR = '#1877F2'
const PLATFORM_RGB = '24,119,242'
const chartStyle = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, padding: 20 }

const FB_FIELDS = [
  { key: 'date', label: 'Tanggal', type: 'date' as const },
  { key: 'reach', label: 'Reach', type: 'number' as const, placeholder: '12000' },
  { key: 'impressions', label: 'Impressions', type: 'number' as const, placeholder: '18000' },
  { key: 'engagements', label: 'Engagements', type: 'number' as const, placeholder: '850' },
]

interface Props { data: FacebookOrganicRow[]; brand: Brand; onUpload: (file: File) => Promise<void>; onManualAdd?: (rows: FacebookOrganicRow[]) => void }

export default function FacebookOrganicView({ data, brand, onUpload, onManualAdd }: Props) {
  const [modal, setModal] = useState(false)
  const totalReach = data.reduce((s, r) => s + r.reach, 0)
  const totalImpressions = data.reduce((s, r) => s + r.impressions, 0)
  const totalEngagements = data.reduce((s, r) => s + r.engagements, 0)
  const avgEngRate = totalReach > 0 ? (totalEngagements / totalReach) * 100 : 0
  const avgReach = data.length > 0 ? totalReach / data.length : 0
  const chartData = data.slice(-30).map(r => ({ date: r.date, Reach: r.reach, Impressions: r.impressions, Engagements: r.engagements }))

  return (
    <PlatformViewShell
      platformName="Facebook Organic"
      platformKey="facebook-organic"
      accent={PLATFORM_COLOR}
      accentRgb={PLATFORM_RGB}
      emptyIcon={<Globe size={28} style={{ color: PLATFORM_COLOR }} />}
      emptyTitle="Belum ada data Facebook Organic"
      emptyDescription="Upload CSV export dari Meta Business Suite"
      rowCount={data.length}
      onUpload={onUpload}
      onManualClick={() => setModal(true)}
      modal={modal && (
        <ManualInputModal
          title="Input Manual — Facebook Organic"
          subtitle="Tambah baris data Facebook Organic"
          brand={brand}
          fields={FB_FIELDS}
          onSave={async row => {
            const r: FacebookOrganicRow = {
              date: row.date,
              reach: Number(row.reach) || 0,
              impressions: Number(row.impressions) || 0,
              engagements: Number(row.engagements) || 0,
            }
            await onManualAdd?.([r])
            setModal(false)
          }}
          onClose={() => setModal(false)}
        />
      )}
    >
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <MetricCard label="Total Reach" value={fmtNum(totalReach)} icon={<Eye size={14} />} accent={PLATFORM_COLOR} />
        <MetricCard label="Avg. Reach/Hari" value={fmtNum(Math.round(avgReach))} icon={<TrendingUp size={14} />} accent="#10B981" />
        <MetricCard label="Impressions" value={fmtNum(totalImpressions)} icon={<Activity size={14} />} accent="#8B5CF6" />
        <MetricCard label="Engagements" value={fmtNum(totalEngagements)} icon={<Heart size={14} />} accent={PLATFORM_COLOR} />
        <MetricCard label="Eng. Rate" value={avgEngRate.toFixed(2) + '%'} icon={<Globe size={14} />} accent="#10B981" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div style={chartStyle}>
          <p className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: '#6B7280' }}>Reach & Impressions</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fbReachGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PLATFORM_COLOR} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={PLATFORM_COLOR} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fbImpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4B5563' }} />
              <YAxis tick={{ fontSize: 9, fill: '#4B5563' }} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#6B7280' }} />
              <Area type="monotone" dataKey="Reach" stroke={PLATFORM_COLOR} fill="url(#fbReachGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="Impressions" stroke="#8B5CF6" fill="url(#fbImpGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={chartStyle}>
          <p className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: '#6B7280' }}>Engagements</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4B5563' }} />
              <YAxis tick={{ fontSize: 9, fill: '#4B5563' }} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Line type="monotone" dataKey="Engagements" stroke={PLATFORM_COLOR} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </PlatformViewShell>
  )
}

'use client'
import { useState } from 'react'
import { FacebookOrganicRow, Brand } from '@/lib/types'
import MetricCard from '@/components/MetricCard'
import CSVUploader from '@/components/CSVUploader'
import ManualInputModal from '@/components/ManualInputModal'
import { Globe, Eye, Activity, Heart, TrendingUp, Plus } from 'lucide-react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const PLATFORM_COLOR = '#1877F2'
const chartStyle = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, padding: 20 }
function fmt(n: number) { return n.toLocaleString('id-ID') }

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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ background: PLATFORM_COLOR, boxShadow: `0 0 8px ${PLATFORM_COLOR}` }} />
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#4B5563' }}>Facebook Organic</span>
          </div>
          <p className="text-sm" style={{ color: '#4B5563' }}>{data.length > 0 ? `${data.length} baris data` : 'Upload CSV untuk mulai'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0"
            style={{ background: 'rgba(24,119,242,0.12)', border: '1px solid rgba(24,119,242,0.3)', color: PLATFORM_COLOR }}>
            <Plus size={14} /> Input Manual
          </button>
          <div className="w-56 flex-shrink-0">
            <CSVUploader platform="facebook-organic" hasData={data.length > 0} onUpload={onUpload} accent={PLATFORM_COLOR} />
          </div>
        </div>
      </div>

      {data.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <MetricCard label="Total Reach" value={fmt(totalReach)} icon={<Eye size={14} />} accent={PLATFORM_COLOR} />
            <MetricCard label="Avg. Reach/Hari" value={fmt(Math.round(avgReach))} icon={<TrendingUp size={14} />} accent="#10B981" />
            <MetricCard label="Impressions" value={fmt(totalImpressions)} icon={<Activity size={14} />} accent="#8B5CF6" />
            <MetricCard label="Engagements" value={fmt(totalEngagements)} icon={<Heart size={14} />} accent={PLATFORM_COLOR} />
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
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, color: '#111827', fontSize: 11 }} />
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
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, color: '#111827', fontSize: 11 }} />
                  <Line type="monotone" dataKey="Engagements" stroke={PLATFORM_COLOR} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(24,119,242,0.1)', border: '1px solid rgba(24,119,242,0.2)', boxShadow: '0 0 30px rgba(24,119,242,0.1)' }}>
            <Globe size={28} style={{ color: PLATFORM_COLOR }} />
          </div>
          <p className="font-semibold mb-1" style={{ color: '#6B7280' }}>Belum ada data Facebook Organic</p>
          <p className="text-sm" style={{ color: '#374151' }}>Upload CSV export dari Meta Business Suite</p>
        </div>
      )}

      {modal && (
        <ManualInputModal
          title="Input Manual — Facebook Organic"
          subtitle="Tambah baris data Facebook Organic"
          brand={brand}
          fields={FB_FIELDS}
          onSave={row => {
            const r: FacebookOrganicRow = {
              date: row.date,
              reach: Number(row.reach) || 0,
              impressions: Number(row.impressions) || 0,
              engagements: Number(row.engagements) || 0,
            }
            onManualAdd?.([r]); setModal(false)
          }}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  )
}

'use client'
import { useState } from 'react'
import { InstagramRow, Brand } from '@/lib/types'
import MetricCard from '@/components/MetricCard'
import ManualInputModal, { ComputedField } from '@/components/ManualInputModal'
import PlatformViewShell from '@/components/platforms/PlatformViewShell'
import { Camera, Users, Eye, Heart, TrendingUp, Activity } from 'lucide-react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { fmtNum } from '@/lib/utils'

const PLATFORM_COLOR = '#E1306C'
const PLATFORM_RGB = '225,48,108'
const chartStyle = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, padding: 20 }

const IG_FIELDS = [
  { key: 'date', label: 'Tanggal', type: 'date' as const },
  { key: 'followers', label: 'Followers', type: 'number' as const, placeholder: '25000' },
  { key: 'reach', label: 'Reach', type: 'number' as const, placeholder: '8500' },
  { key: 'impressions', label: 'Impressions', type: 'number' as const, placeholder: '12000' },
  { key: 'engagements', label: 'Engagements', type: 'number' as const, placeholder: '680' },
]

const IG_COMPUTED = [
  {
    label: 'Eng. Rate',
    format: 'percent' as const,
    formula: (f: Record<string, string>) => {
      const reach = Number(f.reach); const eng = Number(f.engagements)
      return reach > 0 ? (eng / reach) * 100 : null
    },
  },
]

interface Props { data: InstagramRow[]; brand: Brand; onUpload: (file: File) => Promise<void>; onManualAdd?: (rows: InstagramRow[]) => void }

export default function InstagramView({ data, brand, onUpload, onManualAdd }: Props) {
  const [modal, setModal] = useState(false)
  const latestFollowers = data.length > 0 ? data[data.length - 1].followers : 0
  const firstFollowers = data.length > 0 ? data[0].followers : 0
  const followerGrowth = data.length > 1 ? latestFollowers - firstFollowers : 0
  const totalReach = data.reduce((s, r) => s + r.reach, 0)
  const totalImpressions = data.reduce((s, r) => s + r.impressions, 0)
  const totalEngagements = data.reduce((s, r) => s + r.engagements, 0)
  const avgEngRate = totalReach > 0 ? (totalEngagements / totalReach) * 100 : 0
  const chartData = data.slice(-30).map(r => ({ date: r.date, Followers: r.followers, Reach: r.reach, Engagements: r.engagements }))

  return (
    <PlatformViewShell
      platformName="Instagram Organic"
      platformKey="instagram"
      accent={PLATFORM_COLOR}
      accentRgb={PLATFORM_RGB}
      emptyIcon={<Camera size={28} style={{ color: PLATFORM_COLOR }} />}
      emptyTitle="Belum ada data Instagram"
      emptyDescription="Upload CSV export dari Meta Business Suite"
      rowCount={data.length}
      onUpload={onUpload}
      onManualClick={() => setModal(true)}
      modal={modal && (
        <ManualInputModal
          title="Input Manual — Instagram"
          subtitle="Tambah baris data Instagram"
          brand={brand}
          fields={IG_FIELDS}
          computed={IG_COMPUTED as ComputedField[]}
          onSave={row => {
            const r: InstagramRow = {
              date: row.date,
              followers: Number(row.followers) || 0, reach: Number(row.reach) || 0,
              impressions: Number(row.impressions) || 0,
              profileVisits: 0,
              engagements: Number(row.engagements) || 0,
            }
            onManualAdd?.([r]); setModal(false)
          }}
          onClose={() => setModal(false)}
        />
      )}
    >
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <MetricCard label="Followers" value={fmtNum(latestFollowers)} icon={<Users size={14} />} accent={PLATFORM_COLOR} />
        <MetricCard label="Growth" value={(followerGrowth >= 0 ? '+' : '') + fmtNum(followerGrowth)} icon={<TrendingUp size={14} />} accent="#10B981" />
        <MetricCard label="Total Reach" value={fmtNum(totalReach)} icon={<Eye size={14} />} accent={PLATFORM_COLOR} />
        <MetricCard label="Impressions" value={fmtNum(totalImpressions)} icon={<Activity size={14} />} accent="#8B5CF6" />
        <MetricCard label="Engagements" value={fmtNum(totalEngagements)} icon={<Heart size={14} />} accent={PLATFORM_COLOR} />
        <MetricCard label="Eng. Rate" value={avgEngRate.toFixed(2) + '%'} icon={<Camera size={14} />} accent="#10B981" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div style={chartStyle}>
          <p className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: '#6B7280' }}>Pertumbuhan Followers</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="igGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PLATFORM_COLOR} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={PLATFORM_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4B5563' }} />
              <YAxis tick={{ fontSize: 9, fill: '#4B5563' }} />
              <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, color: '#111827', fontSize: 11 }} />
              <Area type="monotone" dataKey="Followers" stroke={PLATFORM_COLOR} fill="url(#igGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={chartStyle}>
          <p className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: '#6B7280' }}>Reach & Engagements</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4B5563' }} />
              <YAxis tick={{ fontSize: 9, fill: '#4B5563' }} />
              <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, color: '#111827', fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#6B7280' }} />
              <Line type="monotone" dataKey="Reach" stroke={PLATFORM_COLOR} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Engagements" stroke="#8B5CF6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </PlatformViewShell>
  )
}

'use client'
import { useState } from 'react'
import { MetaAdsRow, Brand } from '@/lib/types'
import MetricCard from '@/components/MetricCard'
import CSVUploader from '@/components/CSVUploader'
import ManualInputModal from '@/components/ManualInputModal'
import { Target, Users, MousePointer, TrendingUp, ShoppingCart, DollarSign, Plus } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const ACCENT: Record<Brand, string> = { reglow: '#C9A96E', amura: '#8FB050' }
const PLATFORM_COLOR = '#1877F2'

const META_FIELDS = [
  { key: 'date', label: 'Tanggal', type: 'date' as const },
  { key: 'campaign', label: 'Campaign', type: 'text' as const, placeholder: 'Retargeting' },
  { key: 'reach', label: 'Reach', type: 'number' as const, placeholder: '8000' },
  { key: 'impressions', label: 'Impressions', type: 'number' as const, placeholder: '12000' },
  { key: 'clicks', label: 'Link Clicks', type: 'number' as const, placeholder: '240' },
  { key: 'ctr', label: 'CTR (%)', type: 'number' as const, placeholder: '2.00' },
  { key: 'spend', label: 'Spend (Rp)', type: 'number' as const, placeholder: '500000' },
  { key: 'purchases', label: 'Purchases', type: 'number' as const, placeholder: '18' },
  { key: 'roas', label: 'ROAS', type: 'number' as const, placeholder: '3.2' },
  { key: 'cpm', label: 'CPM (Rp)', type: 'number' as const, placeholder: '41667' },
]

function fmt(n: number, type: 'currency' | 'number' | 'percent' = 'number') {
  if (type === 'currency') return 'Rp ' + n.toLocaleString('id-ID')
  if (type === 'percent') return n.toFixed(2) + '%'
  return n.toLocaleString('id-ID')
}

const chartStyle = { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20 }

interface Props { data: MetaAdsRow[]; brand: Brand; onUpload: (file: File) => Promise<void>; onManualAdd?: (rows: MetaAdsRow[]) => void }

export default function MetaAdsView({ data, brand, onUpload, onManualAdd }: Props) {
  const [modal, setModal] = useState(false)
  const accent = ACCENT[brand]
  const totalSpend = data.reduce((s, r) => s + r.spend, 0)
  const totalReach = data.reduce((s, r) => s + r.reach, 0)
  const totalClicks = data.reduce((s, r) => s + r.clicks, 0)
  const totalPurchases = data.reduce((s, r) => s + r.purchases, 0)
  const avgCtr = data.length > 0 ? data.reduce((s, r) => s + r.ctr, 0) / data.length : 0
  const avgRoas = data.length > 0 ? data.reduce((s, r) => s + r.roas, 0) / data.length : 0
  const chartData = data.slice(-30).map(r => ({ date: r.date, Spend: r.spend, Reach: r.reach, ROAS: r.roas }))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ background: PLATFORM_COLOR, boxShadow: `0 0 8px ${PLATFORM_COLOR}` }} />
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#4B5563' }}>Meta Ads</span>
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
            <CSVUploader platform="meta-ads" hasData={data.length > 0} onUpload={onUpload} accent={PLATFORM_COLOR} />
          </div>
        </div>
      </div>

      {data.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <MetricCard label="Total Spend" value={fmt(totalSpend, 'currency')} icon={<DollarSign size={14} />} accent={PLATFORM_COLOR} />
            <MetricCard label="Reach" value={fmt(totalReach)} icon={<Users size={14} />} accent={accent} />
            <MetricCard label="Clicks" value={fmt(totalClicks)} icon={<MousePointer size={14} />} accent={accent} />
            <MetricCard label="CTR" value={fmt(avgCtr, 'percent')} icon={<Target size={14} />} accent={PLATFORM_COLOR} />
            <MetricCard label="Purchases" value={fmt(totalPurchases)} icon={<ShoppingCart size={14} />} accent={PLATFORM_COLOR} />
            <MetricCard label="Avg ROAS" value={avgRoas.toFixed(2) + 'x'} icon={<TrendingUp size={14} />} accent="#10B981" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div style={chartStyle}>
              <p className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: '#6B7280' }}>Spend & Reach</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <Tooltip contentStyle={{ background: '#0E0E1C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#F0F0F5', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10, color: '#6B7280' }} />
                  <Line type="monotone" dataKey="Spend" stroke={PLATFORM_COLOR} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Reach" stroke={accent} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={chartStyle}>
              <p className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: '#6B7280' }}>ROAS per Hari</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <Tooltip contentStyle={{ background: '#0E0E1C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#F0F0F5', fontSize: 11 }} />
                  <Bar dataKey="ROAS" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(24,119,242,0.1)', border: '1px solid rgba(24,119,242,0.2)', boxShadow: '0 0 30px rgba(24,119,242,0.1)' }}>
            <Target size={28} style={{ color: PLATFORM_COLOR }} />
          </div>
          <p className="font-semibold mb-1" style={{ color: '#6B7280' }}>Belum ada data Meta Ads</p>
          <p className="text-sm" style={{ color: '#374151' }}>Upload CSV export dari Meta Ads Manager</p>
        </div>
      )}

      {modal && (
        <ManualInputModal
          title="Input Manual — Meta Ads"
          subtitle="Tambah baris data Meta Ads"
          brand={brand}
          fields={META_FIELDS}
          onSave={row => {
            const r: MetaAdsRow = {
              date: row.date, campaign: row.campaign,
              reach: Number(row.reach) || 0, impressions: Number(row.impressions) || 0,
              clicks: Number(row.clicks) || 0, ctr: Number(row.ctr) || 0,
              spend: Number(row.spend) || 0, purchases: Number(row.purchases) || 0,
              roas: Number(row.roas) || 0, cpm: Number(row.cpm) || 0,
            }
            onManualAdd?.([r]); setModal(false)
          }}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  )
}

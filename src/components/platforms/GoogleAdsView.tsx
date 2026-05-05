'use client'
import { useState } from 'react'
import { GoogleAdsRow, Brand } from '@/lib/types'
import MetricCard from '@/components/MetricCard'
import CSVUploader from '@/components/CSVUploader'
import ManualInputModal, { ComputedField } from '@/components/ManualInputModal'
import { BarChart2, DollarSign, MousePointer, TrendingUp, ShoppingCart, Percent, Plus, Link } from 'lucide-react'
import { SalesRow } from '@/lib/types'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const GA_FIELDS = [
  { key: 'date', label: 'Tanggal', type: 'date' as const },
  { key: 'campaign', label: 'Campaign', type: 'text' as const, placeholder: 'Brand Campaign' },
  { key: 'spend', label: 'Spend (Rp)', type: 'number' as const, placeholder: '875000' },
  { key: 'clicks', label: 'Clicks', type: 'number' as const, placeholder: '350' },
  { key: 'impressions', label: 'Impressions', type: 'number' as const, placeholder: '10000' },
  { key: 'conversions', label: 'Conversions', type: 'number' as const, placeholder: '42' },
]

const GA_COMPUTED = [
  {
    label: 'CTR',
    format: 'percent' as const,
    formula: (f: Record<string, string>) => {
      const imp = Number(f.impressions); const clk = Number(f.clicks)
      return imp > 0 ? (clk / imp) * 100 : null
    },
  },
  {
    label: 'Avg CPC',
    format: 'currency' as const,
    formula: (f: Record<string, string>) => {
      const clk = Number(f.clicks); const spend = Number(f.spend)
      return clk > 0 ? spend / clk : null
    },
  },
]

const ACCENT: Record<Brand, string> = { reglow: '#C9A96E', amura: '#8FB050', purela: '#9B7FD4' }
const PLATFORM_COLOR = '#4285F4'

function fmt(n: number, type: 'currency' | 'number' | 'percent' = 'number') {
  if (type === 'currency') return 'Rp ' + n.toLocaleString('id-ID')
  if (type === 'percent') return n.toFixed(2) + '%'
  return n.toLocaleString('id-ID')
}

const chartStyle = {
  background: '#F9FAFB',
  border: '1px solid #E5E7EB',
  borderRadius: 16,
  padding: 20,
}

interface Props { data: GoogleAdsRow[]; brand: Brand; onUpload: (file: File) => Promise<void>; onManualAdd?: (rows: GoogleAdsRow[]) => void; salesData?: SalesRow[] }

export default function GoogleAdsView({ data, brand, onUpload, onManualAdd, salesData = [] }: Props) {
  const accent = ACCENT[brand]
  const [modal, setModal] = useState(false)
  const totalSpend = data.reduce((s, r) => s + r.spend, 0)
  const totalImpressions = data.reduce((s, r) => s + r.impressions, 0)
  const totalClicks = data.reduce((s, r) => s + r.clicks, 0)
  const totalConversions = data.reduce((s, r) => s + r.conversions, 0)
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

  const csSales = salesData.filter(s => s.source === 'google-ads')
  const csRevenue = csSales.reduce((s, r) => s + r.revenue, 0)
  const csPurchases = csSales.length
  const roas = totalSpend > 0 && csRevenue > 0 ? csRevenue / totalSpend : null
  const convRate = totalClicks > 0 && csPurchases > 0 ? (csPurchases / totalClicks) * 100 : null

  const chartData = data.slice(-30).map(r => ({ date: r.date, Spend: r.spend, Clicks: r.clicks }))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ background: PLATFORM_COLOR, boxShadow: `0 0 8px ${PLATFORM_COLOR}` }} />
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#4B5563' }}>Google Ads</span>
          </div>
          <p className="text-sm" style={{ color: '#4B5563' }}>{data.length > 0 ? `${data.length} baris data` : 'Upload CSV untuk mulai'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0"
            style={{ background: 'rgba(66,133,244,0.12)', border: '1px solid rgba(66,133,244,0.3)', color: PLATFORM_COLOR }}>
            <Plus size={14} /> Input Manual
          </button>
          <div className="w-56 flex-shrink-0">
            <CSVUploader platform="google-ads" hasData={data.length > 0} onUpload={onUpload} accent={PLATFORM_COLOR} />
          </div>
        </div>
      </div>

      {data.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <MetricCard label="Total Spend" value={fmt(totalSpend, 'currency')} icon={<DollarSign size={14} />} accent={PLATFORM_COLOR} />
            <MetricCard label="Impressions" value={fmt(totalImpressions)} icon={<BarChart2 size={14} />} accent={accent} />
            <MetricCard label="Clicks" value={fmt(totalClicks)} icon={<MousePointer size={14} />} accent={accent} />
            <MetricCard label="CTR" value={fmt(avgCtr, 'percent')} icon={<Percent size={14} />} accent={accent} />
            <MetricCard label="CS Revenue" value={csRevenue > 0 ? fmt(csRevenue, 'currency') : '—'} icon={<Link size={14} />} accent="#10B981" sub="dari CS Sales" />
            <MetricCard label="CS Purchases" value={csPurchases > 0 ? fmt(csPurchases) : '—'} icon={<ShoppingCart size={14} />} accent="#10B981" sub="dari CS Sales" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="ROAS" value={roas !== null ? roas.toFixed(2) + 'x' : '—'} icon={<TrendingUp size={14} />} accent="#10B981" sub={roas !== null ? `CS Rev ÷ Spend` : 'Butuh data CS (source: Google Ads)'} />
            <MetricCard label="Conv. Rate" value={convRate !== null ? fmt(convRate, 'percent') : '—'} icon={<Percent size={14} />} accent="#10B981" sub={convRate !== null ? `CS Purchases ÷ Clicks` : 'Butuh data CS (source: Google Ads)'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div style={chartStyle}>
              <p className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: '#6B7280' }}>Spend & Clicks</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, color: '#111827', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10, color: '#6B7280' }} />
                  <Line type="monotone" dataKey="Spend" stroke={PLATFORM_COLOR} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Clicks" stroke={accent} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={chartStyle}>
              <p className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: '#6B7280' }}>Clicks per Hari</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, color: '#111827', fontSize: 11 }} />
                  <Bar dataKey="Clicks" fill={PLATFORM_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : <EmptyState />}

      {modal && (
        <ManualInputModal
          title="Input Manual — Google Ads"
          subtitle="Tambah baris data Google Ads"
          brand={brand}
          fields={GA_FIELDS}
          computed={GA_COMPUTED as ComputedField[]}
          onSave={row => {
            const impressions = Number(row.impressions) || 0
            const clicks = Number(row.clicks) || 0
            const spend = Number(row.spend) || 0
            const r: GoogleAdsRow = {
              date: row.date, campaign: row.campaign,
              impressions, clicks, spend,
              conversions: Number(row.conversions) || 0,
              ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
              cpc: clicks > 0 ? spend / clicks : 0,
              convRate: 0, roas: 0,
            }
            onManualAdd?.([r]); setModal(false)
          }}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(66,133,244,0.1)', border: '1px solid rgba(66,133,244,0.2)', boxShadow: '0 0 30px rgba(66,133,244,0.1)' }}>
        <BarChart2 size={28} style={{ color: '#4285F4' }} />
      </div>
      <p className="font-semibold mb-1" style={{ color: '#6B7280' }}>Belum ada data Google Ads</p>
      <p className="text-sm" style={{ color: '#374151' }}>Upload CSV export dari Google Ads di panel kanan atas</p>
    </div>
  )
}

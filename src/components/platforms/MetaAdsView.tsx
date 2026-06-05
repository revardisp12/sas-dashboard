'use client'
import { useState } from 'react'
import { MetaAdsRow, Brand, SalesRow } from '@/lib/types'
import MetricCard from '@/components/MetricCard'
import ManualInputModal, { ComputedField } from '@/components/ManualInputModal'
import PlatformViewShell from '@/components/platforms/PlatformViewShell'
import { Target, Users, MousePointer, TrendingUp, ShoppingCart, DollarSign, Link, Percent } from 'lucide-react'
import { BRAND_COLORS } from '@/lib/brand'
import { fmtCurrency, fmtNum } from '@/lib/utils'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const PLATFORM_COLOR = '#1877F2'
const PLATFORM_RGB = '24,119,242'
const chartStyle = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, padding: 20 }

const META_FIELDS = [
  { key: 'date', label: 'Tanggal', type: 'date' as const },
  { key: 'campaign', label: 'Campaign', type: 'text' as const, placeholder: 'Retargeting' },
  { key: 'spend', label: 'Spend (Rp)', type: 'number' as const, placeholder: '500000' },
  { key: 'results', label: 'Results / Leads', type: 'number' as const, placeholder: '15' },
  { key: 'clicks', label: 'Link Clicks', type: 'number' as const, placeholder: '240' },
  { key: 'reach', label: 'Reach', type: 'number' as const, placeholder: '8000' },
  { key: 'impressions', label: 'Impressions', type: 'number' as const, placeholder: '12000' },
]

const META_COMPUTED = [
  {
    label: 'CTR',
    format: 'percent' as const,
    formula: (f: Record<string, string>) => {
      const imp = Number(f.impressions); const clk = Number(f.clicks)
      return imp > 0 ? (clk / imp) * 100 : null
    },
  },
  {
    label: 'CPM',
    format: 'currency' as const,
    formula: (f: Record<string, string>) => {
      const imp = Number(f.impressions); const spend = Number(f.spend)
      return imp > 0 ? (spend / imp) * 1000 : null
    },
  },
  {
    label: 'Cost per Result',
    format: 'currency' as const,
    formula: (f: Record<string, string>) => {
      const res = Number(f.results); const spend = Number(f.spend)
      return res > 0 ? spend / res : null
    },
  },
]

function fmt(n: number, type: 'currency' | 'number' | 'percent' = 'number') {
  if (type === 'currency') return fmtCurrency(n)
  if (type === 'percent') return n.toFixed(2) + '%'
  return fmtNum(n)
}

interface Props { data: MetaAdsRow[]; brand: Brand; onUpload: (file: File) => Promise<void>; onManualAdd?: (rows: MetaAdsRow[]) => void; salesData?: SalesRow[] }

export default function MetaAdsView({ data, brand, onUpload, onManualAdd, salesData = [] }: Props) {
  const [modal, setModal] = useState(false)
  const accent = BRAND_COLORS[brand]
  const totalSpend = data.reduce((s, r) => s + r.spend, 0)
  const totalReach = data.reduce((s, r) => s + r.reach, 0)
  const totalClicks = data.reduce((s, r) => s + r.clicks, 0)
  const totalResults = data.reduce((s, r) => s + (r.results ?? 0), 0)
  const avgCtr = data.length > 0 ? data.reduce((s, r) => s + r.ctr, 0) / data.length : 0
  const avgRoas = data.length > 0 ? data.reduce((s, r) => s + (r.roas ?? 0), 0) / data.length : 0
  const costPerResult = totalResults > 0 && totalSpend > 0 ? totalSpend / totalResults : null

  const csSales = salesData.filter(s => s.source === 'meta-ads')
  const csRevenue = csSales.reduce((s, r) => s + r.revenue, 0)
  const csPurchases = csSales.length
  const roas = totalSpend > 0 && csRevenue > 0 ? csRevenue / totalSpend : null
  const convRate = totalClicks > 0 && csPurchases > 0 ? (csPurchases / totalClicks) * 100 : null

  const chartData = data.slice(-30).map(r => ({ date: r.date, Spend: r.spend, Reach: r.reach, Clicks: r.clicks }))

  return (
    <PlatformViewShell
      platformName="Meta Ads"
      platformKey="meta-ads"
      accent={PLATFORM_COLOR}
      accentRgb={PLATFORM_RGB}
      emptyIcon={<Target size={28} style={{ color: PLATFORM_COLOR }} />}
      emptyTitle="Belum ada data Meta Ads"
      emptyDescription="Upload CSV export dari Meta Ads Manager"
      rowCount={data.length}
      onUpload={onUpload}
      onManualClick={() => setModal(true)}
      modal={modal && (
        <ManualInputModal
          title="Input Manual — Meta Ads"
          subtitle="Tambah baris data Meta Ads"
          brand={brand}
          fields={META_FIELDS}
          computed={META_COMPUTED as ComputedField[]}
          onSave={async row => {
            const impressions = Number(row.impressions) || 0
            const clicks = Number(row.clicks) || 0
            const spend = Number(row.spend) || 0
            const results = Number(row.results) || 0
            const r: MetaAdsRow = {
              date: row.date, campaign: row.campaign,
              reach: Number(row.reach) || 0, impressions, clicks, spend,
              purchases: 0, roas: 0, results,
              ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
              cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
            }
            await onManualAdd?.([r])
            setModal(false)
          }}
          onClose={() => setModal(false)}
        />
      )}
    >
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        <MetricCard label="Total Spend" value={fmt(totalSpend, 'currency')} icon={<DollarSign size={14} />} accent={PLATFORM_COLOR} />
        <MetricCard label="Reach" value={fmt(totalReach)} icon={<Users size={14} />} accent={accent} />
        <MetricCard label="Clicks" value={fmt(totalClicks)} icon={<MousePointer size={14} />} accent={accent} />
        <MetricCard label="CTR" value={fmt(avgCtr, 'percent')} icon={<Target size={14} />} accent={PLATFORM_COLOR} />
        <MetricCard label="Results / Leads" value={totalResults > 0 ? fmt(totalResults) : '—'} icon={<ShoppingCart size={14} />} accent={PLATFORM_COLOR} sub="Purchases + Leads dari CSV" />
        <MetricCard label="Cost per Result" value={costPerResult !== null ? fmt(costPerResult, 'currency') : '—'} icon={<DollarSign size={14} />} accent={PLATFORM_COLOR} sub="Spend ÷ Results" />
        <MetricCard label="Avg ROAS" value={avgRoas > 0 ? avgRoas.toFixed(2) + 'x' : '—'} icon={<TrendingUp size={14} />} accent="#10B981" sub="dari Meta Ads" />
        <MetricCard label="CS Revenue" value={csRevenue > 0 ? fmt(csRevenue, 'currency') : '—'} icon={<Link size={14} />} accent="#10B981" sub="dari CS Sales" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="ROAS (CS)" value={roas !== null ? roas.toFixed(2) + 'x' : '—'} icon={<TrendingUp size={14} />} accent="#10B981" sub={roas !== null ? 'CS Rev ÷ Spend' : 'Butuh data CS (source: Meta Ads)'} />
        <MetricCard label="Conv. Rate" value={convRate !== null ? fmt(convRate, 'percent') : '—'} icon={<Percent size={14} />} accent="#10B981" sub={convRate !== null ? 'CS Purchases ÷ Clicks' : 'Butuh data CS (source: Meta Ads)'} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div style={chartStyle}>
          <p className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: '#6B7280' }}>Spend & Reach</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4B5563' }} />
              <YAxis tick={{ fontSize: 9, fill: '#4B5563' }} />
              <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, color: '#111827', fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#6B7280' }} />
              <Line type="monotone" dataKey="Spend" stroke={PLATFORM_COLOR} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Reach" stroke={accent} strokeWidth={2} dot={false} />
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
    </PlatformViewShell>
  )
}

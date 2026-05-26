'use client'
import { useState } from 'react'
import { GoogleAdsRow, Brand, SalesRow } from '@/lib/types'
import MetricCard from '@/components/MetricCard'
import ManualInputModal, { ComputedField } from '@/components/ManualInputModal'
import PlatformViewShell from '@/components/platforms/PlatformViewShell'
import { BarChart2, DollarSign, MousePointer, TrendingUp, ShoppingCart, Percent, Link } from 'lucide-react'
import { BRAND_COLORS } from '@/lib/brand'
import { fmtCurrency, fmtNum } from '@/lib/utils'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const PLATFORM_COLOR = '#4285F4'
const PLATFORM_RGB = '66,133,244'
const chartStyle = { background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 16, padding: 20 }

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

function fmt(n: number, type: 'currency' | 'number' | 'percent' = 'number') {
  if (type === 'currency') return fmtCurrency(n)
  if (type === 'percent') return n.toFixed(2) + '%'
  return fmtNum(n)
}

interface Props { data: GoogleAdsRow[]; brand: Brand; onUpload: (file: File) => Promise<void>; onManualAdd?: (rows: GoogleAdsRow[]) => void; salesData?: SalesRow[] }

export default function GoogleAdsView({ data, brand, onUpload, onManualAdd, salesData = [] }: Props) {
  const accent = BRAND_COLORS[brand]
  const [modal, setModal] = useState(false)
  const totalSpend = data.reduce((s, r) => s + r.spend, 0)
  const totalImpressions = data.reduce((s, r) => s + r.impressions, 0)
  const totalClicks = data.reduce((s, r) => s + r.clicks, 0)
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

  const csSales = salesData.filter(s => s.source === 'google-ads')
  const csRevenue = csSales.reduce((s, r) => s + r.revenue, 0)
  const csPurchases = csSales.length
  const roas = totalSpend > 0 && csRevenue > 0 ? csRevenue / totalSpend : null
  const convRate = totalClicks > 0 && csPurchases > 0 ? (csPurchases / totalClicks) * 100 : null

  const chartData = data.slice(-30).map(r => ({ date: r.date, Spend: r.spend, Clicks: r.clicks }))

  return (
    <PlatformViewShell
      platformName="Google Ads"
      platformKey="google-ads"
      accent={PLATFORM_COLOR}
      accentRgb={PLATFORM_RGB}
      emptyIcon={<BarChart2 size={28} style={{ color: PLATFORM_COLOR }} />}
      emptyTitle="Belum ada data Google Ads"
      emptyDescription="Upload CSV export dari Google Ads di panel kanan atas"
      rowCount={data.length}
      onUpload={onUpload}
      onManualClick={() => setModal(true)}
      modal={modal && (
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
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
    </PlatformViewShell>
  )
}

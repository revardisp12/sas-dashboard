'use client'
import { useState } from 'react'
import { TikTokShopRow, Brand } from '@/lib/types'
import MetricCard from '@/components/MetricCard'
import ManualInputModal from '@/components/ManualInputModal'
import PlatformViewShell from '@/components/platforms/PlatformViewShell'
import { ShoppingBag, DollarSign, Package, TrendingUp, Percent, ShoppingCart, Zap } from 'lucide-react'
import { BRAND_COLORS } from '@/lib/brand'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fmtCurrency, fmtNum } from '@/lib/utils'

const PLATFORM_COLOR = '#FF0050'
const PLATFORM_RGB = '255,0,80'
const chartStyle = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, padding: 20 }

const TTS_FIELDS = [
  { key: 'date', label: 'Tanggal', type: 'date' as const },
  { key: 'gmv', label: 'GMV (Rp)', type: 'number' as const, placeholder: '15000000' },
  { key: 'orders', label: 'Orders', type: 'number' as const, placeholder: '75' },
  { key: 'unitsSold', label: 'Units Sold', type: 'number' as const, placeholder: '90' },
  { key: 'revenue', label: 'Revenue (Rp)', type: 'number' as const, placeholder: '14000000' },
  { key: 'productViews', label: 'Product Views', type: 'number' as const, placeholder: '1800' },
  { key: 'adSpent', label: 'Ad Spent (Rp)', type: 'number' as const, placeholder: '500000' },
]

function fmt(n: number, type: 'currency' | 'number' | 'percent' = 'number') {
  if (type === 'currency') return fmtCurrency(n)
  if (type === 'percent') return n.toFixed(2) + '%'
  return fmtNum(n)
}

interface Props { data: TikTokShopRow[]; brand: Brand; onUpload: (file: File) => Promise<void>; onManualAdd?: (rows: TikTokShopRow[]) => void }

export default function TikTokShopView({ data, brand, onUpload, onManualAdd }: Props) {
  const [modal, setModal] = useState(false)
  const accent = BRAND_COLORS[brand]
  const totalGmv = data.reduce((s, r) => s + r.gmv, 0)
  const totalOrders = data.reduce((s, r) => s + r.orders, 0)
  const totalUnits = data.reduce((s, r) => s + r.unitsSold, 0)
  const totalRevenue = data.reduce((s, r) => s + r.revenue, 0)
  const totalProductViews = data.reduce((s, r) => s + (r.productViews || 0), 0)
  const totalAdSpent = data.reduce((s, r) => s + (r.adSpent || 0), 0)
  const roas = totalAdSpent > 0 ? totalRevenue / totalAdSpent : null
  const convRate = totalProductViews > 0 ? (totalOrders / totalProductViews) * 100 : null
  const avgAov = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const chartData = data.slice(-30).map(r => ({ date: r.date, GMV: r.gmv, Orders: r.orders }))

  return (
    <PlatformViewShell
      platformName="TikTok Shop"
      platformKey="tiktok-shop"
      accent={PLATFORM_COLOR}
      accentRgb={PLATFORM_RGB}
      emptyIcon={<ShoppingBag size={28} style={{ color: PLATFORM_COLOR }} />}
      emptyTitle="Belum ada data TikTok Shop"
      emptyDescription="Upload CSV export dari TikTok Seller Center"
      rowCount={data.length}
      onUpload={onUpload}
      onManualClick={() => setModal(true)}
      modal={modal && (
        <ManualInputModal
          title="Input Manual — TikTok Shop"
          subtitle="Tambah baris data TikTok Shop"
          brand={brand}
          fields={TTS_FIELDS}
          onSave={async row => {
            const r: TikTokShopRow = {
              date: row.date,
              gmv: Number(row.gmv) || 0, orders: Number(row.orders) || 0,
              unitsSold: Number(row.unitsSold) || 0, revenue: Number(row.revenue) || 0,
              productViews: Number(row.productViews) || 0,
              adSpent: Number(row.adSpent) || 0,
            }
            await onManualAdd?.([r])
            setModal(false)
          }}
          onClose={() => setModal(false)}
        />
      )}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Total GMV" value={fmt(totalGmv, 'currency')} icon={<TrendingUp size={14} />} accent={PLATFORM_COLOR} />
        <MetricCard label="Revenue" value={fmt(totalRevenue, 'currency')} icon={<DollarSign size={14} />} accent={PLATFORM_COLOR} />
        <MetricCard label="Ad Spent" value={fmt(totalAdSpent, 'currency')} icon={<Zap size={14} />} accent="#F59E0B" />
        <MetricCard label="ROAS" value={roas !== null ? roas.toFixed(2) + 'x' : '—'} icon={<TrendingUp size={14} />} accent="#10B981" />
        <MetricCard label="Orders" value={fmt(totalOrders)} icon={<ShoppingCart size={14} />} accent={accent} />
        <MetricCard label="Units Sold" value={fmt(totalUnits)} icon={<Package size={14} />} accent={accent} />
        <MetricCard label="Conv. Rate" value={convRate !== null ? fmt(convRate, 'percent') : '—'} icon={<Percent size={14} />} accent="#10B981" />
        <MetricCard label="Avg AOV" value={fmt(avgAov, 'currency')} icon={<ShoppingBag size={14} />} accent={accent} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div style={chartStyle}>
          <p className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: '#6B7280' }}>GMV Trend</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PLATFORM_COLOR} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={PLATFORM_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4B5563' }} />
              <YAxis tick={{ fontSize: 9, fill: '#4B5563' }} />
              <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, color: '#111827', fontSize: 11 }} />
              <Area type="monotone" dataKey="GMV" stroke={PLATFORM_COLOR} fill="url(#gmvGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={chartStyle}>
          <p className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: '#6B7280' }}>Orders per Hari</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4B5563' }} />
              <YAxis tick={{ fontSize: 9, fill: '#4B5563' }} />
              <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, color: '#111827', fontSize: 11 }} />
              <Bar dataKey="Orders" fill={PLATFORM_COLOR} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </PlatformViewShell>
  )
}

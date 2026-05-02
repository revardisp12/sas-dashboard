'use client'
import { useState } from 'react'
import { ShopeeRow, Brand } from '@/lib/types'
import MetricCard from '@/components/MetricCard'
import CSVUploader from '@/components/CSVUploader'
import ManualInputModal, { ComputedField } from '@/components/ManualInputModal'
import { ShoppingBag, DollarSign, Package, TrendingUp, Percent, ShoppingCart, Target, MousePointer, Plus } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

const SHOPEE_FIELDS = [
  { key: 'date', label: 'Tanggal', type: 'date' as const },
  { key: 'gmv', label: 'GMV (Rp)', type: 'number' as const, placeholder: '18000000' },
  { key: 'revenue', label: 'Revenue (Rp)', type: 'number' as const, placeholder: '17000000' },
  { key: 'orders', label: 'Orders', type: 'number' as const, placeholder: '90' },
  { key: 'unitsSold', label: 'Units Sold', type: 'number' as const, placeholder: '110' },
  { key: 'productViews', label: 'Product Views', type: 'number' as const, placeholder: '2370' },
  { key: 'adSpend', label: 'Ad Spend (Rp)', type: 'number' as const, placeholder: '1500000' },
  { key: 'adClicks', label: 'Ad Clicks', type: 'number' as const, placeholder: '3200' },
]

const SHOPEE_COMPUTED = [
  {
    label: 'Conv Rate',
    format: 'percent' as const,
    formula: (f: Record<string, string>) => {
      const views = Number(f.productViews); const orders = Number(f.orders)
      return views > 0 ? (orders / views) * 100 : null
    },
  },
  {
    label: 'AOV',
    format: 'currency' as const,
    formula: (f: Record<string, string>) => {
      const orders = Number(f.orders); const rev = Number(f.revenue)
      return orders > 0 ? rev / orders : null
    },
  },
  {
    label: 'Ad ROAS',
    format: 'number' as const,
    formula: (f: Record<string, string>) => {
      const spend = Number(f.adSpend); const rev = Number(f.revenue)
      return spend > 0 ? rev / spend : null
    },
  },
  {
    label: 'Ad CPC',
    format: 'currency' as const,
    formula: (f: Record<string, string>) => {
      const clicks = Number(f.adClicks); const spend = Number(f.adSpend)
      return clicks > 0 ? spend / clicks : null
    },
  },
]

const ACCENT: Record<Brand, string> = { reglow: '#C9A96E', amura: '#8FB050' }
const PLATFORM_COLOR = '#F05536'

function fmt(n: number, type: 'currency' | 'number' | 'percent' = 'number') {
  if (type === 'currency') return 'Rp ' + n.toLocaleString('id-ID')
  if (type === 'percent') return n.toFixed(2) + '%'
  return n.toLocaleString('id-ID')
}

const chartStyle = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, padding: 20 }

interface Props { data: ShopeeRow[]; brand: Brand; onUpload: (file: File) => Promise<void>; onManualAdd?: (rows: ShopeeRow[]) => void }

export default function ShopeeView({ data, brand, onUpload, onManualAdd }: Props) {
  const [modal, setModal] = useState(false)
  const accent = ACCENT[brand]
  const totalGmv = data.reduce((s, r) => s + r.gmv, 0)
  const totalOrders = data.reduce((s, r) => s + r.orders, 0)
  const totalUnits = data.reduce((s, r) => s + r.unitsSold, 0)
  const totalRevenue = data.reduce((s, r) => s + r.revenue, 0)
  const totalProductViews = data.reduce((s, r) => s + (r.productViews || 0), 0)
  const convRate = totalProductViews > 0 ? (totalOrders / totalProductViews) * 100 : null
  const avgAov = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const totalAdSpend = data.reduce((s, r) => s + r.adSpend, 0)
  const adRoas = totalAdSpend > 0 ? totalRevenue / totalAdSpend : null
  const totalAdClicks = data.reduce((s, r) => s + r.adClicks, 0)
  const totalImpressions = data.reduce((s, r) => s + r.adImpressions, 0)

  const chartData = data.slice(-30).map(r => ({
    date: r.date,
    GMV: r.gmv,
    Orders: r.orders,
    'Ad Spend': r.adSpend,
    'Ad ROAS': r.adSpend > 0 ? r.revenue / r.adSpend : 0,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ background: PLATFORM_COLOR, boxShadow: `0 0 8px ${PLATFORM_COLOR}` }} />
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#4B5563' }}>Shopee</span>
          </div>
          <p className="text-sm" style={{ color: '#4B5563' }}>{data.length > 0 ? `${data.length} baris data` : 'Upload CSV untuk mulai'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0"
            style={{ background: 'rgba(240,85,54,0.12)', border: '1px solid rgba(240,85,54,0.3)', color: PLATFORM_COLOR }}>
            <Plus size={14} /> Input Manual
          </button>
          <div className="w-56 flex-shrink-0">
            <CSVUploader platform="shopee" hasData={data.length > 0} onUpload={onUpload} accent={PLATFORM_COLOR} />
          </div>
        </div>
      </div>

      {data.length > 0 ? (
        <>
          {/* Marketplace metrics */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#6B7280' }}>Marketplace Metrics</p>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <MetricCard label="Total GMV" value={fmt(totalGmv, 'currency')} icon={<TrendingUp size={14} />} accent={PLATFORM_COLOR} />
              <MetricCard label="Orders" value={fmt(totalOrders)} icon={<ShoppingCart size={14} />} accent={accent} />
              <MetricCard label="Units Sold" value={fmt(totalUnits)} icon={<Package size={14} />} accent={accent} />
              <MetricCard label="Revenue" value={fmt(totalRevenue, 'currency')} icon={<DollarSign size={14} />} accent={PLATFORM_COLOR} />
              <MetricCard label="Conv. Rate" value={convRate !== null ? fmt(convRate, 'percent') : '—'} icon={<Percent size={14} />} accent="#10B981" />
              <MetricCard label="Avg AOV" value={fmt(avgAov, 'currency')} icon={<ShoppingBag size={14} />} accent={accent} />
            </div>
          </div>

          {/* Ads metrics */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#6B7280' }}>Shopee Ads Metrics</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Ad Spend" value={fmt(totalAdSpend, 'currency')} icon={<Target size={14} />} accent="#F59E0B" />
              <MetricCard label="Ad ROAS" value={adRoas !== null ? adRoas.toFixed(2) + 'x' : '—'} icon={<TrendingUp size={14} />} accent="#10B981" />
              <MetricCard label="Ad Clicks" value={fmt(totalAdClicks)} icon={<MousePointer size={14} />} accent={PLATFORM_COLOR} />
              <MetricCard label="Impressions" value={fmt(totalImpressions)} icon={<Package size={14} />} accent={accent} />
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div style={chartStyle}>
              <p className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: '#6B7280' }}>GMV Trend</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="shopeeGmvGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PLATFORM_COLOR} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={PLATFORM_COLOR} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, color: '#111827', fontSize: 11 }} />
                  <Area type="monotone" dataKey="GMV" stroke={PLATFORM_COLOR} fill="url(#shopeeGmvGrad)" strokeWidth={2} />
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
            <div style={chartStyle}>
              <p className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: '#6B7280' }}>Ad Spend vs ROAS</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <YAxis yAxisId="spend" tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <YAxis yAxisId="roas" orientation="right" tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, color: '#111827', fontSize: 11 }} />
                  <Line yAxisId="spend" type="monotone" dataKey="Ad Spend" stroke="#F59E0B" strokeWidth={2} dot={false} />
                  <Line yAxisId="roas" type="monotone" dataKey="Ad ROAS" stroke="#10B981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(240,85,54,0.1)', border: '1px solid rgba(240,85,54,0.2)', boxShadow: '0 0 30px rgba(240,85,54,0.1)' }}>
            <ShoppingBag size={28} style={{ color: PLATFORM_COLOR }} />
          </div>
          <p className="font-semibold mb-1" style={{ color: '#6B7280' }}>Belum ada data Shopee</p>
          <p className="text-sm" style={{ color: '#374151' }}>Upload CSV export dari Shopee Seller Center</p>
        </div>
      )}

      {modal && (
        <ManualInputModal
          title="Input Manual — Shopee"
          subtitle="Tambah baris data Shopee"
          brand={brand}
          fields={SHOPEE_FIELDS}
          computed={SHOPEE_COMPUTED as ComputedField[]}
          onSave={row => {
            const r: ShopeeRow = {
              date: row.date,
              gmv: Number(row.gmv) || 0, orders: Number(row.orders) || 0,
              unitsSold: Number(row.unitsSold) || 0, revenue: Number(row.revenue) || 0,
              productViews: Number(row.productViews) || 0,
              adSpend: Number(row.adSpend) || 0,
              adClicks: Number(row.adClicks) || 0,
              adImpressions: 0,
            }
            onManualAdd?.([r]); setModal(false)
          }}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  )
}

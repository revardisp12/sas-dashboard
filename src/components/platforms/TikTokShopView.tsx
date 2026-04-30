'use client'
import { TikTokShopRow, Brand } from '@/lib/types'
import MetricCard from '@/components/MetricCard'
import CSVUploader from '@/components/CSVUploader'
import { ShoppingBag, DollarSign, Package, TrendingUp, Percent, ShoppingCart } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const ACCENT: Record<Brand, string> = { reglow: '#C9A96E', amura: '#8FB050' }
const PLATFORM_COLOR = '#FF0050'

function fmt(n: number, type: 'currency' | 'number' | 'percent' = 'number') {
  if (type === 'currency') return 'Rp ' + n.toLocaleString('id-ID')
  if (type === 'percent') return n.toFixed(2) + '%'
  return n.toLocaleString('id-ID')
}

const chartStyle = { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20 }

interface Props { data: TikTokShopRow[]; brand: Brand; onUpload: (file: File) => Promise<void> }

export default function TikTokShopView({ data, brand, onUpload }: Props) {
  const accent = ACCENT[brand]
  const totalGmv = data.reduce((s, r) => s + r.gmv, 0)
  const totalOrders = data.reduce((s, r) => s + r.orders, 0)
  const totalUnits = data.reduce((s, r) => s + r.unitsSold, 0)
  const totalRevenue = data.reduce((s, r) => s + r.revenue, 0)
  const avgConvRate = data.length > 0 ? data.reduce((s, r) => s + r.convRate, 0) / data.length : 0
  const avgAov = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const chartData = data.slice(-30).map(r => ({ date: r.date, GMV: r.gmv, Orders: r.orders }))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ background: PLATFORM_COLOR, boxShadow: `0 0 8px ${PLATFORM_COLOR}` }} />
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#4B5563' }}>TikTok Shop</span>
          </div>
          <p className="text-sm" style={{ color: '#4B5563' }}>{data.length > 0 ? `${data.length} baris data` : 'Upload CSV untuk mulai'}</p>
        </div>
        <div className="w-56 flex-shrink-0">
          <CSVUploader platform="tiktok-shop" hasData={data.length > 0} onUpload={onUpload} accent={PLATFORM_COLOR} />
        </div>
      </div>

      {data.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <MetricCard label="Total GMV" value={fmt(totalGmv, 'currency')} icon={<TrendingUp size={14} />} accent={PLATFORM_COLOR} />
            <MetricCard label="Orders" value={fmt(totalOrders)} icon={<ShoppingCart size={14} />} accent={accent} />
            <MetricCard label="Units Sold" value={fmt(totalUnits)} icon={<Package size={14} />} accent={accent} />
            <MetricCard label="Revenue" value={fmt(totalRevenue, 'currency')} icon={<DollarSign size={14} />} accent={PLATFORM_COLOR} />
            <MetricCard label="Conv. Rate" value={fmt(avgConvRate, 'percent')} icon={<Percent size={14} />} accent="#10B981" />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <Tooltip contentStyle={{ background: '#0E0E1C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#F0F0F5', fontSize: 11 }} />
                  <Area type="monotone" dataKey="GMV" stroke={PLATFORM_COLOR} fill="url(#gmvGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={chartStyle}>
              <p className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: '#6B7280' }}>Orders per Hari</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <Tooltip contentStyle={{ background: '#0E0E1C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#F0F0F5', fontSize: 11 }} />
                  <Bar dataKey="Orders" fill={PLATFORM_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(255,0,80,0.1)', border: '1px solid rgba(255,0,80,0.2)', boxShadow: '0 0 30px rgba(255,0,80,0.1)' }}>
            <ShoppingBag size={28} style={{ color: PLATFORM_COLOR }} />
          </div>
          <p className="font-semibold mb-1" style={{ color: '#6B7280' }}>Belum ada data TikTok Shop</p>
          <p className="text-sm" style={{ color: '#374151' }}>Upload CSV export dari TikTok Seller Center</p>
        </div>
      )}
    </div>
  )
}

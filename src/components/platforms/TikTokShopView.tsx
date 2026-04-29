'use client'
import { TikTokShopRow, Brand } from '@/lib/types'
import MetricCard from '@/components/MetricCard'
import CSVUploader from '@/components/CSVUploader'
import { ShoppingBag, DollarSign, Package, TrendingUp, Percent, ShoppingCart } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const ACCENT: Record<Brand, string> = { reglow: '#1C1C1C', amura: '#6B7C3D' }

function fmt(n: number, type: 'currency' | 'number' | 'percent' = 'number') {
  if (type === 'currency') return 'Rp ' + n.toLocaleString('id-ID')
  if (type === 'percent') return n.toFixed(2) + '%'
  return n.toLocaleString('id-ID')
}

interface Props {
  data: TikTokShopRow[]
  brand: Brand
  onUpload: (file: File) => Promise<void>
}

export default function TikTokShopView({ data, brand, onUpload }: Props) {
  const accent = ACCENT[brand]
  const totalGmv = data.reduce((s, r) => s + r.gmv, 0)
  const totalOrders = data.reduce((s, r) => s + r.orders, 0)
  const totalUnits = data.reduce((s, r) => s + r.unitsSold, 0)
  const totalRevenue = data.reduce((s, r) => s + r.revenue, 0)
  const avgConvRate = data.length > 0 ? data.reduce((s, r) => s + r.convRate, 0) / data.length : 0
  const avgAov = totalOrders > 0 ? totalRevenue / totalOrders : 0

  const chartData = data.slice(-30).map((r) => ({ date: r.date, GMV: r.gmv, Orders: r.orders }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">TikTok Shop</h2>
          <p className="text-sm text-gray-500">{data.length > 0 ? `${data.length} baris data` : 'Belum ada data'}</p>
        </div>
        <div className="w-72">
          <CSVUploader platform="tiktok-shop" hasData={data.length > 0} onUpload={onUpload} accent={accent} />
        </div>
      </div>

      {data.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard label="Total GMV" value={fmt(totalGmv, 'currency')} icon={<TrendingUp size={14} />} accent={accent} />
            <MetricCard label="Total Orders" value={fmt(totalOrders)} icon={<ShoppingCart size={14} />} accent={accent} />
            <MetricCard label="Units Sold" value={fmt(totalUnits)} icon={<Package size={14} />} accent={accent} />
            <MetricCard label="Revenue" value={fmt(totalRevenue, 'currency')} icon={<DollarSign size={14} />} accent={accent} />
            <MetricCard label="Avg Conv. Rate" value={fmt(avgConvRate, 'percent')} icon={<Percent size={14} />} accent={accent} />
            <MetricCard label="Avg AOV" value={fmt(avgAov, 'currency')} icon={<ShoppingBag size={14} />} accent={accent} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">GMV (30 hari terakhir)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={accent} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="GMV" stroke={accent} fill="url(#gmvGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Orders per hari</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="Orders" fill="#FF0050" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShoppingBag size={48} className="text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium">Belum ada data TikTok Shop</p>
          <p className="text-gray-400 text-sm mt-1">Upload CSV export dari TikTok Seller Center di atas</p>
        </div>
      )}
    </div>
  )
}

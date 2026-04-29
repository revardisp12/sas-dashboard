'use client'
import { MetaAdsRow, Brand } from '@/lib/types'
import MetricCard from '@/components/MetricCard'
import CSVUploader from '@/components/CSVUploader'
import { Target, Users, MousePointer, TrendingUp, ShoppingCart, DollarSign } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const ACCENT: Record<Brand, string> = { reglow: '#1C1C1C', amura: '#6B7C3D' }

function fmt(n: number, type: 'currency' | 'number' | 'percent' = 'number') {
  if (type === 'currency') return 'Rp ' + n.toLocaleString('id-ID')
  if (type === 'percent') return n.toFixed(2) + '%'
  return n.toLocaleString('id-ID')
}

interface Props {
  data: MetaAdsRow[]
  brand: Brand
  onUpload: (file: File) => Promise<void>
}

export default function MetaAdsView({ data, brand, onUpload }: Props) {
  const accent = ACCENT[brand]
  const totalSpend = data.reduce((s, r) => s + r.spend, 0)
  const totalReach = data.reduce((s, r) => s + r.reach, 0)
  const totalClicks = data.reduce((s, r) => s + r.clicks, 0)
  const totalPurchases = data.reduce((s, r) => s + r.purchases, 0)
  const avgCtr = data.length > 0 ? data.reduce((s, r) => s + r.ctr, 0) / data.length : 0
  const avgRoas = data.length > 0 ? data.reduce((s, r) => s + r.roas, 0) / data.length : 0

  const chartData = data.slice(-30).map((r) => ({ date: r.date, Spend: r.spend, Reach: r.reach, ROAS: r.roas }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Meta Ads</h2>
          <p className="text-sm text-gray-500">{data.length > 0 ? `${data.length} baris data` : 'Belum ada data'}</p>
        </div>
        <div className="w-72">
          <CSVUploader platform="meta-ads" hasData={data.length > 0} onUpload={onUpload} accent={accent} />
        </div>
      </div>

      {data.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard label="Total Spend" value={fmt(totalSpend, 'currency')} icon={<DollarSign size={14} />} accent={accent} />
            <MetricCard label="Reach" value={fmt(totalReach)} icon={<Users size={14} />} accent={accent} />
            <MetricCard label="Clicks" value={fmt(totalClicks)} icon={<MousePointer size={14} />} accent={accent} />
            <MetricCard label="CTR" value={fmt(avgCtr, 'percent')} icon={<Target size={14} />} accent={accent} />
            <MetricCard label="Purchases" value={fmt(totalPurchases)} icon={<ShoppingCart size={14} />} accent={accent} />
            <MetricCard label="Avg ROAS" value={avgRoas.toFixed(2) + 'x'} icon={<TrendingUp size={14} />} accent={accent} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Spend & Reach (30 hari terakhir)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Spend" stroke={accent} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Reach" stroke="#4267B2" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">ROAS per hari</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="ROAS" fill={accent} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Target size={48} className="text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium">Belum ada data Meta Ads</p>
          <p className="text-gray-400 text-sm mt-1">Upload CSV export dari Meta Ads Manager di atas</p>
        </div>
      )}
    </div>
  )
}

'use client'
import { InstagramRow, Brand } from '@/lib/types'
import MetricCard from '@/components/MetricCard'
import CSVUploader from '@/components/CSVUploader'
import { Camera, Users, Eye, Heart, TrendingUp, Activity } from 'lucide-react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const ACCENT: Record<Brand, string> = { reglow: '#1C1C1C', amura: '#6B7C3D' }

function fmt(n: number) { return n.toLocaleString('id-ID') }

interface Props {
  data: InstagramRow[]
  brand: Brand
  onUpload: (file: File) => Promise<void>
}

export default function InstagramView({ data, brand, onUpload }: Props) {
  const accent = ACCENT[brand]
  const latestFollowers = data.length > 0 ? data[data.length - 1].followers : 0
  const firstFollowers = data.length > 0 ? data[0].followers : 0
  const followerGrowth = data.length > 1 ? latestFollowers - firstFollowers : 0
  const totalReach = data.reduce((s, r) => s + r.reach, 0)
  const totalImpressions = data.reduce((s, r) => s + r.impressions, 0)
  const totalEngagements = data.reduce((s, r) => s + r.engagements, 0)
  const avgEngRate = totalReach > 0 ? (totalEngagements / totalReach) * 100 : 0

  const chartData = data.slice(-30).map((r) => ({
    date: r.date,
    Followers: r.followers,
    Reach: r.reach,
    Engagements: r.engagements,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Instagram Organic</h2>
          <p className="text-sm text-gray-500">{data.length > 0 ? `${data.length} baris data` : 'Belum ada data'}</p>
        </div>
        <div className="w-72">
          <CSVUploader platform="instagram" hasData={data.length > 0} onUpload={onUpload} accent={accent} />
        </div>
      </div>

      {data.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard label="Followers" value={fmt(latestFollowers)} icon={<Users size={14} />} accent="#E1306C" />
            <MetricCard label="Follower Growth" value={(followerGrowth >= 0 ? '+' : '') + fmt(followerGrowth)} icon={<TrendingUp size={14} />} accent="#E1306C" />
            <MetricCard label="Total Reach" value={fmt(totalReach)} icon={<Eye size={14} />} accent="#E1306C" />
            <MetricCard label="Impressions" value={fmt(totalImpressions)} icon={<Activity size={14} />} accent="#E1306C" />
            <MetricCard label="Engagements" value={fmt(totalEngagements)} icon={<Heart size={14} />} accent="#E1306C" />
            <MetricCard label="Eng. Rate" value={avgEngRate.toFixed(2) + '%'} icon={<Camera size={14} />} accent="#E1306C" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Pertumbuhan Followers</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="igGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E1306C" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#E1306C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="Followers" stroke="#E1306C" fill="url(#igGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Reach & Engagements</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Reach" stroke="#E1306C" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Engagements" stroke="#833AB4" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Camera size={48} className="text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium">Belum ada data Instagram</p>
          <p className="text-gray-400 text-sm mt-1">Upload CSV export dari Meta Business Suite di atas</p>
        </div>
      )}
    </div>
  )
}

'use client'
import { TikTokOrganicRow, Brand } from '@/lib/types'
import MetricCard from '@/components/MetricCard'
import CSVUploader from '@/components/CSVUploader'
import { Music, Users, Play, Heart, MessageCircle, Share2, TrendingUp } from 'lucide-react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const ACCENT: Record<Brand, string> = { reglow: '#1C1C1C', amura: '#6B7C3D' }

function fmt(n: number) { return n.toLocaleString('id-ID') }

interface Props {
  data: TikTokOrganicRow[]
  brand: Brand
  onUpload: (file: File) => Promise<void>
}

export default function TikTokOrganicView({ data, brand, onUpload }: Props) {
  const accent = ACCENT[brand]
  const latestFollowers = data.length > 0 ? data[data.length - 1].followers : 0
  const firstFollowers = data.length > 0 ? data[0].followers : 0
  const followerGrowth = data.length > 1 ? latestFollowers - firstFollowers : 0
  const totalViews = data.reduce((s, r) => s + r.views, 0)
  const totalLikes = data.reduce((s, r) => s + r.likes, 0)
  const totalComments = data.reduce((s, r) => s + r.comments, 0)
  const totalShares = data.reduce((s, r) => s + r.shares, 0)
  const avgEngRate = totalViews > 0 ? ((totalLikes + totalComments + totalShares) / totalViews) * 100 : 0

  const chartData = data.slice(-30).map((r) => ({
    date: r.date,
    Followers: r.followers,
    Views: r.views,
    Likes: r.likes,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">TikTok Organic</h2>
          <p className="text-sm text-gray-500">{data.length > 0 ? `${data.length} baris data` : 'Belum ada data'}</p>
        </div>
        <div className="w-72">
          <CSVUploader platform="tiktok-organic" hasData={data.length > 0} onUpload={onUpload} accent={accent} />
        </div>
      </div>

      {data.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard label="Followers" value={fmt(latestFollowers)} icon={<Users size={14} />} accent="#FF0050" />
            <MetricCard label="Follower Growth" value={(followerGrowth >= 0 ? '+' : '') + fmt(followerGrowth)} icon={<TrendingUp size={14} />} accent="#FF0050" />
            <MetricCard label="Total Views" value={fmt(totalViews)} icon={<Play size={14} />} accent="#FF0050" />
            <MetricCard label="Total Likes" value={fmt(totalLikes)} icon={<Heart size={14} />} accent="#FF0050" />
            <MetricCard label="Comments" value={fmt(totalComments)} icon={<MessageCircle size={14} />} accent="#FF0050" />
            <MetricCard label="Shares" value={fmt(totalShares)} icon={<Share2 size={14} />} accent="#FF0050" />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 inline-flex items-center gap-3">
            <Music size={16} className="text-[#FF0050]" />
            <span className="text-sm font-medium text-gray-700">Avg Engagement Rate:</span>
            <span className="text-lg font-bold text-[#FF0050]">{avgEngRate.toFixed(2)}%</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Pertumbuhan Followers</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="ttGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF0050" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#FF0050" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="Followers" stroke="#FF0050" fill="url(#ttGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Views & Likes</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Views" stroke="#FF0050" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Likes" stroke="#69C9D0" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Music size={48} className="text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium">Belum ada data TikTok Organic</p>
          <p className="text-gray-400 text-sm mt-1">Upload CSV export dari TikTok Analytics di atas</p>
        </div>
      )}
    </div>
  )
}

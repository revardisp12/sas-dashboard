'use client'
import { useState } from 'react'
import { TikTokOrganicRow, Brand } from '@/lib/types'
import MetricCard from '@/components/MetricCard'
import CSVUploader from '@/components/CSVUploader'
import ManualInputModal from '@/components/ManualInputModal'
import { Music, Users, Play, Heart, MessageCircle, Share2, TrendingUp, Plus } from 'lucide-react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const PLATFORM_COLOR = '#69C9D0'
const chartStyle = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, padding: 20 }
function fmt(n: number) { return n.toLocaleString('id-ID') }

const TT_FIELDS = [
  { key: 'date', label: 'Tanggal', type: 'date' as const },
  { key: 'followers', label: 'Followers', type: 'number' as const, placeholder: '18000' },
  { key: 'views', label: 'Video Views', type: 'number' as const, placeholder: '45000' },
  { key: 'likes', label: 'Likes', type: 'number' as const, placeholder: '3200' },
  { key: 'comments', label: 'Comments', type: 'number' as const, placeholder: '180' },
  { key: 'shares', label: 'Shares', type: 'number' as const, placeholder: '95' },
]

interface Props { data: TikTokOrganicRow[]; brand: Brand; onUpload: (file: File) => Promise<void>; onManualAdd?: (rows: TikTokOrganicRow[]) => void }

export default function TikTokOrganicView({ data, brand, onUpload, onManualAdd }: Props) {
  const [modal, setModal] = useState(false)
  const latestFollowers = data.length > 0 ? data[data.length - 1].followers : 0
  const firstFollowers = data.length > 0 ? data[0].followers : 0
  const followerGrowth = data.length > 1 ? latestFollowers - firstFollowers : 0
  const totalViews = data.reduce((s, r) => s + r.views, 0)
  const totalLikes = data.reduce((s, r) => s + r.likes, 0)
  const totalComments = data.reduce((s, r) => s + r.comments, 0)
  const totalShares = data.reduce((s, r) => s + r.shares, 0)
  const avgEngRate = totalViews > 0 ? ((totalLikes + totalComments + totalShares) / totalViews) * 100 : 0
  const chartData = data.slice(-30).map(r => ({ date: r.date, Followers: r.followers, Views: r.views, Likes: r.likes }))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ background: PLATFORM_COLOR, boxShadow: `0 0 8px ${PLATFORM_COLOR}` }} />
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#4B5563' }}>TikTok Organic</span>
          </div>
          <p className="text-sm" style={{ color: '#4B5563' }}>{data.length > 0 ? `${data.length} baris data` : 'Upload CSV untuk mulai'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0"
            style={{ background: 'rgba(105,201,208,0.12)', border: '1px solid rgba(105,201,208,0.3)', color: PLATFORM_COLOR }}>
            <Plus size={14} /> Input Manual
          </button>
          <div className="w-56 flex-shrink-0">
            <CSVUploader platform="tiktok-organic" hasData={data.length > 0} onUpload={onUpload} accent={PLATFORM_COLOR} />
          </div>
        </div>
      </div>

      {data.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <MetricCard label="Followers" value={fmt(latestFollowers)} icon={<Users size={14} />} accent={PLATFORM_COLOR} />
            <MetricCard label="Growth" value={(followerGrowth >= 0 ? '+' : '') + fmt(followerGrowth)} icon={<TrendingUp size={14} />} accent="#10B981" />
            <MetricCard label="Total Views" value={fmt(totalViews)} icon={<Play size={14} />} accent="#FF0050" />
            <MetricCard label="Total Likes" value={fmt(totalLikes)} icon={<Heart size={14} />} accent={PLATFORM_COLOR} />
            <MetricCard label="Comments" value={fmt(totalComments)} icon={<MessageCircle size={14} />} accent={PLATFORM_COLOR} />
            <MetricCard label="Eng. Rate" value={avgEngRate.toFixed(2) + '%'} icon={<Share2 size={14} />} accent="#10B981" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div style={chartStyle}>
              <p className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: '#6B7280' }}>Pertumbuhan Followers</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="ttGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PLATFORM_COLOR} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={PLATFORM_COLOR} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, color: '#111827', fontSize: 11 }} />
                  <Area type="monotone" dataKey="Followers" stroke={PLATFORM_COLOR} fill="url(#ttGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={chartStyle}>
              <p className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: '#6B7280' }}>Views & Likes</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, color: '#111827', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10, color: '#6B7280' }} />
                  <Line type="monotone" dataKey="Views" stroke="#FF0050" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Likes" stroke={PLATFORM_COLOR} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(105,201,208,0.1)', border: '1px solid rgba(105,201,208,0.2)', boxShadow: '0 0 30px rgba(105,201,208,0.1)' }}>
            <Music size={28} style={{ color: PLATFORM_COLOR }} />
          </div>
          <p className="font-semibold mb-1" style={{ color: '#6B7280' }}>Belum ada data TikTok Organic</p>
          <p className="text-sm" style={{ color: '#374151' }}>Upload CSV export dari TikTok Analytics</p>
        </div>
      )}

      {modal && (
        <ManualInputModal
          title="Input Manual — TikTok Organic"
          subtitle="Tambah baris data TikTok Organic"
          brand={brand}
          fields={TT_FIELDS}
          onSave={row => {
            const r: TikTokOrganicRow = {
              date: row.date,
              followers: Number(row.followers) || 0, views: Number(row.views) || 0,
              likes: Number(row.likes) || 0, comments: Number(row.comments) || 0,
              shares: Number(row.shares) || 0,
            }
            onManualAdd?.([r]); setModal(false)
          }}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  )
}

'use client'
import { useState } from 'react'
import { TikTokOrganicRow, Brand } from '@/lib/types'
import MetricCard from '@/components/MetricCard'
import ManualInputModal from '@/components/ManualInputModal'
import PlatformViewShell from '@/components/platforms/PlatformViewShell'
import { Music, Users, Play, Heart, MessageCircle, Share2, TrendingUp } from 'lucide-react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { fmtNum } from '@/lib/utils'

const PLATFORM_COLOR = '#69C9D0'
const PLATFORM_RGB = '105,201,208'
const chartStyle = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, padding: 20 }

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
    <PlatformViewShell
      platformName="TikTok Organic"
      platformKey="tiktok-organic"
      accent={PLATFORM_COLOR}
      accentRgb={PLATFORM_RGB}
      emptyIcon={<Music size={28} style={{ color: PLATFORM_COLOR }} />}
      emptyTitle="Belum ada data TikTok Organic"
      emptyDescription="Upload CSV export dari TikTok Analytics"
      rowCount={data.length}
      onUpload={onUpload}
      onManualClick={() => setModal(true)}
      modal={modal && (
        <ManualInputModal
          title="Input Manual — TikTok Organic"
          subtitle="Tambah baris data TikTok Organic"
          brand={brand}
          fields={TT_FIELDS}
          onSave={async row => {
            const r: TikTokOrganicRow = {
              date: row.date,
              followers: Number(row.followers) || 0, views: Number(row.views) || 0,
              likes: Number(row.likes) || 0, comments: Number(row.comments) || 0,
              shares: Number(row.shares) || 0,
            }
            await onManualAdd?.([r])
            setModal(false)
          }}
          onClose={() => setModal(false)}
        />
      )}
    >
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <MetricCard label="Followers" value={fmtNum(latestFollowers)} icon={<Users size={14} />} accent={PLATFORM_COLOR} />
        <MetricCard label="Growth" value={(followerGrowth >= 0 ? '+' : '') + fmtNum(followerGrowth)} icon={<TrendingUp size={14} />} accent="#10B981" />
        <MetricCard label="Total Views" value={fmtNum(totalViews)} icon={<Play size={14} />} accent="#FF0050" />
        <MetricCard label="Total Likes" value={fmtNum(totalLikes)} icon={<Heart size={14} />} accent={PLATFORM_COLOR} />
        <MetricCard label="Comments" value={fmtNum(totalComments)} icon={<MessageCircle size={14} />} accent={PLATFORM_COLOR} />
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
    </PlatformViewShell>
  )
}

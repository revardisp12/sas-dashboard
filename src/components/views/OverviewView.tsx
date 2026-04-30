'use client'
import { BrandData, Brand, Timeframe } from '@/lib/types'
import { filterByDays, fmtCurrency, fmtNum } from '@/lib/utils'
import { BarChart2, Target, ShoppingBag, Camera, Music, DollarSign, TrendingUp, ShoppingCart, Users } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const chartStyle = { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20 }

interface Props { data: BrandData; brand: Brand; timeframe: Timeframe }

export default function OverviewView({ data, brand, timeframe }: Props) {
  const ga = filterByDays(data.googleAds, timeframe)
  const meta = filterByDays(data.metaAds, timeframe)
  const tts = filterByDays(data.tiktokShop, timeframe)
  const ig = filterByDays(data.instagram, timeframe)
  const tt = filterByDays(data.tiktokOrganic, timeframe)
  const sales = filterByDays(data.sales, timeframe)

  const totalSpend = ga.reduce((s, r) => s + r.spend, 0) + meta.reduce((s, r) => s + r.spend, 0)
  const totalRevenue = sales.reduce((s, r) => s + r.revenue, 0) + tts.reduce((s, r) => s + r.gmv, 0)
  const totalOrders = tts.reduce((s, r) => s + r.orders, 0) + sales.reduce((s, r) => s + r.qty, 0)
  const blendedRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0
  const totalImpressions = ga.reduce((s, r) => s + r.impressions, 0) + meta.reduce((s, r) => s + r.impressions, 0)

  const igFollowers = ig.length > 0 ? ig[ig.length - 1].followers : 0
  const ttFollowers = tt.length > 0 ? tt[tt.length - 1].followers : 0
  const ttViews = tt.reduce((s, r) => s + r.views, 0)

  // Spend trend - combine all dates
  const allDates = [...new Set([
    ...ga.map(r => r.date),
    ...meta.map(r => r.date),
  ])].sort()
  const spendTrend = allDates.slice(-30).map(date => ({
    date,
    'Google Ads': ga.filter(r => r.date === date).reduce((s, r) => s + r.spend, 0),
    'Meta Ads': meta.filter(r => r.date === date).reduce((s, r) => s + r.spend, 0),
  }))

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Total Ad Spend" value={fmtCurrency(totalSpend)} icon={<DollarSign size={16} />} color="#F07830" />
        <KpiCard label="Total Revenue" value={fmtCurrency(totalRevenue)} icon={<TrendingUp size={16} />} color="#10B981" />
        <KpiCard label="Total Orders" value={fmtNum(totalOrders)} icon={<ShoppingCart size={16} />} color="#8B5CF6" />
        <KpiCard label="Blended ROAS" value={blendedRoas > 0 ? blendedRoas.toFixed(2) + 'x' : '-'} icon={<BarChart2 size={16} />} color="#00D4FF" />
      </div>

      {/* Paid Traffic */}
      <Section title="Paid Traffic">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <PlatformCard icon={<BarChart2 size={14} />} color="#4285F4" title="Google Ads"
            items={[
              { label: 'Spend', value: fmtCurrency(ga.reduce((s, r) => s + r.spend, 0)) },
              { label: 'Impressions', value: fmtNum(ga.reduce((s, r) => s + r.impressions, 0)) },
              { label: 'Clicks', value: fmtNum(ga.reduce((s, r) => s + r.clicks, 0)) },
              { label: 'Avg ROAS', value: ga.length > 0 ? (ga.reduce((s, r) => s + r.roas, 0) / ga.length).toFixed(2) + 'x' : '-' },
            ]} empty={ga.length === 0} />
          <PlatformCard icon={<Target size={14} />} color="#1877F2" title="Meta Ads"
            items={[
              { label: 'Spend', value: fmtCurrency(meta.reduce((s, r) => s + r.spend, 0)) },
              { label: 'Reach', value: fmtNum(meta.reduce((s, r) => s + r.reach, 0)) },
              { label: 'Clicks', value: fmtNum(meta.reduce((s, r) => s + r.clicks, 0)) },
              { label: 'Avg ROAS', value: meta.length > 0 ? (meta.reduce((s, r) => s + r.roas, 0) / meta.length).toFixed(2) + 'x' : '-' },
            ]} empty={meta.length === 0} />
          <PlatformCard icon={<ShoppingBag size={14} />} color="#FF0050" title="TikTok Shop"
            items={[
              { label: 'GMV', value: fmtCurrency(tts.reduce((s, r) => s + r.gmv, 0)) },
              { label: 'Orders', value: fmtNum(tts.reduce((s, r) => s + r.orders, 0)) },
              { label: 'Units Sold', value: fmtNum(tts.reduce((s, r) => s + r.unitsSold, 0)) },
              { label: 'Avg CVR', value: tts.length > 0 ? (tts.reduce((s, r) => s + r.convRate, 0) / tts.length).toFixed(2) + '%' : '-' },
            ]} empty={tts.length === 0} />
        </div>
      </Section>

      {/* Organic */}
      <Section title="Organic Performance">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <PlatformCard icon={<Camera size={14} />} color="#E1306C" title="Instagram"
            items={[
              { label: 'Followers', value: fmtNum(igFollowers) },
              { label: 'Total Reach', value: fmtNum(ig.reduce((s, r) => s + r.reach, 0)) },
              { label: 'Impressions', value: fmtNum(ig.reduce((s, r) => s + r.impressions, 0)) },
              { label: 'Engagements', value: fmtNum(ig.reduce((s, r) => s + r.engagements, 0)) },
            ]} empty={ig.length === 0} />
          <PlatformCard icon={<Music size={14} />} color="#69C9D0" title="TikTok"
            items={[
              { label: 'Followers', value: fmtNum(ttFollowers) },
              { label: 'Total Views', value: fmtNum(ttViews) },
              { label: 'Total Likes', value: fmtNum(tt.reduce((s, r) => s + r.likes, 0)) },
              { label: 'Shares', value: fmtNum(tt.reduce((s, r) => s + r.shares, 0)) },
            ]} empty={tt.length === 0} />
        </div>
      </Section>

      {/* Sales */}
      <Section title="Sales Performance">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <MiniStat label="Revenue" value={fmtCurrency(sales.reduce((s, r) => s + r.revenue, 0))} color="#10B981" />
          <MiniStat label="Gross Profit" value={fmtCurrency(sales.reduce((s, r) => s + r.grossProfit, 0))} color="#10B981" />
          <MiniStat label="Units Sold" value={fmtNum(sales.reduce((s, r) => s + r.qty, 0))} color="#8B5CF6" />
          <MiniStat label="Total Impressions" value={fmtNum(totalImpressions)} color="#00D4FF" />
        </div>
      </Section>

      {/* Spend Trend */}
      {spendTrend.length > 0 && (
        <div style={chartStyle}>
          <p className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: '#6B7280' }}>Ad Spend Trend</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={spendTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4B5563' }} />
              <YAxis tick={{ fontSize: 9, fill: '#4B5563' }} />
              <Tooltip contentStyle={{ background: '#0E0E1C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#F0F0F5', fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#6B7280' }} />
              <Line type="monotone" dataKey="Google Ads" stroke="#4285F4" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Meta Ads" stroke="#1877F2" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {spendTrend.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Users size={40} className="mb-3" style={{ color: '#374151' }} />
          <p className="font-semibold mb-1" style={{ color: '#6B7280' }}>Upload data di masing-masing platform</p>
          <p className="text-sm" style={{ color: '#374151' }}>Overview akan terisi otomatis setelah ada data</p>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  const r = parseInt(color.slice(1, 3), 16) || 0
  const g = parseInt(color.slice(3, 5), 16) || 0
  const b = parseInt(color.slice(5, 7), 16) || 0
  return (
    <div className="rounded-2xl p-5 relative overflow-hidden"
      style={{ background: `rgba(${r},${g},${b},0.06)`, border: `1px solid rgba(${r},${g},${b},0.15)` }}>
      <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10"
        style={{ background: color, filter: 'blur(25px)', transform: 'translate(30%,-30%)' }} />
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#6B7280' }}>{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `rgba(${r},${g},${b},0.15)`, color }}>{icon}</div>
      </div>
      <p className="text-2xl font-bold" style={{ color: '#F0F0F5' }}>{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#4B5563' }}>{title}</p>
      {children}
    </div>
  )
}

function PlatformCard({ icon, color, title, items, empty }: {
  icon: React.ReactNode; color: string; title: string
  items: { label: string; value: string }[]; empty: boolean
}) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: `${color}20`, color }}>{icon}</div>
        <span className="text-sm font-semibold" style={{ color: '#9CA3AF' }}>{title}</span>
        {empty && <span className="text-[9px] px-1.5 py-0.5 rounded-full ml-auto" style={{ background: 'rgba(255,255,255,0.05)', color: '#4B5563' }}>No data</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map(item => (
          <div key={item.label}>
            <p className="text-[10px]" style={{ color: '#4B5563' }}>{item.label}</p>
            <p className="text-sm font-bold" style={{ color: empty ? '#374151' : '#F0F0F5' }}>{empty ? '-' : item.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[10px] mb-1" style={{ color: '#4B5563' }}>{label}</p>
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
    </div>
  )
}

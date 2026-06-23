'use client'
import { useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { Brand, SalesRow, Timeframe, ProductMaster } from '@/lib/types'
import type { ChannelKey } from '@/lib/channels'
import { channelLabel } from '@/lib/channels'
import { filterByDays, fmtCurrency, fmtNum, fmtCurrencyExact, fmtNumExact, fitSize } from '@/lib/utils'

interface Props {
  sales: SalesRow[]
  brand: Brand
  timeframe: Timeframe
  channel: ChannelKey
  products?: ProductMaster[]
}

export default function ChannelSalesView({ sales, timeframe, channel }: Props) {
  const rows = useMemo(
    () => filterByDays(sales.filter(r => r.channel === channel), timeframe),
    [sales, channel, timeframe],
  )

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0)
  const totalQty = rows.reduce((s, r) => s + r.qty, 0)
  const txCount = rows.length

  const topProducts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of rows) map[r.product] = (map[r.product] ?? 0) + r.revenue
    return Object.entries(map).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
  }, [rows])

  const trend = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of rows) map[r.date] = (map[r.date] ?? 0) + r.revenue
    return Object.entries(map).map(([date, revenue]) => ({ date, revenue })).sort((a, b) => a.date.localeCompare(b.date)).slice(-30)
  }, [rows])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: '#C9A96E' }} />
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{channelLabel(channel)}</h2>
        </div>
        <p style={{ color: '#6B7280', fontSize: 13 }}>{txCount.toLocaleString('id-ID')} transaksi</p>
      </div>

      {/* Metric cards: Revenue, Units, Transactions. Gross Profit/Margin intentionally omitted —
          WMS COGS is unreliable (handled in the separate margin change). */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <MetricCard label="Total Revenue" value={fmtCurrencyExact(totalRevenue)} />
        <MetricCard label="Units Sold" value={fmtNumExact(totalQty)} />
        <MetricCard label="Transaksi" value={fmtNumExact(txCount)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="Top 5 Produk (Revenue)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topProducts} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => fmtCurrency(Number(v))} />
              <Bar dataKey="revenue" fill="#C9A96E" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Revenue Trend">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => fmtNum(v)} />
              <Tooltip formatter={(v) => fmtCurrency(Number(v))} />
              <Line type="monotone" dataKey="revenue" stroke="#C9A96E" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
      <p style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</p>
      <p style={{ fontSize: fitSize(value, 24), fontWeight: 700, marginTop: 4 }}>{value}</p>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{title}</p>
      {children}
    </div>
  )
}

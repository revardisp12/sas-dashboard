'use client'
import { useMemo, useState } from 'react'
import { SalesRow, CRMRow, Brand, Timeframe } from '@/lib/types'
import { filterByDays, fmtCurrency, fmtNum } from '@/lib/utils'
import { Package, TrendingUp, Users, Repeat } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

const BRAND_COLOR: Record<Brand, string> = { reglow: '#C9A96E', amura: '#8FB050' }
const chartStyle = { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20 }

interface ProductStat {
  product: string
  totalUnits: number
  totalRevenue: number
  uniqueCustomers: number
  avgDaysBetweenPurchases: number
  speed: 'fast' | 'medium' | 'slow'
  trend: { date: string; units: number; revenue: number }[]
}

function filterCRMByDays(data: CRMRow[], days: number): CRMRow[] {
  if (days === 0 || data.length === 0) return data
  const timestamps = data.map(r => new Date(r.date).getTime()).filter(t => !isNaN(t))
  if (timestamps.length === 0) return data
  const maxDate = new Date(Math.max(...timestamps))
  const cutoff = new Date(maxDate)
  cutoff.setDate(cutoff.getDate() - days + 1)
  return data.filter(r => { const d = new Date(r.date); return !isNaN(d.getTime()) && d >= cutoff })
}

function calcProductStats(sales: SalesRow[], crm: CRMRow[], days: number): ProductStat[] {
  const filteredSales = filterByDays(sales, days as Timeframe)
  const filteredCRM = filterCRMByDays(crm, days)

  // Merge both sources into unified rows
  const unified: { date: string; product: string; qty: number; revenue: number; customer?: string }[] = [
    ...filteredSales.map(r => ({ date: r.date, product: r.product, qty: r.qty, revenue: r.revenue })),
    ...filteredCRM.map(r => ({ date: r.date, product: r.product, qty: r.qty, revenue: r.revenue, customer: r.phone || r.customerName })),
  ]

  if (unified.length === 0) return []

  const periodDays = days === 0 ? 90 : days

  const productMap: Record<string, typeof unified> = {}
  unified.forEach(r => {
    if (!r.product) return
    if (!productMap[r.product]) productMap[r.product] = []
    productMap[r.product].push(r)
  })

  return Object.entries(productMap).map(([product, rows]) => {
    const totalUnits = rows.reduce((s, r) => s + r.qty, 0)
    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0)
    const uniqueCustomers = new Set(rows.filter(r => r.customer).map(r => r.customer)).size

    // Avg days between purchases per customer (from CRM rows)
    const crmRows = rows.filter(r => r.customer)
    let avgDays = 0
    if (crmRows.length > 1) {
      const byCustomer: Record<string, string[]> = {}
      crmRows.forEach(r => {
        const k = r.customer!
        if (!byCustomer[k]) byCustomer[k] = []
        byCustomer[k].push(r.date)
      })
      const gaps: number[] = []
      Object.values(byCustomer).forEach(dates => {
        const sorted = dates.sort()
        for (let i = 1; i < sorted.length; i++) {
          const diff = (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86400000
          if (diff > 0) gaps.push(diff)
        }
      })
      avgDays = gaps.length > 0 ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : 0
    }

    // Speed: units per month
    const unitsPerMonth = (totalUnits / periodDays) * 30
    const speed: ProductStat['speed'] = unitsPerMonth >= 80 ? 'fast' : unitsPerMonth >= 30 ? 'medium' : 'slow'

    // Trend by date
    const dateMap: Record<string, { units: number; revenue: number }> = {}
    rows.forEach(r => {
      if (!dateMap[r.date]) dateMap[r.date] = { units: 0, revenue: 0 }
      dateMap[r.date].units += r.qty
      dateMap[r.date].revenue += r.revenue
    })
    const trend = Object.entries(dateMap).sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }))

    return { product, totalUnits, totalRevenue, uniqueCustomers, avgDaysBetweenPurchases: avgDays, speed, trend }
  }).sort((a, b) => b.totalUnits - a.totalUnits)
}

const SPEED_CONFIG = {
  fast:   { label: 'Fast Moving', color: '#10B981', bg: 'rgba(16,185,129,0.15)', icon: '🚀' },
  medium: { label: 'Medium',      color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', icon: '📦' },
  slow:   { label: 'Slow Moving', color: '#EF4444', bg: 'rgba(239,68,68,0.15)', icon: '🐢' },
}

const TIMEFRAME_OPTIONS = [
  { label: '30H', value: 30 }, { label: '90H', value: 90 },
  { label: '180H', value: 180 }, { label: '1 Tahun', value: 365 }, { label: 'All', value: 0 },
]

interface Props { salesData: SalesRow[]; crmData: CRMRow[]; brand: Brand; timeframe: Timeframe }

export default function ProductAnalysisView({ salesData, crmData, brand, timeframe: globalTf }: Props) {
  const accent = BRAND_COLOR[brand]
  const [localTf, setLocalTf] = useState<number>(globalTf || 90)
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)

  const stats = useMemo(() => calcProductStats(salesData, crmData, localTf), [salesData, crmData, localTf])
  const hasData = stats.length > 0

  const selected = stats.find(s => s.product === selectedProduct) || stats[0]

  const fastCount = stats.filter(s => s.speed === 'fast').length
  const slowCount = stats.filter(s => s.speed === 'slow').length
  const maxUnits = Math.max(...stats.map(s => s.totalUnits), 1)

  if (!hasData) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#4B5563' }}>Product Analysis</p>
          <p className="text-sm" style={{ color: '#374151' }}>Upload data Sales CS atau CRM untuk melihat analisis produk</p>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: `${accent}15`, border: `1px solid ${accent}30`, boxShadow: `0 0 30px ${accent}15` }}>
            <Package size={28} style={{ color: accent }} />
          </div>
          <p className="font-semibold mb-1" style={{ color: '#6B7280' }}>Belum ada data produk</p>
          <p className="text-sm" style={{ color: '#374151' }}>Upload CSV di menu Acquisition by CS atau Retention by CRM</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#4B5563' }}>Product Analysis</span>
          </div>
          <p className="text-sm" style={{ color: '#4B5563' }}>{stats.length} SKU dianalisis · dari data CS + CRM</p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {TIMEFRAME_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setLocalTf(opt.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: localTf === opt.value ? accent : 'transparent', color: localTf === opt.value ? '#08080F' : '#6B7280', boxShadow: localTf === opt.value ? `0 0 12px ${accent}60` : 'none' }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Total SKU', value: stats.length.toString(), icon: <Package size={14} />, color: accent },
          { label: 'Fast Moving', value: fastCount.toString(), icon: <TrendingUp size={14} />, color: '#10B981' },
          { label: 'Slow Moving', value: slowCount.toString(), icon: <Package size={14} />, color: '#EF4444' },
          { label: 'Top Produk', value: stats[0]?.product || '–', icon: <Repeat size={14} />, color: '#8B5CF6' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#4B5563' }}>{s.label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${s.color}20`, color: s.color }}>{s.icon}</div>
            </div>
            <p className="text-xl font-bold truncate" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Fast / Slow Moving Bar */}
      <div style={chartStyle}>
        <p className="text-xs font-semibold tracking-widest uppercase mb-5" style={{ color: '#6B7280' }}>Fast / Slow Moving Indicator</p>
        <div className="space-y-3">
          {stats.map(s => {
            const cfg = SPEED_CONFIG[s.speed]
            const pct = (s.totalUnits / maxUnits) * 100
            return (
              <div key={s.product}
                onClick={() => setSelectedProduct(s.product)}
                className="cursor-pointer group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{cfg.icon}</span>
                    <span className="text-sm font-medium" style={{ color: selectedProduct === s.product ? '#F0F0F5' : '#9CA3AF' }}>{s.product}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold" style={{ color: cfg.color }}>{fmtNum(s.totalUnits)} unit</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  </div>
                </div>
                <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: cfg.color, boxShadow: `0 0 8px ${cfg.color}60` }} />
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-[10px] mt-4" style={{ color: '#374151' }}>Threshold: 🚀 Fast &gt;80 unit/bulan · 📦 Medium 30–80 · 🐢 Slow &lt;30</p>
      </div>

      {/* Customer per SKU + Frequency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div style={chartStyle}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#6B7280' }}>Customer per Produk</p>
          {stats.some(s => s.uniqueCustomers > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: '#4B5563' }} />
                <YAxis type="category" dataKey="product" tick={{ fontSize: 9, fill: '#9CA3AF' }} width={100} />
                <Tooltip contentStyle={{ background: '#0E0E1C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#F0F0F5', fontSize: 11 }}
                  formatter={(v: unknown) => [`${v} customers`, 'Unique Customers']} />
                <Bar dataKey="uniqueCustomers" fill={accent} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40">
              <div className="text-center">
                <Users size={24} className="mx-auto mb-2" style={{ color: '#374151' }} />
                <p className="text-xs" style={{ color: '#374151' }}>Upload data CRM untuk melihat customer per produk</p>
              </div>
            </div>
          )}
        </div>

        <div style={chartStyle}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#6B7280' }}>Avg. Frekuensi Beli (hari)</p>
          {stats.some(s => s.avgDaysBetweenPurchases > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.filter(s => s.avgDaysBetweenPurchases > 0)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: '#4B5563' }} unit=" hr" />
                <YAxis type="category" dataKey="product" tick={{ fontSize: 9, fill: '#9CA3AF' }} width={100} />
                <Tooltip contentStyle={{ background: '#0E0E1C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#F0F0F5', fontSize: 11 }}
                  formatter={(v: unknown) => [`${v} hari`, 'Avg. interval beli']} />
                <Bar dataKey="avgDaysBetweenPurchases" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40">
              <div className="text-center">
                <Repeat size={24} className="mx-auto mb-2" style={{ color: '#374151' }} />
                <p className="text-xs" style={{ color: '#374151' }}>Butuh minimal 2 transaksi per customer</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Product Detail */}
      {selected && (
        <div style={chartStyle}>
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#6B7280' }}>Detail Produk</p>
              <div className="flex items-center gap-2 flex-wrap">
                {stats.map(s => (
                  <button key={s.product} onClick={() => setSelectedProduct(s.product)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: selected.product === s.product ? SPEED_CONFIG[s.speed].bg : 'rgba(255,255,255,0.04)',
                      color: selected.product === s.product ? SPEED_CONFIG[s.speed].color : '#6B7280',
                      border: selected.product === s.product ? `1px solid ${SPEED_CONFIG[s.speed].color}40` : '1px solid transparent',
                    }}>
                    {s.product}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Revenue', value: fmtCurrency(selected.totalRevenue), color: '#10B981' },
              { label: 'Units Sold', value: fmtNum(selected.totalUnits), color: accent },
              { label: 'Unique Customers', value: selected.uniqueCustomers > 0 ? fmtNum(selected.uniqueCustomers) : '–', color: '#8B5CF6' },
              { label: 'Avg. Interval Beli', value: selected.avgDaysBetweenPurchases > 0 ? `${selected.avgDaysBetweenPurchases} hari` : '–', color: '#F59E0B' },
            ].map(m => (
              <div key={m.label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] mb-1" style={{ color: '#4B5563' }}>{m.label}</p>
                <p className="text-lg font-bold" style={{ color: m.color }}>{m.value}</p>
              </div>
            ))}
          </div>

          {selected.trend.length > 1 && (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={selected.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4B5563' }} />
                <YAxis tick={{ fontSize: 9, fill: '#4B5563' }} />
                <Tooltip contentStyle={{ background: '#0E0E1C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#F0F0F5', fontSize: 11 }} />
                <Line type="monotone" dataKey="units" stroke={accent} strokeWidth={2} dot={false} name="Units" />
                <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} dot={false} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  )
}

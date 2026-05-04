'use client'
import { useMemo, useState } from 'react'
import { SalesRow, CRMRow, Brand, Timeframe, ProductMaster, BundleMaster } from '@/lib/types'
import { filterByDays, fmtCurrency, fmtNum } from '@/lib/utils'
import { Package, TrendingUp, Users, Repeat } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, Legend } from 'recharts'

const BRAND_COLOR: Record<Brand, string> = { reglow: '#C9A96E', amura: '#8FB050' }
const chartStyle = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, padding: 20 }

interface ProductStat {
  product: string
  totalUnits: number
  totalRevenue: number
  uniqueCustomers: number
  avgDaysBetweenPurchases: number
  speed: 'fast' | 'medium' | 'slow'
  trend: { date: string; units: number; revenue: number }[]
}

interface ResolvedLabel {
  label: string
  isBundle: boolean
  components?: string[]
}

function resolveLabel(
  productStr: string,
  brandProducts: ProductMaster[],
  brandBundles: BundleMaster[],
): ResolvedLabel {
  // 1. Direct bundle name match (from CS manual input)
  const bundleByName = brandBundles.find(b => b.name === productStr)
  if (bundleByName) {
    return {
      label: bundleByName.name,
      isBundle: true,
      components: bundleByName.components.map(c => {
        const p = brandProducts.find(p => p.sku === c.sku)
        return `${c.qty}× ${p ? p.name : c.sku}`
      }),
    }
  }

  // 2. Single SKU lookup
  const singleProduct = brandProducts.find(p => p.sku === productStr)
  if (singleProduct) return { label: singleProduct.name, isBundle: false }

  // 3. Parse "N SKU, N SKU, ..." format (from CSV upload)
  const parts = productStr.split(',').map(p => p.trim()).filter(Boolean)
  const parsed = parts.map(part => {
    const match = part.match(/^(\d+)\s+(.+)$/)
    return match ? { qty: parseInt(match[1]), sku: match[2].trim() } : null
  }).filter((p): p is { qty: number; sku: string } => p !== null)

  if (parsed.length > 0) {
    // Try bundle matching by SKU set
    const skuSet = new Set(parsed.map(p => p.sku))
    const matchedBundle = brandBundles.find(b => {
      const bundleSkuSet = new Set(b.components.map(c => c.sku))
      return skuSet.size === bundleSkuSet.size && [...skuSet].every(sku => bundleSkuSet.has(sku))
    })

    if (matchedBundle) {
      return {
        label: matchedBundle.name,
        isBundle: true,
        components: matchedBundle.components.map(c => {
          const p = brandProducts.find(p => p.sku === c.sku)
          return `${c.qty}× ${p ? p.name : c.sku}`
        }),
      }
    }

    // Opsi B: resolve each SKU to name, show primary + "+N lainnya"
    const resolvedNames = parsed.map(p => {
      const product = brandProducts.find(prod => prod.sku === p.sku)
      return product ? product.name : p.sku
    })

    if (resolvedNames.length === 1) {
      return { label: resolvedNames[0], isBundle: false }
    }

    return {
      label: `${resolvedNames[0]} +${resolvedNames.length - 1} lainnya`,
      isBundle: false,
      components: parsed.map((p, i) => `${p.qty}× ${resolvedNames[i]}`),
    }
  }

  // 4. Fallback — show as-is
  return { label: productStr, isBundle: false }
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

    const unitsPerMonth = (totalUnits / periodDays) * 30
    const speed: ProductStat['speed'] = unitsPerMonth >= 80 ? 'fast' : unitsPerMonth >= 30 ? 'medium' : 'slow'

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

interface Props {
  salesData: SalesRow[]
  crmData: CRMRow[]
  brand: Brand
  timeframe: Timeframe
  products: ProductMaster[]
  bundles: BundleMaster[]
}

export default function ProductAnalysisView({ salesData, crmData, brand, timeframe: globalTf, products, bundles }: Props) {
  const accent = BRAND_COLOR[brand]
  const [localTf, setLocalTf] = useState<number>(globalTf || 90)
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null)
  const [speedFilter, setSpeedFilter] = useState<'fast' | 'medium' | 'slow'>('fast')

  const brandProducts = products.filter(p => p.brand === brand)
  const brandBundles = bundles.filter(b => b.brand === brand)

  const stats = useMemo(() => calcProductStats(salesData, crmData, localTf), [salesData, crmData, localTf])
  const hasData = stats.length > 0

  const selected = stats.find(s => s.product === selectedProduct) || stats[0]

  const fastCount = stats.filter(s => s.speed === 'fast').length
  const mediumCount = stats.filter(s => s.speed === 'medium').length
  const slowCount = stats.filter(s => s.speed === 'slow').length
  const maxUnits = Math.max(...stats.map(s => s.totalUnits), 1)

  const filteredStats = stats.filter(s => s.speed === speedFilter)
  const maxFilteredUnits = Math.max(...filteredStats.map(s => s.totalUnits), 1)

  const revenueBySegment = [
    { name: 'Fast Moving', value: stats.filter(s => s.speed === 'fast').reduce((sum, s) => sum + s.totalRevenue, 0), color: '#10B981' },
    { name: 'Medium', value: stats.filter(s => s.speed === 'medium').reduce((sum, s) => sum + s.totalRevenue, 0), color: '#F59E0B' },
    { name: 'Slow Moving', value: stats.filter(s => s.speed === 'slow').reduce((sum, s) => sum + s.totalRevenue, 0), color: '#EF4444' },
  ].filter(d => d.value > 0)

  const totalRevenue = revenueBySegment.reduce((s, d) => s + d.value, 0)

  const getResolved = (product: string) => resolveLabel(product, brandProducts, brandBundles)

  // Build display name map for chart axes
  const statsWithDisplay = stats.map(s => ({
    ...s,
    displayName: getResolved(s.product).label,
  }))

  const scatterData = {
    fast: statsWithDisplay.filter(s => s.speed === 'fast').map(s => ({ x: s.totalUnits, y: s.totalRevenue, name: s.displayName })),
    medium: statsWithDisplay.filter(s => s.speed === 'medium').map(s => ({ x: s.totalUnits, y: s.totalRevenue, name: s.displayName })),
    slow: statsWithDisplay.filter(s => s.speed === 'slow').map(s => ({ x: s.totalUnits, y: s.totalRevenue, name: s.displayName })),
  }

  if (!hasData) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#4B5563' }}>Product Analysis</p>
          <p className="text-sm" style={{ color: '#374151' }}>Upload data Sales CS atau CRM untuk melihat analisis produk</p>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
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
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
          {TIMEFRAME_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setLocalTf(opt.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: localTf === opt.value ? accent : 'transparent', color: localTf === opt.value ? '#FFFFFF' : '#6B7280', boxShadow: localTf === opt.value ? `0 0 12px ${accent}60` : 'none' }}>
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
          { label: 'Top Produk', value: stats[0] ? getResolved(stats[0].product).label : '–', icon: <Repeat size={14} />, color: '#8B5CF6' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#4B5563' }}>{s.label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${s.color}20`, color: s.color }}>{s.icon}</div>
            </div>
            <p className="text-xl font-bold truncate" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Fast / Slow Moving Indicator */}
      <div style={chartStyle}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#6B7280' }}>Fast / Slow Moving Indicator</p>
          <div className="flex items-center gap-1.5">
            {(['fast', 'medium', 'slow'] as const).map(sp => {
              const cfg = SPEED_CONFIG[sp]
              const count = sp === 'fast' ? fastCount : sp === 'medium' ? mediumCount : slowCount
              return (
                <button key={sp} onClick={() => setSpeedFilter(sp)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                  style={{
                    background: speedFilter === sp ? cfg.bg : '#F9FAFB',
                    color: speedFilter === sp ? cfg.color : '#9CA3AF',
                    border: speedFilter === sp ? `1px solid ${cfg.color}40` : '1px solid transparent',
                  }}>
                  {cfg.icon} {cfg.label} <span className="opacity-70">({count})</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-3">
          {filteredStats.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: '#9CA3AF' }}>
              Tidak ada produk di segment ini
            </p>
          ) : filteredStats.map(s => {
            const cfg = SPEED_CONFIG[s.speed]
            const pct = (s.totalUnits / maxFilteredUnits) * 100
            const resolved = getResolved(s.product)
            const isHovered = hoveredProduct === s.product

            return (
              <div key={s.product}
                onClick={() => setSelectedProduct(s.product)}
                onMouseEnter={() => setHoveredProduct(s.product)}
                onMouseLeave={() => setHoveredProduct(null)}
                className="cursor-pointer group relative">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs flex-shrink-0">{cfg.icon}</span>
                    <span className="text-sm font-medium truncate" style={{ color: selectedProduct === s.product ? '#111827' : '#9CA3AF' }}>
                      {resolved.label}
                    </span>
                    {resolved.components && (
                      <span className="text-[10px] flex-shrink-0" style={{ color: '#D1D5DB' }}>ⓘ</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className="text-xs font-bold" style={{ color: cfg.color }}>{fmtNum(s.totalUnits)} unit</span>
                    <span className="text-xs font-medium" style={{ color: '#9CA3AF' }}>{fmtCurrency(s.totalRevenue)}</span>
                  </div>
                </div>
                <div className="rounded-full overflow-hidden" style={{ height: 6, background: '#F9FAFB' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: cfg.color, boxShadow: `0 0 8px ${cfg.color}60` }} />
                </div>

                {isHovered && resolved.components && resolved.components.length > 0 && (
                  <div className="absolute left-0 bottom-full mb-2 z-20 rounded-xl shadow-lg pointer-events-none"
                    style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', padding: '10px 14px', minWidth: 180 }}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#9CA3AF' }}>
                      {resolved.isBundle ? '📦 Bundle Detail' : 'Komponen'}
                    </p>
                    {resolved.components.map((c, i) => (
                      <p key={i} className="text-xs" style={{ color: '#374151' }}>{c}</p>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-[10px] mt-4" style={{ color: '#374151' }}>Threshold: 🚀 Fast &gt;80 unit/bulan · 📦 Medium 30–80 · 🐢 Slow &lt;30</p>
      </div>

      {/* Revenue by Segment (Donut) + Units vs Revenue (Scatter) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut — Revenue Contribution */}
        <div style={chartStyle}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#6B7280' }}>Revenue Contribution by Segment</p>
          {revenueBySegment.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={180}>
                <PieChart>
                  <Pie data={revenueBySegment} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    dataKey="value" stroke="none">
                    {revenueBySegment.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 11 }}
                    formatter={(val: unknown) => [fmtCurrency(val as number), '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2.5 flex-1">
                {revenueBySegment.map(d => (
                  <div key={d.name}>
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                        <span className="text-xs" style={{ color: '#6B7280' }}>{d.name}</span>
                      </div>
                      <span className="text-xs font-bold" style={{ color: d.color }}>
                        {totalRevenue > 0 ? ((d.value / totalRevenue) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <p className="text-[10px] pl-3.5" style={{ color: '#9CA3AF' }}>{fmtCurrency(d.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40">
              <p className="text-xs" style={{ color: '#9CA3AF' }}>Belum ada data revenue</p>
            </div>
          )}
        </div>

        {/* Scatter — Units vs Revenue */}
        <div style={chartStyle}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#6B7280' }}>Units vs Revenue per Produk</p>
          {stats.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <ScatterChart margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis type="number" dataKey="x" name="Units" tick={{ fontSize: 9, fill: '#4B5563' }} label={{ value: 'Units', position: 'insideBottom', offset: -2, fontSize: 9, fill: '#9CA3AF' }} />
                <YAxis type="number" dataKey="y" name="Revenue" tick={{ fontSize: 9, fill: '#4B5563' }} tickFormatter={v => `${(v / 1000000).toFixed(0)}jt`} />
                <ZAxis range={[40, 40]} />
                <Tooltip
                  contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 11 }}
                  content={({ payload }) => {
                    if (!payload?.length) return null
                    const d = payload[0].payload
                    return (
                      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px' }}>
                        <p className="font-semibold text-xs mb-1" style={{ color: '#111827' }}>{d.name}</p>
                        <p className="text-xs" style={{ color: '#6B7280' }}>Units: <strong>{fmtNum(d.x)}</strong></p>
                        <p className="text-xs" style={{ color: '#6B7280' }}>Revenue: <strong>{fmtCurrency(d.y)}</strong></p>
                      </div>
                    )
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                <Scatter name="Fast" data={scatterData.fast} fill="#10B981" opacity={0.85} />
                <Scatter name="Medium" data={scatterData.medium} fill="#F59E0B" opacity={0.85} />
                <Scatter name="Slow" data={scatterData.slow} fill="#EF4444" opacity={0.5} />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40">
              <p className="text-xs" style={{ color: '#9CA3AF' }}>Belum ada data</p>
            </div>
          )}
        </div>
      </div>

      {/* Customer per SKU + Frequency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div style={chartStyle}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#6B7280' }}>Customer per Produk</p>
          {statsWithDisplay.some(s => s.uniqueCustomers > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statsWithDisplay} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: '#4B5563' }} />
                <YAxis type="category" dataKey="displayName" tick={{ fontSize: 9, fill: '#9CA3AF' }} width={100} />
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, color: '#111827', fontSize: 11 }}
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
          {statsWithDisplay.some(s => s.avgDaysBetweenPurchases > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statsWithDisplay.filter(s => s.avgDaysBetweenPurchases > 0)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: '#4B5563' }} unit=" hr" />
                <YAxis type="category" dataKey="displayName" tick={{ fontSize: 9, fill: '#9CA3AF' }} width={100} />
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, color: '#111827', fontSize: 11 }}
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
          <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
            <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#6B7280' }}>Detail Produk</p>
            <select
              value={selectedProduct ?? selected.product}
              onChange={e => setSelectedProduct(e.target.value)}
              className="flex-1 max-w-sm px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827', minWidth: 200 }}>
              {stats.map(s => {
                const r = getResolved(s.product)
                const cfg = SPEED_CONFIG[s.speed]
                return (
                  <option key={s.product} value={s.product}>
                    {cfg.icon} {r.label} — {fmtNum(s.totalUnits)} unit
                  </option>
                )
              })}
            </select>
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background: SPEED_CONFIG[selected.speed].bg, color: SPEED_CONFIG[selected.speed].color }}>
              {SPEED_CONFIG[selected.speed].icon} {SPEED_CONFIG[selected.speed].label}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Revenue', value: fmtCurrency(selected.totalRevenue), color: '#10B981' },
              { label: 'Units Sold', value: fmtNum(selected.totalUnits), color: accent },
              { label: 'Unique Customers', value: selected.uniqueCustomers > 0 ? fmtNum(selected.uniqueCustomers) : '–', color: '#8B5CF6' },
              { label: 'Avg. Interval Beli', value: selected.avgDaysBetweenPurchases > 0 ? `${selected.avgDaysBetweenPurchases} hari` : '–', color: '#F59E0B' },
            ].map(m => (
              <div key={m.label} className="rounded-xl p-3" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                <p className="text-[10px] mb-1" style={{ color: '#4B5563' }}>{m.label}</p>
                <p className="text-lg font-bold" style={{ color: m.color }}>{m.value}</p>
              </div>
            ))}
          </div>

          {selected.trend.length > 1 && (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={selected.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4B5563' }} />
                <YAxis tick={{ fontSize: 9, fill: '#4B5563' }} />
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, color: '#111827', fontSize: 11 }} />
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

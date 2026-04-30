'use client'
import { useState, useMemo } from 'react'
import { CRMRow, Brand, CRMTimeframe, CustomerRFM, RFMSegment } from '@/lib/types'
import { fmtCurrency, fmtNum } from '@/lib/utils'
import CSVUploader from '@/components/CSVUploader'
import { Users, X, Phone, Calendar, ShoppingBag, TrendingUp } from 'lucide-react'

const BRAND_COLOR: Record<Brand, string> = { reglow: '#C9A96E', amura: '#8FB050' }

const SEGMENT_CONFIG: Record<RFMSegment, { color: string; bg: string; description: string }> = {
  'Champions':          { color: '#10B981', bg: 'rgba(16,185,129,0.15)',  description: 'Beli baru-baru ini, sering, & nilai tinggi' },
  'Loyal Customers':    { color: '#3B82F6', bg: 'rgba(59,130,246,0.15)',  description: 'Beli rutin dengan nilai yang baik' },
  'Potential Loyalist': { color: '#00D4FF', bg: 'rgba(0,212,255,0.15)',   description: 'Customer baru dengan potensi jadi loyal' },
  'New Customers':      { color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)', description: 'Baru pertama kali beli' },
  'Promising':          { color: '#A78BFA', bg: 'rgba(167,139,250,0.15)', description: 'Baru beli, belum terlalu sering' },
  'Need Attention':     { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)',  description: 'Perlu perhatian sebelum churn' },
  'About to Sleep':     { color: '#F07830', bg: 'rgba(240,120,48,0.15)',  description: 'Mulai jarang beli, perlu di-reactivate' },
  "Can't Lose Them":    { color: '#EF4444', bg: 'rgba(239,68,68,0.15)',   description: 'Dulu champion, sekarang pergi — urgensi tinggi' },
  'At Risk':            { color: '#F87171', bg: 'rgba(248,113,113,0.15)', description: 'Belanja besar tapi sudah lama tidak beli' },
  'Hibernating':        { color: '#6B7280', bg: 'rgba(107,114,128,0.15)', description: 'Sudah sangat lama tidak ada aktivitas' },
}

// Segment dari R & F score
function getSegment(r: number, f: number): RFMSegment {
  if (r >= 4 && f >= 4) return 'Champions'
  if (r >= 3 && f >= 3) return 'Loyal Customers'
  if (f >= 4 && r <= 2) return "Can't Lose Them"
  if (r <= 2 && f >= 3) return 'At Risk'
  if (r >= 3 && f <= 2) return 'Potential Loyalist'
  if (r === 5 && f === 1) return 'New Customers'
  if (r === 4 && f <= 2) return 'Promising'
  if (r === 3 && f === 3) return 'Need Attention'
  if (r <= 2 && f <= 2) return 'About to Sleep'
  return 'Hibernating'
}

function scoreQuintile(value: number, sorted: number[], reverse = false): number {
  if (sorted.length === 0) return 1
  const idx = sorted.findIndex(v => v >= value)
  const pos = idx === -1 ? sorted.length - 1 : idx
  const pct = pos / (sorted.length - 1 || 1)
  const score = Math.ceil(pct * 4) + 1
  const clamped = Math.min(5, Math.max(1, score))
  return reverse ? 6 - clamped : clamped
}

function filterByDaysCRM(data: CRMRow[], days: CRMTimeframe): CRMRow[] {
  if (days === 0 || data.length === 0) return data
  const timestamps = data.map(r => new Date(r.date).getTime()).filter(t => !isNaN(t))
  if (timestamps.length === 0) return data
  const maxDate = new Date(Math.max(...timestamps))
  const cutoff = new Date(maxDate)
  cutoff.setDate(cutoff.getDate() - days + 1)
  return data.filter(r => { const d = new Date(r.date); return !isNaN(d.getTime()) && d >= cutoff })
}

function calcRFM(data: CRMRow[]): CustomerRFM[] {
  if (data.length === 0) return []

  const timestamps = data.map(r => new Date(r.date).getTime()).filter(t => !isNaN(t))
  const maxDate = new Date(Math.max(...timestamps))

  // Group by customer (phone as key, fallback to name)
  const customerMap: Record<string, CRMRow[]> = {}
  data.forEach(r => {
    const key = r.phone || r.customerName
    if (!customerMap[key]) customerMap[key] = []
    customerMap[key].push(r)
  })

  const raw = Object.entries(customerMap).map(([, txns]) => {
    const sorted = [...txns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const lastDate = new Date(sorted[0].date)
    const recencyDays = Math.max(0, Math.floor((maxDate.getTime() - lastDate.getTime()) / 86400000))
    const frequency = txns.length
    const monetary = txns.reduce((s, r) => s + r.revenue, 0)
    return { customerName: txns[0].customerName, phone: txns[0].phone, lastOrderDate: sorted[0].date, recencyDays, frequency, monetary, transactions: sorted }
  })

  // Sort for quintile scoring
  const recencySorted = [...raw.map(r => r.recencyDays)].sort((a, b) => a - b)
  const freqSorted = [...raw.map(r => r.frequency)].sort((a, b) => a - b)
  const monSorted = [...raw.map(r => r.monetary)].sort((a, b) => a - b)

  return raw.map(r => {
    const rScore = scoreQuintile(r.recencyDays, recencySorted, true) // lower recency = higher score
    const fScore = scoreQuintile(r.frequency, freqSorted)
    const mScore = scoreQuintile(r.monetary, monSorted)
    return { ...r, rScore, fScore, mScore, segment: getSegment(rScore, fScore) }
  })
}

const TIMEFRAME_OPTIONS: { label: string; value: CRMTimeframe }[] = [
  { label: '30H', value: 30 },
  { label: '90H', value: 90 },
  { label: '180H', value: 180 },
  { label: '1 Tahun', value: 365 },
  { label: 'All', value: 0 },
]

interface Props { data: CRMRow[]; brand: Brand; onUpload: (file: File) => Promise<void> }

export default function CRMView({ data, brand, onUpload }: Props) {
  const accent = BRAND_COLOR[brand]
  const [timeframe, setTimeframe] = useState<CRMTimeframe>(90)
  const [selectedSegment, setSelectedSegment] = useState<RFMSegment | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRFM | null>(null)
  const [page, setPage] = useState(1)
  const PER_PAGE = 10

  const filtered = useMemo(() => filterByDaysCRM(data, timeframe), [data, timeframe])
  const customers = useMemo(() => calcRFM(filtered), [filtered])

  // Build 5x5 matrix count
  const matrixCount: Record<string, number> = {}
  customers.forEach(c => {
    const key = `${c.rScore}-${c.fScore}`
    matrixCount[key] = (matrixCount[key] || 0) + 1
  })

  // Segment counts
  const segmentCounts: Record<RFMSegment, number> = {} as Record<RFMSegment, number>
  customers.forEach(c => { segmentCounts[c.segment] = (segmentCounts[c.segment] || 0) + 1 })

  const displayedCustomers = selectedSegment
    ? customers.filter(c => c.segment === selectedSegment)
    : customers

  const totalPages = Math.ceil(displayedCustomers.length / PER_PAGE)
  const pageCustomers = displayedCustomers.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  function selectSegment(seg: RFMSegment | null) {
    setSelectedSegment(seg)
    setPage(1)
  }

  if (data.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#4B5563' }}>Sales Retention by CRM</p>
            <p className="text-sm" style={{ color: '#4B5563' }}>Upload data transaksi CS untuk mulai analisis RFM</p>
          </div>
          <div className="w-56 flex-shrink-0">
            <CSVUploader platform="crm" hasData={false} onUpload={onUpload} accent={accent} />
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: `${accent}15`, border: `1px solid ${accent}30`, boxShadow: `0 0 30px ${accent}15` }}>
            <Users size={28} style={{ color: accent }} />
          </div>
          <p className="font-semibold mb-1" style={{ color: '#6B7280' }}>Belum ada data CRM</p>
          <p className="text-sm mb-1" style={{ color: '#374151' }}>Upload CSV transaksi customer dari CS</p>
          <p className="text-xs" style={{ color: '#1F2937' }}>Format: Date, Customer Name, Phone, Product, Qty, Revenue</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#4B5563' }}>Sales Retention by CRM</span>
          </div>
          <p className="text-sm" style={{ color: '#4B5563' }}>{customers.length} customers dianalisis</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Timeframe */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {TIMEFRAME_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setTimeframe(opt.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: timeframe === opt.value ? accent : 'transparent',
                  color: timeframe === opt.value ? '#08080F' : '#6B7280',
                  boxShadow: timeframe === opt.value ? `0 0 12px ${accent}60` : 'none',
                }}>
                {opt.label}
              </button>
            ))}
          </div>
          <div className="w-48 flex-shrink-0">
            <CSVUploader platform="crm" hasData={data.length > 0} onUpload={onUpload} accent={accent} />
          </div>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Total Customers', value: fmtNum(customers.length), color: accent },
          { label: 'Champions', value: fmtNum(segmentCounts['Champions'] || 0), color: '#10B981' },
          { label: 'At Risk', value: fmtNum((segmentCounts['At Risk'] || 0) + (segmentCounts["Can't Lose Them"] || 0)), color: '#EF4444' },
          { label: 'Total Revenue', value: fmtCurrency(customers.reduce((s, c) => s + c.monetary, 0)), color: '#8B5CF6' },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: '#4B5563' }}>{stat.label}</p>
            <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* RFM Matrix + Legend */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Matrix */}
        <div className="lg:col-span-3 rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#6B7280' }}>RFM Matrix</p>
          <div className="flex gap-3">
            {/* Y-axis label */}
            <div className="flex items-center justify-center" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
              <span className="text-[9px] tracking-widest uppercase" style={{ color: '#374151' }}>Frequency ↑</span>
            </div>
            <div className="flex-1">
              <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                {[5, 4, 3, 2, 1].map(fScore =>
                  [1, 2, 3, 4, 5].map(rScore => {
                    const key = `${rScore}-${fScore}`
                    const count = matrixCount[key] || 0
                    const seg = getSegment(rScore, fScore)
                    const cfg = SEGMENT_CONFIG[seg]
                    const isSelected = selectedSegment === seg
                    const pct = customers.length > 0 ? ((count / customers.length) * 100).toFixed(0) : '0'
                    return (
                      <button key={key}
                        onClick={() => selectSegment(isSelected ? null : seg)}
                        className="rounded-lg flex flex-col items-center justify-center transition-all"
                        style={{
                          aspectRatio: '1',
                          background: count > 0 ? cfg.bg : 'rgba(255,255,255,0.02)',
                          border: isSelected ? `2px solid ${cfg.color}` : `1px solid ${count > 0 ? cfg.color + '30' : 'rgba(255,255,255,0.04)'}`,
                          boxShadow: isSelected ? `0 0 16px ${cfg.color}40` : 'none',
                          opacity: selectedSegment && !isSelected ? 0.4 : 1,
                        }}>
                        {count > 0 ? (
                          <>
                            <span className="text-xs font-bold leading-none" style={{ color: cfg.color }}>{pct}%</span>
                            <span className="text-[9px] leading-none mt-0.5" style={{ color: cfg.color + 'aa' }}>{count}</span>
                          </>
                        ) : (
                          <span style={{ color: 'rgba(255,255,255,0.08)', fontSize: 10 }}>–</span>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
              {/* X-axis labels */}
              <div className="grid mt-1" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                {[1, 2, 3, 4, 5].map(r => (
                  <div key={r} className="text-center">
                    <span className="text-[9px]" style={{ color: '#374151' }}>{r}</span>
                  </div>
                ))}
              </div>
              <p className="text-center text-[9px] tracking-widest uppercase mt-1" style={{ color: '#374151' }}>Recency →</p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="lg:col-span-2 rounded-2xl p-5 space-y-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#6B7280' }}>Segments</p>
          {(Object.entries(SEGMENT_CONFIG) as [RFMSegment, typeof SEGMENT_CONFIG[RFMSegment]][]).map(([seg, cfg]) => {
            const count = segmentCounts[seg] || 0
            const pct = customers.length > 0 ? (count / customers.length) * 100 : 0
            const isSelected = selectedSegment === seg
            return (
              <button key={seg} onClick={() => selectSegment(isSelected ? null : seg)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left"
                style={{
                  background: isSelected ? cfg.bg : 'transparent',
                  border: isSelected ? `1px solid ${cfg.color}40` : '1px solid transparent',
                  opacity: selectedSegment && !isSelected ? 0.4 : 1,
                }}>
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: cfg.color }} />
                <span className="text-xs flex-1" style={{ color: isSelected ? '#F0F0F5' : '#9CA3AF' }}>{seg}</span>
                <span className="text-xs font-bold" style={{ color: cfg.color }}>{count}</span>
                <div className="w-12 h-1.5 rounded-full overflow-hidden flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cfg.color }} />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Customer Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#6B7280' }}>Customer List</p>
            {selectedSegment && (
              <button onClick={() => selectSegment(null)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all"
                style={{ background: SEGMENT_CONFIG[selectedSegment].bg, color: SEGMENT_CONFIG[selectedSegment].color, border: `1px solid ${SEGMENT_CONFIG[selectedSegment].color}40` }}>
                {selectedSegment} <X size={10} />
              </button>
            )}
            <span className="text-[10px]" style={{ color: '#4B5563' }}>{displayedCustomers.length} customers</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {['Nama', 'No HP', 'Last Buy', 'Orders', 'Total Spend', 'R', 'F', 'M', 'Segment'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageCustomers.map((c, i) => {
                const cfg = SEGMENT_CONFIG[c.segment]
                return (
                  <tr key={i}
                    onClick={() => setSelectedCustomer(c)}
                    className="cursor-pointer transition-all"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: '#F0F0F5' }}>{c.customerName}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#6B7280' }}>{c.phone || '–'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#6B7280' }}>{c.lastOrderDate}</td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: '#F0F0F5' }}>{c.frequency}x</td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: '#10B981' }}>{fmtCurrency(c.monetary)}</td>
                    <td className="px-4 py-3"><ScoreBadge score={c.rScore} /></td>
                    <td className="px-4 py-3"><ScoreBadge score={c.fScore} /></td>
                    <td className="px-4 py-3"><ScoreBadge score={c.mScore} /></td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-[10px] font-semibold"
                        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                        {c.segment}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <span className="text-[10px]" style={{ color: '#4B5563' }}>
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, displayedCustomers.length)} of {displayedCustomers.length}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 rounded-lg text-xs transition-all disabled:opacity-30"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#9CA3AF' }}>← Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 rounded-lg text-xs transition-all disabled:opacity-30"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#9CA3AF' }}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setSelectedCustomer(null)}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden"
            style={{ background: '#0E0E1C', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
            onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-start justify-between p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold" style={{ color: '#F0F0F5' }}>{selectedCustomer.customerName}</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{ background: SEGMENT_CONFIG[selectedCustomer.segment].bg, color: SEGMENT_CONFIG[selectedCustomer.segment].color }}>
                    {selectedCustomer.segment}
                  </span>
                </div>
                <p className="text-xs" style={{ color: '#6B7280' }}>{SEGMENT_CONFIG[selectedCustomer.segment].description}</p>
              </div>
              <button onClick={() => setSelectedCustomer(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#6B7280' }}>
                <X size={14} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Info + scores */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Phone size={12} style={{ color: '#4B5563' }} />
                  <span className="text-sm" style={{ color: '#9CA3AF' }}>{selectedCustomer.phone || '–'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={12} style={{ color: '#4B5563' }} />
                  <span className="text-sm" style={{ color: '#9CA3AF' }}>Last: {selectedCustomer.lastOrderDate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShoppingBag size={12} style={{ color: '#4B5563' }} />
                  <span className="text-sm" style={{ color: '#9CA3AF' }}>{selectedCustomer.frequency}x pembelian</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp size={12} style={{ color: '#4B5563' }} />
                  <span className="text-sm font-bold" style={{ color: '#10B981' }}>{fmtCurrency(selectedCustomer.monetary)}</span>
                </div>
              </div>

              {/* RFM Scores */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Recency', score: selectedCustomer.rScore, sub: `${selectedCustomer.recencyDays} hari lalu` },
                  { label: 'Frequency', score: selectedCustomer.fScore, sub: `${selectedCustomer.frequency}x order` },
                  { label: 'Monetary', score: selectedCustomer.mScore, sub: fmtCurrency(selectedCustomer.monetary) },
                ].map(item => (
                  <div key={item.label} className="rounded-xl p-3 text-center"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#4B5563' }}>{item.label}</p>
                    <p className="text-2xl font-bold" style={{ color: scoreColor(item.score) }}>{item.score}</p>
                    <p className="text-[10px] mt-1" style={{ color: '#6B7280' }}>{item.sub}</p>
                  </div>
                ))}
              </div>

              {/* Transaction history */}
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#4B5563' }}>Riwayat Transaksi</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {selectedCustomer.transactions.map((tx, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div>
                        <p className="text-xs font-medium" style={{ color: '#F0F0F5' }}>{tx.product}</p>
                        <p className="text-[10px]" style={{ color: '#4B5563' }}>{tx.date} · {tx.qty}x</p>
                      </div>
                      <p className="text-sm font-bold" style={{ color: '#10B981' }}>{fmtCurrency(tx.revenue)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold"
      style={{ background: `${scoreColor(score)}20`, color: scoreColor(score) }}>
      {score}
    </span>
  )
}

function scoreColor(score: number): string {
  if (score >= 5) return '#10B981'
  if (score >= 4) return '#3B82F6'
  if (score >= 3) return '#F59E0B'
  if (score >= 2) return '#F07830'
  return '#EF4444'
}

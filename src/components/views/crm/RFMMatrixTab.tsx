'use client'
import { useState } from 'react'
import { CustomerRFM, RFMSegment } from '@/lib/types'
import { fmtCurrency } from '@/lib/utils'
import { SEGMENT_CONFIG, getSegment } from '@/lib/rfm'
import { Plus, X } from 'lucide-react'
import ScoreBadge from './ScoreBadge'

const PER_PAGE = 10

interface Props {
  customers: CustomerRFM[]
  segmentCounts: Record<RFMSegment, number>
  matrixCount: Record<string, number>
  todayStr: string
  onCustomerClick: (c: CustomerRFM) => void
  onAddTaskClick: (c: CustomerRFM, note: string) => void
}

export default function RFMMatrixTab({ customers, segmentCounts, matrixCount, todayStr, onCustomerClick, onAddTaskClick }: Props) {
  const [selectedSegment, setSelectedSegment] = useState<RFMSegment | null>(null)
  const [page, setPage] = useState(1)

  const displayedCustomers = selectedSegment ? customers.filter(c => c.segment === selectedSegment) : customers
  const pageCustomers = displayedCustomers.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const totalPages = Math.ceil(displayedCustomers.length / PER_PAGE)

  function pickSegment(seg: RFMSegment) {
    const isSelected = selectedSegment === seg
    setSelectedSegment(isSelected ? null : seg)
    setPage(1)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
        <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#6B7280' }}>RFM Matrix</p>
        <div className="flex gap-3">
          <div className="flex items-center justify-center" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
            <span className="text-[9px] tracking-widest uppercase" style={{ color: '#374151' }}>Frequency ↑</span>
          </div>
          <div className="flex-1">
            <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {[5, 4, 3, 2, 1].map(fScore => [1, 2, 3, 4, 5].map(rScore => {
                const count = matrixCount[`${rScore}-${fScore}`] || 0
                const seg = getSegment(rScore, fScore)
                const cfg = SEGMENT_CONFIG[seg]
                const isSelected = selectedSegment === seg
                const pct = customers.length > 0 ? ((count / customers.length) * 100).toFixed(0) : '0'
                return (
                  <button key={`${rScore}-${fScore}`}
                    onClick={() => pickSegment(seg)}
                    className="rounded-lg flex flex-col items-center justify-center transition-all"
                    style={{ aspectRatio: '1', background: count > 0 ? cfg.bg : '#F9FAFB', border: isSelected ? `2px solid ${cfg.color}` : `1px solid ${count > 0 ? cfg.color + '30' : '#F9FAFB'}`, boxShadow: isSelected ? `0 0 16px ${cfg.color}40` : 'none', opacity: selectedSegment && !isSelected ? 0.4 : 1 }}>
                    {count > 0 ? (<><span className="text-xs font-bold leading-none" style={{ color: cfg.color }}>{pct}%</span><span className="text-[9px] leading-none mt-0.5" style={{ color: cfg.color + 'aa' }}>{count}</span></>) : (<span style={{ color: '#F9FAFB', fontSize: 10 }}>–</span>)}
                  </button>
                )
              }))}
            </div>
            <div className="grid mt-1" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {[1, 2, 3, 4, 5].map(r => <div key={r} className="text-center"><span className="text-[9px]" style={{ color: '#374151' }}>{r}</span></div>)}
            </div>
            <p className="text-center text-[9px] tracking-widest uppercase mt-1" style={{ color: '#374151' }}>Recency →</p>
          </div>
        </div>
      </div>
      <div className="lg:col-span-2 rounded-2xl p-5 space-y-1.5" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
        <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#6B7280' }}>Segments</p>
        {(Object.entries(SEGMENT_CONFIG) as [RFMSegment, typeof SEGMENT_CONFIG[RFMSegment]][]).map(([seg, cfg]) => {
          const count = segmentCounts[seg] || 0
          const pct = customers.length > 0 ? (count / customers.length) * 100 : 0
          const isSelected = selectedSegment === seg
          return (
            <button key={seg} onClick={() => pickSegment(seg)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left"
              style={{ background: isSelected ? cfg.bg : 'transparent', border: isSelected ? `1px solid ${cfg.color}40` : '1px solid transparent', opacity: selectedSegment && !isSelected ? 0.4 : 1 }}>
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: cfg.color }} />
              <span className="text-xs flex-1" style={{ color: isSelected ? '#111827' : '#9CA3AF' }}>{seg}</span>
              <span className="text-xs font-bold" style={{ color: cfg.color }}>{count}</span>
              <div className="w-12 h-1.5 rounded-full overflow-hidden flex-shrink-0" style={{ background: '#F9FAFB' }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cfg.color }} />
              </div>
            </button>
          )
        })}
      </div>

      {/* Customer Table */}
      <div className="lg:col-span-5 rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#6B7280' }}>Customer List</p>
          {selectedSegment && (
            <button onClick={() => { setSelectedSegment(null); setPage(1) }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold"
              style={{ background: SEGMENT_CONFIG[selectedSegment].bg, color: SEGMENT_CONFIG[selectedSegment].color, border: `1px solid ${SEGMENT_CONFIG[selectedSegment].color}40` }}>
              {selectedSegment} <X size={10} />
            </button>
          )}
          <span className="text-[10px]" style={{ color: '#4B5563' }}>{displayedCustomers.length} customers</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {['Nama', 'No HP', 'Last Buy', 'Orders', 'Total Spend', 'R', 'F', 'M', 'Segment', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageCustomers.map((c, i) => {
                const cfg = SEGMENT_CONFIG[c.segment]
                return (
                  <tr key={i} className="transition-all" style={{ borderBottom: '1px solid #E5E7EB' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td className="px-4 py-3 text-sm font-medium cursor-pointer" style={{ color: '#111827' }} onClick={() => onCustomerClick(c)}>{c.customerName}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#6B7280' }}>{c.phone || '–'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#6B7280' }}>{c.lastOrderDate}</td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: '#111827' }}>{c.frequency}x</td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: '#10B981' }}>{fmtCurrency(c.monetary)}</td>
                    <td className="px-4 py-3"><ScoreBadge score={c.rScore} /></td>
                    <td className="px-4 py-3"><ScoreBadge score={c.fScore} /></td>
                    <td className="px-4 py-3"><ScoreBadge score={c.mScore} /></td>
                    <td className="px-4 py-3"><span className="px-2 py-1 rounded-full text-[10px] font-semibold" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>{c.segment}</span></td>
                    <td className="px-4 py-3">
                      <button onClick={() => onAddTaskClick(c, SEGMENT_CONFIG[c.segment].action)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all"
                        style={{ background: '#F9FAFB', color: '#6B7280' }}>
                        <Plus size={10} /> Task
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid #E5E7EB' }}>
            <span className="text-[10px]" style={{ color: '#4B5563' }}>{(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, displayedCustomers.length)} of {displayedCustomers.length}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded-lg text-xs disabled:opacity-30" style={{ background: '#F9FAFB', color: '#9CA3AF' }}>← Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 rounded-lg text-xs disabled:opacity-30" style={{ background: '#F9FAFB', color: '#9CA3AF' }}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

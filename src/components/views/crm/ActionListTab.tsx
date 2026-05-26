'use client'
import { useState } from 'react'
import { CustomerRFM, RFMSegment } from '@/lib/types'
import { fmtCurrency } from '@/lib/utils'
import { SEGMENT_CONFIG } from '@/lib/rfm'
import { ChevronDown, Search, X, Download, Plus } from 'lucide-react'

const PER_PAGE = 20

interface Props {
  customers: CustomerRFM[]
  segmentCounts: Record<RFMSegment, number>
  todayStr: string
  onCustomerClick: (c: CustomerRFM) => void
  onAddTaskClick: (c: CustomerRFM, note: string) => void
}

function exportSegmentCSV(seg: RFMSegment, segCustomers: CustomerRFM[]) {
  const rows = [
    ['Nama', 'No. HP', 'Last Order', 'Sejak (hari)', 'Orders', 'Total Spend', 'R', 'F', 'M'].join(','),
    ...segCustomers.map(c => [
      `"${c.customerName}"`, c.phone || '', c.lastOrderDate, c.recencyDays, c.frequency, c.monetary, c.rScore, c.fScore, c.mScore
    ].join(',')),
  ]
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${seg.replace(/\s+/g, '-').toLowerCase()}-customers.csv`
  a.click()
}

export default function ActionListTab({ customers, segmentCounts, onCustomerClick, onAddTaskClick }: Props) {
  const [expandedSegment, setExpandedSegment] = useState<RFMSegment | null>(null)
  const [segmentSearch, setSegmentSearch] = useState<Partial<Record<RFMSegment, string>>>({})
  const [segmentPage, setSegmentPage] = useState<Partial<Record<RFMSegment, number>>>({})

  return (
    <div className="space-y-2">
      {(Object.entries(SEGMENT_CONFIG) as [RFMSegment, typeof SEGMENT_CONFIG[RFMSegment]][])
        .filter(([seg]) => (segmentCounts[seg] || 0) > 0)
        .map(([seg, cfg]) => {
          const segCustomers = customers.filter(c => c.segment === seg)
          const isExpanded = expandedSegment === seg
          const search = segmentSearch[seg] || ''
          const currentPage = segmentPage[seg] || 1
          const filtered = segCustomers.filter(c =>
            c.customerName.toLowerCase().includes(search.toLowerCase()) ||
            (c.phone || '').includes(search)
          )
          const totalPg = Math.ceil(filtered.length / PER_PAGE)
          const paginated = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE)

          return (
            <div key={seg} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${isExpanded ? cfg.color + '40' : '#E5E7EB'}`, background: '#FFFFFF', transition: 'border-color 0.2s' }}>
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left"
                style={{ background: isExpanded ? cfg.bg : 'transparent' }}
                onClick={() => setExpandedSegment(isExpanded ? null : seg)}>
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: cfg.color }} />
                  <span className="text-sm font-bold" style={{ color: cfg.color }}>{seg}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                    {segCustomers.length} customers
                  </span>
                  <span className="text-xs hidden sm:block" style={{ color: '#9CA3AF' }}>💡 {cfg.action}</span>
                </div>
                <ChevronDown size={16} style={{ color: cfg.color, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
              </button>

              {isExpanded && (
                <div style={{ borderTop: `1px solid ${cfg.color}20` }}>
                  <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                      <Search size={12} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                      <input
                        value={search}
                        onChange={e => {
                          setSegmentSearch(p => ({ ...p, [seg]: e.target.value }))
                          setSegmentPage(p => ({ ...p, [seg]: 1 }))
                        }}
                        placeholder="Cari nama atau nomor HP..."
                        className="flex-1 text-xs outline-none bg-transparent"
                        style={{ color: '#111827' }} />
                      {search && (
                        <button onClick={() => setSegmentSearch(p => ({ ...p, [seg]: '' }))} style={{ color: '#9CA3AF' }}>
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => exportSegmentCSV(seg, segCustomers)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all flex-shrink-0"
                      style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#6B7280' }}>
                      <Download size={12} /> Export CSV
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
                          {['Nama', 'No. HP', 'Last Order', 'Sejak', 'Orders', 'Total Spend', 'Action'].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#9CA3AF' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.length === 0 ? (
                          <tr><td colSpan={7} className="px-4 py-8 text-center text-xs" style={{ color: '#9CA3AF' }}>Tidak ada customer ditemukan</td></tr>
                        ) : paginated.map((c, i) => (
                          <tr key={i}
                            style={{ borderBottom: '1px solid #F9FAFB' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <td className="px-4 py-3 text-sm font-medium cursor-pointer" style={{ color: '#111827' }} onClick={() => onCustomerClick(c)}>{c.customerName}</td>
                            <td className="px-4 py-3 text-xs" style={{ color: '#6B7280' }}>{c.phone || '–'}</td>
                            <td className="px-4 py-3 text-xs" style={{ color: '#6B7280' }}>{c.lastOrderDate}</td>
                            <td className="px-4 py-3 text-xs font-semibold" style={{ color: c.recencyDays > 60 ? '#EF4444' : '#F59E0B' }}>{c.recencyDays} hari</td>
                            <td className="px-4 py-3 text-sm font-bold" style={{ color: '#111827' }}>{c.frequency}x</td>
                            <td className="px-4 py-3 text-sm font-bold" style={{ color: '#10B981' }}>{fmtCurrency(c.monetary)}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => onAddTaskClick(c, cfg.action)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                                <Plus size={10} /> Task
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {totalPg > 1 && (
                    <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid #F3F4F6' }}>
                      <span className="text-[10px]" style={{ color: '#9CA3AF' }}>
                        {(currentPage - 1) * PER_PAGE + 1}–{Math.min(currentPage * PER_PAGE, filtered.length)} dari {filtered.length}
                        {search && ` (filter: "${search}")`}
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSegmentPage(p => ({ ...p, [seg]: Math.max(1, currentPage - 1) }))}
                          disabled={currentPage === 1}
                          className="px-3 py-1 rounded-lg text-xs disabled:opacity-30 transition-all"
                          style={{ background: '#F9FAFB', color: '#6B7280' }}>← Prev</button>
                        <span className="text-xs px-2" style={{ color: '#9CA3AF' }}>{currentPage} / {totalPg}</span>
                        <button onClick={() => setSegmentPage(p => ({ ...p, [seg]: Math.min(totalPg, currentPage + 1) }))}
                          disabled={currentPage === totalPg}
                          className="px-3 py-1 rounded-lg text-xs disabled:opacity-30 transition-all"
                          style={{ background: '#F9FAFB', color: '#6B7280' }}>Next →</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
    </div>
  )
}

'use client'
import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown, ChevronRight, Check } from 'lucide-react'
import { DateRange } from '@/lib/types'
import { Period, PERIOD_LABELS } from '@/lib/utils'

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

interface Props {
  period: Period
  dateRange: DateRange
  onSelectPeriod: (p: Exclude<Period, 'custom'>) => void
  onCustomRange: (r: DateRange) => void
}

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function getDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days: (number | null)[] = Array(firstDay).fill(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)
  return days
}

export default function TimeframeSelector({ period, dateRange, onSelectPeriod, onCustomRange }: Props) {
  const [open, setOpen] = useState(false)
  const [showCal, setShowCal] = useState(false)
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())
  const [pendingFrom, setPendingFrom] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setShowCal(false); setPendingFrom(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const rightMonth = viewMonth === 11 ? 0 : viewMonth + 1
  const rightYear = viewMonth === 11 ? viewYear + 1 : viewYear

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  function pickPreset(p: Exclude<Period, 'custom'>) {
    onSelectPeriod(p); setOpen(false); setShowCal(false); setPendingFrom(null)
  }

  function handleDayClick(y: number, m: number, d: number) {
    const date = isoDate(y, m, d)
    if (!pendingFrom) {
      setPendingFrom(date)
    } else {
      const from = pendingFrom < date ? pendingFrom : date
      const to = pendingFrom < date ? date : pendingFrom
      onCustomRange({ from, to })
      setPendingFrom(null); setOpen(false); setShowCal(false)
    }
  }

  function isEdge(d: string) {
    if (pendingFrom === d) return true
    if (period !== 'custom') return false
    return d === dateRange.from || d === dateRange.to
  }
  function isInRange(d: string) {
    if (period !== 'custom' || pendingFrom) return false
    return d > dateRange.from && d < dateRange.to
  }

  // Render helper (not a nested component) so React doesn't remount the calendar each render.
  function renderMonth({ year, month, showPrev, showNext }: { year: number; month: number; showPrev: boolean; showNext: boolean }) {
    const days = getDays(year, month)
    return (
      <div className="flex-1">
        <div className="flex items-center justify-between mb-3">
          {showPrev ? (
            <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors text-base leading-none">‹</button>
          ) : <div className="w-7" />}
          <span className="text-sm font-semibold text-gray-700">{MONTH_NAMES[month]} {year}</span>
          {showNext ? (
            <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors text-base leading-none">›</button>
          ) : <div className="w-7" />}
        </div>
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            if (!day) return <div key={`e-${i}`} />
            const d = isoDate(year, month, day)
            const edge = isEdge(d)
            const inRange = isInRange(d)
            return (
              <button
                key={d}
                onClick={() => handleDayClick(year, month, day)}
                className="text-xs py-1.5 rounded-lg text-center font-medium transition-all"
                style={{
                  background: edge ? '#F07830' : inRange ? '#FFF7ED' : 'transparent',
                  color: edge ? '#FFFFFF' : inRange ? '#F07830' : '#374151',
                }}
              >
                {day}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const label = period === 'custom' ? `${dateRange.from} → ${dateRange.to}` : PERIOD_LABELS[period]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(o => !o); setShowCal(false) }}
        className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
        style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', color: '#374151', minWidth: 172 }}
      >
        <Calendar size={13} style={{ color: '#F07830' }} />
        <span className="flex-1 text-left whitespace-nowrap">{label}</span>
        <ChevronDown size={13} style={{ color: '#9CA3AF', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 z-50 rounded-2xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 12px 40px rgba(0,0,0,0.12)', minWidth: showCal ? 520 : 224 }}>
          {!showCal ? (
            <div className="py-1.5">
              {(['kemarin', '7d', '14d'] as const).map(p => {
                const active = period === p
                return (
                  <button key={p} onClick={() => pickPreset(p)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium transition-colors"
                    style={{ background: active ? '#FFF7ED' : 'transparent', color: active ? '#F07830' : '#374151' }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F9FAFB' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                    <span>{PERIOD_LABELS[p]}</span>
                    {active && <Check size={13} />}
                  </button>
                )
              })}
              <div className="my-1 mx-3 border-t" style={{ borderColor: '#F3F4F6' }} />
              <button onClick={() => setShowCal(true)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium transition-colors"
                style={{ background: period === 'custom' ? '#FFF7ED' : 'transparent', color: period === 'custom' ? '#F07830' : '#374151' }}
                onMouseEnter={e => { if (period !== 'custom') e.currentTarget.style.background = '#F9FAFB' }}
                onMouseLeave={e => { if (period !== 'custom') e.currentTarget.style.background = 'transparent' }}>
                <span className="flex items-center gap-2"><Calendar size={12} /> {PERIOD_LABELS.custom}</span>
                <ChevronRight size={12} />
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-px p-4">
                {renderMonth({ year: viewYear, month: viewMonth, showPrev: true, showNext: false })}
                <div className="w-px bg-gray-100 mx-3 self-stretch" />
                {renderMonth({ year: rightYear, month: rightMonth, showPrev: false, showNext: true })}
              </div>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #F3F4F6' }}>
                <span className="text-xs text-gray-400">
                  {pendingFrom ? `Pilih tanggal akhir (mulai: ${pendingFrom})` : 'Pilih tanggal mulai'}
                </span>
                <button onClick={() => { setShowCal(false); setPendingFrom(null) }}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:bg-gray-100"
                  style={{ background: '#F3F4F6', color: '#374151' }}>
                  Kembali
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

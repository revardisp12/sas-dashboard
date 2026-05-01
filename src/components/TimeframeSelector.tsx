'use client'
import { useState, useRef, useEffect } from 'react'
import { Calendar, X } from 'lucide-react'
import { Timeframe, DateRange } from '@/lib/types'

const OPTIONS: { label: string; value: Timeframe }[] = [
  { label: '7H', value: 7 },
  { label: '14H', value: 14 },
  { label: '30H', value: 30 },
  { label: '90H', value: 90 },
  { label: 'All', value: 0 },
]

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

interface Props {
  value: Timeframe
  onChange: (t: Timeframe) => void
  dateRange: DateRange | null
  onDateRangeChange: (r: DateRange | null) => void
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

export default function TimeframeSelector({ value, onChange, dateRange, onDateRangeChange }: Props) {
  const [calOpen, setCalOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())
  const [pendingFrom, setPendingFrom] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setCalOpen(false)
        setPendingFrom(null)
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

  function handleDayClick(y: number, m: number, d: number) {
    const date = isoDate(y, m, d)
    if (!pendingFrom) {
      setPendingFrom(date)
    } else {
      const from = pendingFrom < date ? pendingFrom : date
      const to = pendingFrom < date ? date : pendingFrom
      onDateRangeChange({ from, to })
      setPendingFrom(null)
      setCalOpen(false)
    }
  }

  function applyPreset(days: number) {
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - days + 1)
    onDateRangeChange({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) })
    setCalOpen(false)
    setPendingFrom(null)
  }

  function applyThisMonth() {
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    onDateRangeChange({ from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) })
    setCalOpen(false)
    setPendingFrom(null)
  }

  function isEdge(d: string) {
    if (pendingFrom === d) return true
    if (!dateRange) return false
    return d === dateRange.from || d === dateRange.to
  }

  function isInRange(d: string) {
    if (!dateRange || pendingFrom) return false
    return d > dateRange.from && d < dateRange.to
  }

  function CalendarMonth({ year, month, showPrev, showNext }: { year: number; month: number; showPrev: boolean; showNext: boolean }) {
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

  return (
    <div className="relative flex items-center gap-2" ref={ref}>
      {!dateRange ? (
        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: '#F3F4F6', border: '1px solid #E5E7EB' }}>
          {OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: value === opt.value ? '#F07830' : 'transparent',
                color: value === opt.value ? '#fff' : '#6B7280',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium"
          style={{ background: '#FFF7ED', border: '1px solid rgba(240,120,48,0.25)', color: '#F07830' }}>
          <Calendar size={11} />
          <span>{dateRange.from}</span>
          <span className="text-orange-300">→</span>
          <span>{dateRange.to}</span>
          <button
            onClick={() => { onDateRangeChange(null); setCalOpen(false); setPendingFrom(null) }}
            className="ml-1 w-4 h-4 flex items-center justify-center rounded-full hover:bg-orange-100 transition-colors"
            style={{ color: '#F07830' }}
          >
            <X size={10} />
          </button>
        </div>
      )}

      <button
        onClick={() => { setCalOpen(p => !p); setPendingFrom(null) }}
        className="flex items-center justify-center w-8 h-8 rounded-xl transition-all"
        style={{
          background: calOpen || dateRange ? '#FFF7ED' : '#F3F4F6',
          border: `1px solid ${calOpen || dateRange ? 'rgba(240,120,48,0.3)' : '#E5E7EB'}`,
          color: calOpen || dateRange ? '#F07830' : '#9CA3AF',
        }}
      >
        <Calendar size={13} />
      </button>

      {calOpen && (
        <div className="absolute top-full right-0 mt-2 z-50 rounded-2xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 12px 40px rgba(0,0,0,0.12)', minWidth: 520 }}>

          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mr-1">Preset:</span>
            {([{ l: '7 Hari', d: 7 }, { l: '14 Hari', d: 14 }, { l: '30 Hari', d: 30 }, { l: '90 Hari', d: 90 }] as const).map(p => (
              <button key={p.l} onClick={() => applyPreset(p.d)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:bg-orange-50 hover:text-orange-600"
                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#374151' }}>
                {p.l}
              </button>
            ))}
            <button onClick={applyThisMonth}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:bg-orange-50 hover:text-orange-600"
              style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#374151' }}>
              Bulan Ini
            </button>
          </div>

          <div className="flex gap-px p-4">
            <CalendarMonth year={viewYear} month={viewMonth} showPrev showNext={false} />
            <div className="w-px bg-gray-100 mx-3 self-stretch" />
            <CalendarMonth year={rightYear} month={rightMonth} showPrev={false} showNext />
          </div>

          <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #F3F4F6' }}>
            <span className="text-xs text-gray-400">
              {pendingFrom ? `Pilih tanggal akhir (mulai: ${pendingFrom})` : 'Pilih tanggal mulai'}
            </span>
            <button onClick={() => { setCalOpen(false); setPendingFrom(null) }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:bg-gray-100"
              style={{ background: '#F3F4F6', color: '#374151' }}>
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

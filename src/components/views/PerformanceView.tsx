'use client'
import { useState, useEffect } from 'react'
import { Brand, SalesRow, WeekRange } from '@/lib/types'
import { getTarget, upsertTarget } from '@/lib/db'
import MetricCard from '@/components/MetricCard'
import { TrendingUp, Target, ChevronLeft, ChevronRight, Save, Plus, Trash2 } from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

const ACCENT: Record<Brand, string> = { reglow: '#C9A96E', amura: '#8FB050' }
const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

function fmt(n: number) {
  if (n >= 1_000_000_000) return 'Rp ' + (n / 1_000_000_000).toFixed(1) + 'M'
  if (n >= 1_000_000) return 'Rp ' + (n / 1_000_000).toFixed(1) + 'jt'
  return 'Rp ' + n.toLocaleString('id-ID')
}
function fmtFull(n: number) { return 'Rp ' + n.toLocaleString('id-ID') }
function getDaysInMonth(year: number, month: number) { return new Date(year, month, 0).getDate() }

function defaultWeeks(year: number, month: number): WeekRange[] {
  const days = getDaysInMonth(year, month)
  const boundaries = [1, 8, 15, 22, 29].filter(d => d <= days)
  return boundaries.map((start, i) => ({
    weekNum: i + 1,
    startDay: start,
    endDay: i < boundaries.length - 1 ? boundaries[i + 1] - 1 : days,
    target: 0,
  }))
}

interface Props { salesData: SalesRow[]; brand: Brand }

export default function PerformanceView({ salesData, brand }: Props) {
  const accent = ACCENT[brand]
  const today = new Date()

  const [selectedYear, setSelectedYear] = useState(today.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1)
  const [monthlyTarget, setMonthlyTarget] = useState('')
  const [weeks, setWeeks] = useState<WeekRange[]>(() => defaultWeeks(today.getFullYear(), today.getMonth() + 1))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const t = await getTarget(brand, selectedYear, selectedMonth)
      if (t) {
        setMonthlyTarget(t.monthlyTarget > 0 ? String(t.monthlyTarget) : '')
        setWeeks(t.weeks.length > 0 ? t.weeks : defaultWeeks(selectedYear, selectedMonth))
      } else {
        setMonthlyTarget('')
        setWeeks(defaultWeeks(selectedYear, selectedMonth))
      }
    }
    load()
  }, [brand, selectedYear, selectedMonth])

  function getSalesForMonth(year: number, month: number) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    return salesData.filter(r => r.date.startsWith(prefix))
  }
  function getSalesForRange(sales: SalesRow[], startDay: number, endDay: number) {
    return sales.filter(r => {
      const d = parseInt(r.date.split('-')[2])
      return d >= startDay && d <= endDay
    })
  }

  const thisMonthSales = getSalesForMonth(selectedYear, selectedMonth)
  const lastMonthRef = selectedMonth === 1
    ? { year: selectedYear - 1, month: 12 }
    : { year: selectedYear, month: selectedMonth - 1 }
  const lastMonthSales = getSalesForMonth(lastMonthRef.year, lastMonthRef.month)

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth)
  const chartData = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    const ds = String(day).padStart(2, '0')
    const thisDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${ds}`
    const lastDate = `${lastMonthRef.year}-${String(lastMonthRef.month).padStart(2, '0')}-${ds}`
    const thisRev = thisMonthSales.filter(r => r.date === thisDate).reduce((s, r) => s + r.revenue, 0)
    const lastRev = lastMonthSales.filter(r => r.date === lastDate).reduce((s, r) => s + r.revenue, 0)
    return { day, 'Bulan Ini': thisRev || null, 'Bulan Lalu': lastRev || null }
  })

  const isCurrentMonth = today.getFullYear() === selectedYear && today.getMonth() + 1 === selectedMonth
  const isPastMonth = selectedYear < today.getFullYear() ||
    (selectedYear === today.getFullYear() && selectedMonth < today.getMonth() + 1)
  const todayDay = today.getDate()

  function calcWeek(w: WeekRange) {
    const lmAchievement = getSalesForRange(lastMonthSales, w.startDay, w.endDay).reduce((s, r) => s + r.revenue, 0)
    let runningRate: number | null = null
    let isProjected = false
    let isFuture = false

    if (isPastMonth) {
      runningRate = getSalesForRange(thisMonthSales, w.startDay, w.endDay).reduce((s, r) => s + r.revenue, 0)
    } else if (isCurrentMonth) {
      if (w.startDay > todayDay) {
        isFuture = true
      } else if (w.endDay <= todayDay) {
        runningRate = getSalesForRange(thisMonthSales, w.startDay, w.endDay).reduce((s, r) => s + r.revenue, 0)
      } else {
        const daysElapsed = todayDay - w.startDay + 1
        const totalDays = w.endDay - w.startDay + 1
        const soFar = getSalesForRange(thisMonthSales, w.startDay, todayDay).reduce((s, r) => s + r.revenue, 0)
        runningRate = daysElapsed > 0 ? (soFar / daysElapsed) * totalDays : null
        isProjected = true
      }
    } else {
      isFuture = true
    }

    return { lmAchievement, runningRate, isProjected, isFuture }
  }

  const weekCalcs = weeks.map(calcWeek)
  const totalLM = weekCalcs.reduce((s, w) => s + w.lmAchievement, 0)
  const totalRunning = weekCalcs.reduce((s, w) => w.runningRate !== null ? s + w.runningRate : s, 0)
  const totalWeeklyTarget = weeks.reduce((s, w) => s + (w.target || 0), 0)

  function runRatePct(rr: number | null, target: number): number | null {
    if (rr === null || target === 0) return null
    return ((rr - target) / target) * 100
  }
  function statusColor(pct: number | null) {
    if (pct === null) return '#9CA3AF'
    if (pct >= 0) return '#10B981'
    if (pct >= -10) return '#F59E0B'
    return '#EF4444'
  }
  function statusLabel(pct: number | null) {
    if (pct === null) return '—'
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
  }

  async function handleSave() {
    setSaving(true)
    try {
      await upsertTarget({
        brand, year: selectedYear, month: selectedMonth,
        monthlyTarget: Number(monthlyTarget) || 0,
        weeks,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  function prevMonth() {
    if (selectedMonth === 1) { setSelectedYear(y => y - 1); setSelectedMonth(12) }
    else setSelectedMonth(m => m - 1)
  }
  function nextMonth() {
    if (selectedMonth === 12) { setSelectedYear(y => y + 1); setSelectedMonth(1) }
    else setSelectedMonth(m => m + 1)
  }
  function addWeek() {
    const last = weeks[weeks.length - 1]
    if (!last || last.endDay >= daysInMonth) return
    setWeeks(w => [...w, { weekNum: w.length + 1, startDay: last.endDay + 1, endDay: daysInMonth, target: 0 }])
  }
  function removeWeek(idx: number) {
    setWeeks(w => w.filter((_, i) => i !== idx).map((wk, i) => ({ ...wk, weekNum: i + 1 })))
  }
  function updateWeek(idx: number, field: keyof WeekRange, value: number) {
    setWeeks(w => w.map((wk, i) => i === idx ? { ...wk, [field]: value } : wk))
  }

  const totalPct = runRatePct(totalRunning > 0 ? totalRunning : null, totalWeeklyTarget)

  return (
    <div className="space-y-6">
      {/* Month selector + target input */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg transition-colors"
            style={{ background: '#F3F4F6', color: '#6B7280' }}>
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm font-semibold min-w-[150px] text-center" style={{ color: '#111827' }}>
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-lg transition-colors"
            style={{ background: '#F3F4F6', color: '#6B7280' }}>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs font-medium whitespace-nowrap" style={{ color: '#374151' }}>Target Bulanan</span>
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl border"
            style={{ borderColor: accent, background: `${accent}08` }}>
            <span className="text-xs" style={{ color: '#6B7280' }}>Rp</span>
            <input
              type="text"
              value={monthlyTarget}
              onChange={e => setMonthlyTarget(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="500000000"
              className="outline-none text-sm font-medium w-36"
              style={{ background: 'transparent', color: '#111827' }}
            />
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background: saved ? '#10B981' : accent, color: '#fff' }}>
            <Save size={12} />
            {saved ? 'Tersimpan!' : saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Target Bulanan" value={monthlyTarget ? fmt(Number(monthlyTarget)) : '—'} icon={<Target size={14} />} accent={accent} />
        <MetricCard label="LM Achievement" value={totalLM > 0 ? fmt(totalLM) : '—'} icon={<TrendingUp size={14} />} accent="#6B7280" sub="Bulan lalu" />
        <MetricCard label="Running Rate" value={totalRunning > 0 ? fmt(totalRunning) : '—'} icon={<TrendingUp size={14} />} accent="#10B981" />
        <MetricCard
          label="Run Rate %"
          value={statusLabel(totalPct)}
          icon={<TrendingUp size={14} />}
          accent={statusColor(totalPct)}
          sub={totalPct !== null ? (totalPct >= 0 ? 'On Track' : 'Behind Target') : 'Set target dulu'}
        />
      </div>

      {/* Combo chart */}
      <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
        <p className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: '#6B7280' }}>
          Revenue Harian — {MONTH_NAMES[selectedMonth - 1]} {selectedYear} vs {MONTH_NAMES[lastMonthRef.month - 1]} {lastMonthRef.year}
        </p>
        <ResponsiveContainer width="100%" height={230}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#4B5563' }} />
            <YAxis tick={{ fontSize: 9, fill: '#4B5563' }}
              tickFormatter={v => v >= 1_000_000 ? (v / 1_000_000).toFixed(0) + 'jt' : String(v)} />
            <Tooltip
              contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 11 }}
              formatter={(v) => [fmtFull(Number(v))]}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="Bulan Ini" fill={accent} radius={[3, 3, 0, 0]} maxBarSize={22} />
            <Line type="monotone" dataKey="Bulan Lalu" stroke="#9CA3AF" strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Weekly Run Rate Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <p className="text-sm font-semibold" style={{ color: '#111827' }}>Weekly Run Rate</p>
          <button onClick={addWeek}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: `${accent}12`, color: accent, border: `1px solid ${accent}30` }}>
            <Plus size={11} /> Tambah Minggu
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <th className="text-left px-5 py-3 text-xs font-semibold w-44" style={{ color: '#6B7280' }}></th>
                {weeks.map((w, i) => (
                  <th key={i} className="px-4 py-3 text-center min-w-[150px]">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-xs font-semibold" style={{ color: '#374151' }}>Week {w.weekNum}</span>
                      {weeks.length > 1 && (
                        <button onClick={() => removeWeek(i)} className="p-0.5 rounded hover:opacity-70"
                          style={{ color: '#EF4444' }}>
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-1 mt-1.5">
                      <input type="number" min={1} max={daysInMonth} value={w.startDay}
                        onChange={e => updateWeek(i, 'startDay', Number(e.target.value))}
                        className="w-10 text-center text-xs px-1 py-0.5 rounded border outline-none"
                        style={{ borderColor: '#D1D5DB', color: '#374151' }} />
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>–</span>
                      <input type="number" min={1} max={daysInMonth} value={w.endDay}
                        onChange={e => updateWeek(i, 'endDay', Number(e.target.value))}
                        className="w-10 text-center text-xs px-1 py-0.5 rounded border outline-none"
                        style={{ borderColor: '#D1D5DB', color: '#374151' }} />
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center min-w-[130px] text-xs font-semibold" style={{ color: '#374151' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {/* LM Achievement */}
              <TR label="LM Achievement" sub="Bulan lalu">
                {weekCalcs.map((c, i) => (
                  <td key={i} className="px-4 py-3 text-center text-xs" style={{ color: '#374151' }}>
                    {c.lmAchievement > 0 ? fmt(c.lmAchievement) : '—'}
                  </td>
                ))}
                <TotalCell value={totalLM > 0 ? fmt(totalLM) : '—'} />
              </TR>

              {/* Weekly Target */}
              <TR label="Weekly Target" sub="Input manual" accent={accent}>
                {weeks.map((w, i) => (
                  <td key={i} className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-[10px]" style={{ color: '#9CA3AF' }}>Rp</span>
                      <input type="text"
                        value={w.target > 0 ? String(w.target) : ''}
                        onChange={e => updateWeek(i, 'target', Number(e.target.value.replace(/[^0-9]/g, '')))}
                        placeholder="0"
                        className="w-24 text-center text-xs px-2 py-1 rounded-lg border outline-none"
                        style={{ borderColor: `${accent}40`, background: `${accent}06`, color: '#111827' }}
                      />
                    </div>
                  </td>
                ))}
                <TotalCell value={totalWeeklyTarget > 0 ? fmt(totalWeeklyTarget) : '—'} color={accent} bold />
              </TR>

              {/* Running Rate */}
              <TR label="Running Rate" sub="Proyeksi / Aktual" bold>
                {weekCalcs.map((c, i) => (
                  <td key={i} className="px-4 py-3 text-center text-xs"
                    style={{ color: c.isFuture ? '#9CA3AF' : '#111827', fontWeight: c.isProjected ? 500 : 600 }}>
                    {c.isFuture ? '—' : c.runningRate !== null ? (
                      <span>
                        {fmt(c.runningRate)}
                        {c.isProjected && <span className="ml-1 text-[10px]" style={{ color: '#F59E0B' }}>~</span>}
                      </span>
                    ) : '—'}
                  </td>
                ))}
                <TotalCell value={totalRunning > 0 ? fmt(totalRunning) : '—'} bold />
              </TR>

              {/* vs LM */}
              <TR label="vs LM Achievement">
                {weekCalcs.map((c, i) => {
                  const diff = c.runningRate !== null ? c.runningRate - c.lmAchievement : null
                  return (
                    <td key={i} className="px-4 py-3 text-center text-xs"
                      style={{ color: diff === null ? '#9CA3AF' : diff >= 0 ? '#10B981' : '#EF4444' }}>
                      {diff === null ? '—' : `${diff >= 0 ? '+' : ''}${fmt(diff)}`}
                    </td>
                  )
                })}
                {(() => {
                  const diff = totalRunning > 0 ? totalRunning - totalLM : null
                  return <TotalCell value={diff !== null ? `${diff >= 0 ? '+' : ''}${fmt(diff)}` : '—'}
                    color={diff !== null ? (diff >= 0 ? '#10B981' : '#EF4444') : undefined} bold />
                })()}
              </TR>

              {/* vs Target */}
              <TR label="vs Target">
                {weekCalcs.map((c, i) => {
                  const diff = c.runningRate !== null && weeks[i].target > 0 ? c.runningRate - weeks[i].target : null
                  return (
                    <td key={i} className="px-4 py-3 text-center text-xs"
                      style={{ color: diff === null ? '#9CA3AF' : diff >= 0 ? '#10B981' : '#EF4444' }}>
                      {diff === null ? '—' : `${diff >= 0 ? '+' : ''}${fmt(diff)}`}
                    </td>
                  )
                })}
                <TotalCell value="—" />
              </TR>

              {/* Run Rate % */}
              <TR label="Run Rate %" bold>
                {weekCalcs.map((c, i) => {
                  const pct = runRatePct(c.runningRate, weeks[i].target)
                  return (
                    <td key={i} className="px-4 py-3 text-center">
                      {pct === null ? (
                        <span className="text-xs" style={{ color: '#9CA3AF' }}>—</span>
                      ) : (
                        <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: `${statusColor(pct)}18`, color: statusColor(pct) }}>
                          {statusLabel(pct)}
                        </span>
                      )}
                    </td>
                  )
                })}
                <td className="px-4 py-3 text-center">
                  {totalPct !== null ? (
                    <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: `${statusColor(totalPct)}18`, color: statusColor(totalPct) }}>
                      {statusLabel(totalPct)}
                    </span>
                  ) : <span className="text-xs" style={{ color: '#9CA3AF' }}>—</span>}
                </td>
              </TR>
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3" style={{ borderTop: '1px solid #F3F4F6' }}>
          <p className="text-[10px]" style={{ color: '#9CA3AF' }}>
            ~ = proyeksi berdasarkan pace harian minggu berjalan · Edit range tanggal & target per minggu, lalu klik Simpan
          </p>
        </div>
      </div>
    </div>
  )
}

function TR({ label, sub, children, accent, bold }: {
  label: string; sub?: string; children: React.ReactNode; accent?: string; bold?: boolean
}) {
  return (
    <tr style={{ borderBottom: '1px solid #F9FAFB' }}>
      <td className="px-5 py-3">
        <p className={`text-xs ${bold ? 'font-semibold' : 'font-medium'}`} style={{ color: accent ?? '#374151' }}>{label}</p>
        {sub && <p className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>{sub}</p>}
      </td>
      {children}
    </tr>
  )
}

function TotalCell({ value, color, bold }: { value: string; color?: string; bold?: boolean }) {
  return (
    <td className="px-4 py-3 text-center text-xs" style={{ color: color ?? '#374151', fontWeight: bold ? 600 : 400 }}>
      {value}
    </td>
  )
}

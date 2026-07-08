import type { CSSProperties } from 'react'

// Shared metric formatter — was copy-pasted byte-for-byte in 4 platform views.
export function fmt(n: number, type: 'currency' | 'number' | 'percent' = 'number'): string {
  if (type === 'currency') return fmtCurrency(n)
  if (type === 'percent') return n.toFixed(2) + '%'
  return fmtNum(n)
}

// Shared Recharts tooltip style — the canonical light-card variant repeated
// ~20x across chart views.
export const chartTooltipStyle: CSSProperties = {
  background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, color: '#111827', fontSize: 11,
}

export function filterByRange<T extends { date: string }>(data: T[], from: string, to: string): T[] {
  return data.filter(r => r.date >= from && r.date <= to)
}

/** Dropdown period options for the dashboard timeframe selector. */
export type Period = 'kemarin' | '7d' | '14d' | 'custom'

export const PERIOD_LABELS: Record<Period, string> = {
  kemarin: 'Kemarin',
  '7d': '7 Hari Terakhir',
  '14d': '14 Hari Terakhir',
  custom: 'Pilih Tanggal Sendiri',
}

// The business (and all synced WMS data) operates in WIB (Asia/Jakarta, UTC+7, no DST).
// Pin "today"/date-window math to that fixed offset instead of the runtime's own timezone
// (server UTC, or whatever timezone an admin's browser happens to be in) — otherwise date
// boundaries drift by a day for part of the WIB day (00:00-06:59 WIB = still "yesterday" UTC).
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000

/** Now, shifted so reading UTC getters yields the correct Asia/Jakarta calendar date/time,
 *  regardless of the runtime's own timezone. Read components via getUTC*, not local getters. */
export function nowWIB(): Date {
  return new Date(Date.now() + WIB_OFFSET_MS)
}

/** Today's calendar date (YYYY-MM-DD) in Asia/Jakarta, regardless of runtime timezone. */
export function todayWIB(): string {
  return nowWIB().toISOString().slice(0, 10)
}

/** The date n days before today (n=0 -> today), as YYYY-MM-DD in Asia/Jakarta. */
export function daysAgoWIB(n: number): string {
  return new Date(nowWIB().getTime() - n * 86_400_000).toISOString().slice(0, 10)
}

/** Resolve a preset period to a concrete [from,to] window anchored on today (WIB). */
export function resolvePeriod(p: Exclude<Period, 'custom'>): { from: string; to: string } {
  if (p === 'kemarin') {
    const y = daysAgoWIB(1)
    return { from: y, to: y }
  }
  const days = p === '7d' ? 7 : 14
  return { from: daysAgoWIB(days - 1), to: daysAgoWIB(0) }
}

export function filterByDays<T extends { date: string }>(data: T[], days: number): T[] {
  if (days === 0 || data.length === 0) return data
  const timestamps = data.map(r => new Date(r.date).getTime()).filter(t => !isNaN(t))
  if (timestamps.length === 0) return data
  const maxDate = new Date(Math.max(...timestamps))
  const cutoff = new Date(maxDate)
  cutoff.setDate(cutoff.getDate() - days + 1)
  return data.filter(r => {
    const d = new Date(r.date)
    return !isNaN(d.getTime()) && d >= cutoff
  })
}

export function fmtCurrency(n: number): string {
  if (n >= 1_000_000_000) return 'Rp ' + (n / 1_000_000_000).toFixed(1) + 'M'
  if (n >= 1_000_000) return 'Rp ' + (n / 1_000_000).toFixed(1) + 'jt'
  return 'Rp ' + n.toLocaleString('id-ID')
}

export function fmtNum(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'M'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'jt'
  if (n >= 10_000) return Math.round(n / 1_000) + 'rb'
  return n.toLocaleString('id-ID')
}

// Exact (non-abbreviated) variants for metric cards: "Rp 2.700.000.000", "13.000".
export function fmtCurrencyExact(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}

export function fmtNumExact(n: number): string {
  return Math.round(n).toLocaleString('id-ID')
}

/** Shrink the font for long exact values so they still fit a card. `base` = the card's normal px. */
export function fitSize(value: string, base: number): number {
  const len = value.length
  if (len <= 8) return base
  if (len <= 11) return Math.round(base * 0.82)
  if (len <= 14) return Math.round(base * 0.70)
  if (len <= 17) return Math.round(base * 0.58)
  return Math.round(base * 0.48)
}

export function pct(part: number, total: number): string {
  if (total === 0) return '0%'
  return ((part / total) * 100).toFixed(1) + '%'
}

// All functions operate in UTC to avoid DST / timezone surprises.
// Caller passes a Date; we compute week boundaries based on UTC day-of-week.
// Mon = 1 .. Sun = 0 (per JS Date.getUTCDay()).

export interface WeekRange {
  weekStart: Date  // Monday 00:00 UTC
  weekEnd: Date    // Sunday 23:59:59.999 UTC
}

export function previousMonSunWeek(reference: Date): WeekRange {
  // Get UTC day-of-week: 0=Sun, 1=Mon, ..., 6=Sat
  const dow = reference.getUTCDay()
  // Days to go back to reach Monday of the PREVIOUS week:
  // - if Mon (dow=1): back 7 days to previous Monday
  // - if Sun (dow=0): back 6 days to previous Monday (last week's Monday)
  // - otherwise: back (dow - 1) + 7 days to previous Monday
  const daysBack = dow === 0 ? 13 : 6 + dow
  const weekStart = new Date(Date.UTC(
    reference.getUTCFullYear(),
    reference.getUTCMonth(),
    reference.getUTCDate() - daysBack,
    0, 0, 0, 0
  ))
  const weekEnd = new Date(weekStart.getTime())
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
  weekEnd.setUTCHours(23, 59, 59, 999)
  return { weekStart, weekEnd }
}

export function isoWeekNumber(date: Date): number {
  // ISO 8601 week numbering: weeks start Monday, week 1 contains the first Thursday.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export function ymd(date: Date): string {
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

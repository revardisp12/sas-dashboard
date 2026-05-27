import { describe, it, expect } from 'vitest'
import { previousMonSunWeek, isoWeekNumber, ymd } from './dateRange'

describe('previousMonSunWeek', () => {
  it('returns last Mon-Sun when today is Monday', () => {
    // 2026-05-25 is a Monday
    const today = new Date('2026-05-25T09:00:00+07:00')
    const { weekStart, weekEnd } = previousMonSunWeek(today)
    expect(ymd(weekStart)).toBe('2026-05-18')
    expect(ymd(weekEnd)).toBe('2026-05-24')
  })

  it('returns last Mon-Sun when today is mid-week', () => {
    // 2026-05-27 is a Wednesday
    const today = new Date('2026-05-27T09:00:00+07:00')
    const { weekStart, weekEnd } = previousMonSunWeek(today)
    expect(ymd(weekStart)).toBe('2026-05-18')
    expect(ymd(weekEnd)).toBe('2026-05-24')
  })

  it('handles month boundary', () => {
    // 2026-06-01 is a Monday — previous Mon-Sun is the last week of May
    const today = new Date('2026-06-01T09:00:00+07:00')
    const { weekStart, weekEnd } = previousMonSunWeek(today)
    expect(ymd(weekStart)).toBe('2026-05-25')
    expect(ymd(weekEnd)).toBe('2026-05-31')
  })
})

describe('isoWeekNumber', () => {
  it('returns ISO week 21 for 2026-05-18 UTC', () => {
    expect(isoWeekNumber(new Date('2026-05-18T00:00:00Z'))).toBe(21)
  })
})

describe('ymd', () => {
  it('formats Date as YYYY-MM-DD in UTC', () => {
    expect(ymd(new Date('2026-05-18T17:00:00Z'))).toBe('2026-05-18')
  })
})

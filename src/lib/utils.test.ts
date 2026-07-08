import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nowWIB, todayWIB, daysAgoWIB, resolvePeriod } from './utils'

describe('WIB-anchored date helpers', () => {
  afterEach(() => { vi.useRealTimers() })

  it('todayWIB anchors to Asia/Jakarta, not the runtime UTC date, near the day boundary', () => {
    // 2026-06-15T20:00:00Z = 2026-06-16T03:00 WIB (UTC+7). A naive `new Date().toISOString()`
    // would report '2026-06-15' (the UTC date) here, which is the exact bug this fixes: the
    // WIB calendar day has already rolled over to the 16th, 3 hours ago.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T20:00:00.000Z'))
    expect(todayWIB()).toBe('2026-06-16')
  })

  it('todayWIB matches the UTC date once WIB and UTC agree (well past midnight WIB)', () => {
    // 2026-06-16T10:00:00Z = 2026-06-16T17:00 WIB — same calendar day either way.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-16T10:00:00.000Z'))
    expect(todayWIB()).toBe('2026-06-16')
  })

  it('nowWIB returns an instant whose UTC getters read the correct WIB calendar components', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T20:00:00.000Z')) // 03:00 WIB on the 16th
    const d = nowWIB()
    expect(d.getUTCFullYear()).toBe(2026)
    expect(d.getUTCMonth()).toBe(5) // 0-indexed -> June
    expect(d.getUTCDate()).toBe(16)
    expect(d.getUTCHours()).toBe(3)
  })

  it('daysAgoWIB(0) is today, daysAgoWIB(1) is yesterday, in WIB', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T20:00:00.000Z')) // WIB today = 2026-06-16
    expect(daysAgoWIB(0)).toBe('2026-06-16')
    expect(daysAgoWIB(1)).toBe('2026-06-15')
    expect(daysAgoWIB(7)).toBe('2026-06-09')
  })
})

describe('resolvePeriod', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T20:00:00.000Z')) // WIB "today" = 2026-06-16
  })
  afterEach(() => { vi.useRealTimers() })

  it('kemarin = yesterday (WIB), both ends equal', () => {
    expect(resolvePeriod('kemarin')).toEqual({ from: '2026-06-15', to: '2026-06-15' })
  })

  it('7d = a 7-day inclusive window ending today (WIB)', () => {
    expect(resolvePeriod('7d')).toEqual({ from: '2026-06-10', to: '2026-06-16' })
  })

  it('14d = a 14-day inclusive window ending today (WIB)', () => {
    expect(resolvePeriod('14d')).toEqual({ from: '2026-06-03', to: '2026-06-16' })
  })
})

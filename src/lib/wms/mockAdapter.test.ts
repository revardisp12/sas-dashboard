import { describe, it, expect } from 'vitest'
import { MockWmsAdapter } from './mockAdapter'

const range = { start: '2026-06-01', end: '2026-06-03' }

describe('MockWmsAdapter', () => {
  it('reports mock mode', () => {
    expect(new MockWmsAdapter().mode).toBe('mock')
  })

  it('returns deterministic sales rows with stable wmsId per brand/date', async () => {
    const a = await new MockWmsAdapter().fetchSales!('reglow', range)
    const b = await new MockWmsAdapter().fetchSales!('reglow', range)
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(0)
    expect(a.every(r => r.wmsId.startsWith('reglow-sales-'))).toBe(true)
    expect(a.every(r => r.date >= range.start && r.date <= range.end)).toBe(true)
  })

  it('gives different brands different wmsId namespaces', async () => {
    const r = await new MockWmsAdapter().fetchSales!('reglow', range)
    const m = await new MockWmsAdapter().fetchSales!('amura', range)
    expect(r[0].wmsId).not.toBe(m[0].wmsId)
  })
})

import { describe, it, expect } from 'vitest'
import { getSegment, calcRFM } from './rfm'
import type { CRMRow, RFMSegment } from './types'

const ALL_SEGMENTS: RFMSegment[] = [
  'Champions', 'Loyal Customers', 'Potential Loyalist', 'New Customers',
  'Promising', 'Need Attention', 'About to Sleep', "Can't Lose Them",
  'At Risk', 'Hibernating',
]

function row(name: string, date: string, revenue = 100000): CRMRow {
  return { date, customerName: name, phone: name, product: 'X', qty: 1, revenue }
}

describe('getSegment', () => {
  it('returns a valid segment for every (r,f) cell in the 5x5 grid', () => {
    for (let r = 1; r <= 5; r++) {
      for (let f = 1; f <= 5; f++) {
        expect(ALL_SEGMENTS).toContain(getSegment(r, f))
      }
    }
  })

  it('makes all 10 segments reachable across the grid (no dead segments)', () => {
    const seen = new Set<RFMSegment>()
    for (let r = 1; r <= 5; r++) {
      for (let f = 1; f <= 5; f++) seen.add(getSegment(r, f))
    }
    for (const s of ALL_SEGMENTS) expect(seen).toContain(s)
  })

  it('reaches the previously-dead segments at their canonical cells', () => {
    // These three were unreachable due to broad rules shadowing them.
    expect(getSegment(5, 1)).toBe('New Customers')
    expect(getSegment(4, 1)).toBe('Promising')
    expect(getSegment(3, 3)).toBe('Need Attention')
  })

  it('anchors the corners correctly', () => {
    expect(getSegment(5, 5)).toBe('Champions')
    expect(getSegment(1, 1)).toBe('Hibernating')
  })
})

describe('calcRFM scoring', () => {
  it('does not collapse everyone to fScore=1 when all frequencies are equal', () => {
    // Five customers, each with exactly one order (frequency all = 1).
    // The bug scored them all fScore=1, making Champions impossible and
    // dumping recent buyers into At Risk / Hibernating. A no-spread metric
    // carries no signal, so it should fall back to a neutral score.
    const data: CRMRow[] = [
      row('A', '2026-05-01'),
      row('B', '2026-05-05'),
      row('C', '2026-05-10'),
      row('D', '2026-05-15'),
      row('E', '2026-05-20'),
    ]
    const result = calcRFM(data)
    expect(result).toHaveLength(5)
    expect(result.every(c => c.fScore !== 1)).toBe(true)
    expect(result.every(c => c.fScore === 3)).toBe(true)
    // No customer should be labelled a frequency-driven loss segment purely
    // because frequency collapsed.
    expect(result.some(c => c.segment === 'Hibernating')).toBe(false)
  })

  it('still surfaces a genuine Champion when one customer is recent + frequent', () => {
    const data: CRMRow[] = [
      // A: most frequent and most recent -> should top both R and F.
      row('A', '2026-05-18'), row('A', '2026-05-19'),
      row('A', '2026-05-20'), row('A', '2026-05-21'),
      row('B', '2026-04-01'),
      row('C', '2026-03-15'),
      row('D', '2026-02-10'),
    ]
    const a = calcRFM(data).find(c => c.customerName === 'A')!
    expect(a.fScore).toBeGreaterThanOrEqual(4)
    expect(a.rScore).toBeGreaterThanOrEqual(4)
    expect(a.segment).toBe('Champions')
  })
})

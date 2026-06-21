import { describe, it, expect } from 'vitest'
import {
  safeDiv, considerationBuilt, awarenessImplied, buyersFromConsideration,
  gmvFrom, gmvMaxBaseline, gmvMaxWithUplift, blendedRoas, calcCAds,
  type CAdsInputs,
} from './cads'

describe('cads helpers', () => {
  it('safeDiv guards divide-by-zero', () => {
    expect(safeDiv(10, 2)).toBe(5)
    expect(safeDiv(10, 0)).toBe(0)
  })
  it('considerationBuilt = budget / cpco', () => {
    expect(considerationBuilt(15_000_000, 1_500)).toBe(10_000)
    expect(considerationBuilt(15_000_000, 0)).toBe(0)
  })
  it('awarenessImplied = consideration / awToCoRate', () => {
    expect(awarenessImplied(10_000, 0.1)).toBe(100_000)
    expect(awarenessImplied(10_000, 0)).toBe(0)
  })
  it('buyersFromConsideration = consideration * rate', () => {
    expect(buyersFromConsideration(10_000, 0.02)).toBe(200)
  })
  it('gmvFrom = buyers * aov', () => {
    expect(gmvFrom(200, 150_000)).toBe(30_000_000)
  })
  it('gmvMaxBaseline = budget * roas', () => {
    expect(gmvMaxBaseline(35_000_000, 5)).toBe(175_000_000)
  })
  it('gmvMaxWithUplift = baseline * (1 + uplift)', () => {
    expect(gmvMaxWithUplift(175_000_000, 0.18)).toBe(206_500_000)
  })
  it('blendedRoas = gmv / totalBudget, guarded', () => {
    expect(blendedRoas(206_500_000, 50_000_000)).toBeCloseTo(4.13, 2)
    expect(blendedRoas(1, 0)).toBe(0)
  })
})

describe('calcCAds (orchestrator)', () => {
  const inp: CAdsInputs = {
    totalBudget: 50_000_000, consiShare: 0.3, cpco: 1_500,
    awToCoRate: 0.103, coToBuyerRate: 0.02, aov: 150_000,
    gmvMaxRoas: 5, consiUplift: 0.18,
  }
  const r = calcCAds(inp)

  it('splits the budget by consiShare', () => {
    expect(r.budgetConsi).toBe(15_000_000)
    expect(r.budgetGmvMax).toBe(35_000_000)
  })
  it('builds the funnel cascade', () => {
    expect(r.considerationBuilt).toBe(10_000)
    expect(r.awarenessImplied).toBeCloseTo(97_087, 0)
    expect(r.buyersFromConsi).toBe(200)
    expect(r.gmvFromConsi).toBe(30_000_000)
    expect(r.cpNewBuyer).toBe(75_000)
  })
  it('computes the conservative cross-impact (no double count)', () => {
    expect(r.gmvMaxBaseline).toBe(175_000_000)
    expect(r.gmvMaxWithConsi).toBe(206_500_000)
    expect(r.incrementalGmv).toBe(31_500_000)
    expect(r.roasGmvMaxOnly).toBe(5)
    expect(r.blendedRoas).toBeCloseTo(4.13, 2)
    expect(r.roasDelta).toBeCloseTo(-0.87, 2)
  })
  it('is divide-by-zero safe with empty inputs', () => {
    const z = calcCAds({ totalBudget: 0, consiShare: 0, cpco: 0, awToCoRate: 0, coToBuyerRate: 0, aov: 0, gmvMaxRoas: 0, consiUplift: 0 })
    expect(z.considerationBuilt).toBe(0)
    expect(z.blendedRoas).toBe(0)
    expect(Number.isFinite(z.cpNewBuyer)).toBe(true)
  })
})

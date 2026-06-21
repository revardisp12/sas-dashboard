import { describe, it, expect } from 'vitest'
import {
  safeDiv, targetCo, audienceGap, gmvMaxBaseline, gmvMaxWithUplift, blendedRoas,
  calcPlan, type PlanInputs,
} from './cads'

describe('cads V2 helpers', () => {
  it('safeDiv guards divide-by-zero', () => {
    expect(safeDiv(10, 2)).toBe(5)
    expect(safeDiv(10, 0)).toBe(0)
  })
  it('targetCo = benchmark × ambition', () => {
    expect(targetCo(3_000_000, 0.5)).toBe(1_500_000)
    expect(targetCo(3_866_994, 0.6)).toBeCloseTo(2_320_196, 0)
  })
  it('audienceGap = max(0, target − coNow) — never negative', () => {
    expect(audienceGap(1_500_000, 1_000_000)).toBe(500_000)
    expect(audienceGap(1_000_000, 1_500_000)).toBe(0)
  })
  it('gmvMax helpers', () => {
    expect(gmvMaxBaseline(35_000_000, 5)).toBe(175_000_000)
    expect(gmvMaxWithUplift(175_000_000, 0.18)).toBe(206_500_000)
    expect(blendedRoas(206_500_000, 85_000_000)).toBeCloseTo(2.43, 2)
    expect(blendedRoas(1, 0)).toBe(0)
  })
})

describe('calcPlan (orchestrator)', () => {
  const inp: PlanInputs = {
    coNow: 1_000_000, coBenchmark: 3_000_000, ambition: 0.5,
    cpco: 100, coToSales: 0.01, aov: 150_000,
    gmvMaxBudget: 35_000_000, gmvMaxRoas: 5, consiUplift: 0.18,
  }
  const r = calcPlan(inp)

  it('Step 1 — target & gap', () => {
    expect(r.targetCo).toBe(1_500_000)
    expect(r.audienceGap).toBe(500_000)
  })
  it('Step 2 — direct (AM) lens', () => {
    expect(r.considerationBudget).toBe(50_000_000)   // 500k × 100
    expect(r.incrementalBuyers).toBe(5_000)          // 500k × 1%
    expect(r.incrementalGmv).toBe(750_000_000)       // 5k × 150k
    expect(r.considerationRoas).toBe(15)             // 750M / 50M
  })
  it('Step 3 — cross-impact lens (no double count)', () => {
    expect(r.gmvMaxBaseline).toBe(175_000_000)
    expect(r.gmvMaxWithConsi).toBe(206_500_000)
    expect(r.gmvMaxUpliftGmv).toBe(31_500_000)
    expect(r.totalBudget).toBe(85_000_000)           // 50M + 35M
    expect(r.roasGmvMaxOnly).toBe(5)
    expect(r.blendedRoas).toBeCloseTo(2.43, 2)        // 206.5M / 85M
    expect(r.roasDelta).toBeCloseTo(-2.57, 2)
  })
  it('gap floors at 0 when already above target (no negative budget)', () => {
    const z = calcPlan({ ...inp, coNow: 5_000_000 })
    expect(z.audienceGap).toBe(0)
    expect(z.considerationBudget).toBe(0)
    expect(z.incrementalGmv).toBe(0)
    expect(Number.isFinite(z.considerationRoas)).toBe(true)
  })
  it('all-zero inputs stay finite', () => {
    const z = calcPlan({ coNow: 0, coBenchmark: 0, ambition: 0, cpco: 0, coToSales: 0, aov: 0, gmvMaxBudget: 0, gmvMaxRoas: 0, consiUplift: 0 })
    expect(z.blendedRoas).toBe(0)
    expect(Number.isFinite(z.considerationRoas)).toBe(true)
  })
})

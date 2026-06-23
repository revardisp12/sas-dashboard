# C-Ads Calculator V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Upgrade the C-Ads Calculator into a chained 3-step planner (Target → Budget → Worth-it) that combines the TikTok AM's audience-gap→budget engine with our GMV Max cross-impact / blended-ROAS lens — keeping inputs simple.

**Architecture:** Rewrite the pure calc core `src/lib/cads.ts` around a single orchestrator `calcPlan()` (rewriting `cads.test.ts`), and rewrite the view `CAdsCalculatorView.tsx` into 3 stacked sections. No routing/nav changes (the `'cads-calculator'` view already exists from P1). The old P1 forward-cascade functions are removed (only `CAdsCalculatorView` used them).

**Tech Stack:** Next.js client component, TypeScript, Tailwind + inline styles, vitest. Reuse `MetricCard`, `fmtCurrency`/`fmtNum` from `@/lib/utils`, brand accent.

**Model (combined, verified against the AM's Purela sheet):**
- Step 1 Target: `targetCo = benchmark × ambition`; `gap = max(0, targetCo − coNow)`
- Step 2 Budget (AM direct lens): `considerationBudget = gap × cpco`; `incrementalBuyers = gap × coToSales`; `incrementalGmv = incrementalBuyers × aov`; `considerationRoas = incrementalGmv / considerationBudget`
- Step 3 Worth-it (our cross-impact lens): `gmvMaxBaseline = gmvMaxBudget × gmvMaxRoas`; `gmvMaxWithConsi = baseline × (1+uplift)`; `totalBudget = considerationBudget + gmvMaxBudget`; `blendedRoas = gmvMaxWithConsi / totalBudget`; compare vs `roasGmvMaxOnly = baseline / gmvMaxBudget`

**Anti-double-count (important):** the Step-2 direct lens (`incrementalGmv`) and the Step-3 cross-impact lens (`blendedRoas`) are TWO separate ways to value Consideration — they must be shown as separate lenses and NEVER summed. The headline decision metric is `blendedRoas`. We simplified the AM's 95%/5% consideration/branding touchpoint split into a single `cpco` (all gap-closing spend treated as consideration) — slightly conservative.

---

### Task 1: Rewrite calc core `src/lib/cads.ts` (TDD)

**Files:**
- Rewrite: `src/lib/cads.ts`
- Rewrite: `src/lib/cads.test.ts`

- [ ] **Step 1: Replace the test file with V2 tests**

Overwrite `src/lib/cads.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/cads.test.ts`
Expected: FAIL (`calcPlan`/`targetCo` not exported)

- [ ] **Step 3: Rewrite `src/lib/cads.ts`**

Overwrite `src/lib/cads.ts`:

```ts
// C-Ads Calculator V2 — chained planner combining the TikTok AM's
// audience-gap→budget engine with our GMV Max cross-impact / blended-ROAS lens.
// All rates are decimals (0.01 = 1%). The Step-2 "direct" lens (incrementalGmv)
// and the Step-3 "cross-impact" lens (blendedRoas) are TWO separate ways to value
// Consideration — never sum them. Headline decision metric = blendedRoas.

export interface PlanInputs {
  // Step 1 — Target
  coNow: number        // current Consideration audience
  coBenchmark: number  // category benchmark Consideration audience (Top 5)
  ambition: number     // 0..1 — share of benchmark to grow to
  // Step 2 — Budget
  cpco: number         // Rp — cost per (new) consideration
  coToSales: number    // 0..1 — Consideration -> Sales conversion rate
  aov: number          // Rp — average order value
  // Step 3 — Worth it (cross-impact)
  gmvMaxBudget: number // Rp — budget on GMV Max
  gmvMaxRoas: number   // GMV Max baseline ROAS
  consiUplift: number  // 0..1 — uplift Consideration gives to GMV Max
}

export interface PlanResult {
  targetCo: number
  audienceGap: number
  considerationBudget: number
  incrementalBuyers: number
  incrementalGmv: number
  considerationRoas: number
  gmvMaxBaseline: number
  gmvMaxWithConsi: number
  gmvMaxUpliftGmv: number
  totalBudget: number
  roasGmvMaxOnly: number
  blendedRoas: number
  roasDelta: number
}

export function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b
}
export function targetCo(benchmark: number, ambition: number): number {
  return benchmark * ambition
}
export function audienceGap(target: number, coNow: number): number {
  return Math.max(0, target - coNow)
}
export function gmvMaxBaseline(budget: number, roas: number): number {
  return budget * roas
}
export function gmvMaxWithUplift(baseline: number, uplift: number): number {
  return baseline * (1 + uplift)
}
export function blendedRoas(gmv: number, totalBudget: number): number {
  return safeDiv(gmv, totalBudget)
}

export function calcPlan(inp: PlanInputs): PlanResult {
  const target = targetCo(inp.coBenchmark, inp.ambition)
  const gap = audienceGap(target, inp.coNow)

  const considerationBudget = gap * inp.cpco
  const incrementalBuyers = gap * inp.coToSales
  const incrementalGmv = incrementalBuyers * inp.aov
  const considerationRoas = safeDiv(incrementalGmv, considerationBudget)

  const baseline = gmvMaxBaseline(inp.gmvMaxBudget, inp.gmvMaxRoas)
  const withConsi = gmvMaxWithUplift(baseline, inp.consiUplift)
  const totalBudget = considerationBudget + inp.gmvMaxBudget
  const roasOnly = safeDiv(baseline, inp.gmvMaxBudget)
  const blended = blendedRoas(withConsi, totalBudget)

  return {
    targetCo: target,
    audienceGap: gap,
    considerationBudget,
    incrementalBuyers,
    incrementalGmv,
    considerationRoas,
    gmvMaxBaseline: baseline,
    gmvMaxWithConsi: withConsi,
    gmvMaxUpliftGmv: withConsi - baseline,
    totalBudget,
    roasGmvMaxOnly: roasOnly,
    blendedRoas: blended,
    roasDelta: blended - roasOnly,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/cads.test.ts` → Expected: PASS (all green)

- [ ] **Step 5: Commit**

```bash
git add src/lib/cads.ts src/lib/cads.test.ts
git commit -m "feat(cads): V2 calc core — chained Target→Budget→Worth-it planner"
```

---

### Task 2: Rewrite the view `CAdsCalculatorView.tsx`

**Files:**
- Rewrite: `src/components/views/CAdsCalculatorView.tsx`

Build a single client component (`'use client'`, `export default function CAdsCalculatorView({ brand }: { brand: Brand })`) with 3 stacked sections, using `useState` for the 9 inputs (percent fields stored as whole numbers, converted to decimals for `calcPlan` via `useMemo`). Reuse the existing styling vocabulary from the current file (the `NumField` helper, `MetricCard`, brand `ACCENT` map, `fmtCurrency`/`fmtNum`). Keep it clean and readable — sliders/number fields, big output cards, NOT a dense grid.

**Inputs + defaults:**
| Field | State key | Default | Unit |
|---|---|---|---|
| Co audience sekarang | `coNow` | 1_000_000 | number |
| Benchmark kategori | `coBenchmark` | 3_000_000 | number |
| Ambisi | `ambitionPct` | 80 | % |
| CPCo | `cpco` | 200 | Rp |
| Co→Sales rate | `coToSalesPct` | 1 | % |
| AOV | `aov` | 150_000 | Rp |
| Budget GMV Max | `gmvMaxBudget` | 35_000_000 | Rp |
| GMV Max ROAS | `gmvMaxRoas` | 5 | x |
| Uplift Consi→GMV Max | `upliftPct` | 18 | % |

Map to `PlanInputs`: `ambition: ambitionPct/100`, `coToSales: coToSalesPct/100`, `consiUplift: upliftPct/100`; others pass through. Compute `const r = useMemo(() => calcPlan(inputs), [inputs])`.

**Layout (top → bottom):**

1. **Header** — Calculator icon + title "C-Ads Calculator" + subtitle: "Plan budget Consideration dari target audience → cek worth-it-nya ke GMV Max. Default = benchmark; ganti pakai data real Market Scope/Ads Manager."

2. **Section 1 — 🎯 Target** (panel, light bg). 3 `NumField`s (coNow, coBenchmark, ambitionPct). Output row (2 `MetricCard`s): "Target Consideration" = `fmtNum(round(r.targetCo))`; "Audience Gap" = `fmtNum(round(r.audienceGap))` sub "yang harus ditambah".

3. **Section 2 — 💰 Budget (lens langsung / AM)** (panel). 3 `NumField`s (cpco, coToSalesPct, aov). Output row (3-4 `MetricCard`s): "Budget Consideration" = `fmtCurrency(r.considerationBudget)` sub "gap × CPCo"; "Pembeli tambahan" = `fmtNum(round(r.incrementalBuyers))`; "Est. GMV (langsung)" = `fmtCurrency(r.incrementalGmv)`; "ROAS Consideration" = `r.considerationRoas.toFixed(2)+'x'`.

4. **Section 3 — ⚖️ Worth it? (cross-impact ke GMV Max)** (panel). 3 `NumField`s (gmvMaxBudget, gmvMaxRoas, upliftPct). Output row (3-4 `MetricCard`s): "GMV Max baseline" sub `ROAS r.roasGmvMaxOnly.toFixed(2)x`; "GMV Max + Consi" sub `+${upliftPct}% uplift`; "Total budget" = `fmtCurrency(r.totalBudget)`; "Blended ROAS" = `r.blendedRoas.toFixed(2)+'x'` accent green if `r.roasDelta>=0` else red, sub `${delta>=0?'+':''}${r.roasDelta.toFixed(2)}x vs GMV Max-only`. Plus a verdict banner (green/red) like P1: worth-it if `r.roasDelta >= 0`.

5. **Footer note** (small, muted): "2 lensa nilai Consideration — *Est. GMV langsung* (lens 1) & *Blended ROAS* (lens 3) JANGAN dijumlah (bisa double-count). Metrik keputusan = Blended ROAS."

Keep numbers readable: round audience/buyer counts with `fmtNum`, money with `fmtCurrency`, ratios with `.toFixed(2)+'x'`. Inputs NaN-safe (the existing `NumField` clamps with `Math.max(0, Number(...))`).

- [ ] **Step 1: Rewrite the component** per the spec above (reuse the current file's `NumField` + styling patterns).

- [ ] **Step 2: Lint** — `npm run lint` → no new errors for `cads`/`CAdsCalculatorView`.

- [ ] **Step 3: Commit**

```bash
git add src/components/views/CAdsCalculatorView.tsx
git commit -m "feat(cads): V2 view — 3-step Target/Budget/Worth-it layout"
```

---

### Task 3: Local verification (DO NOT PUSH)

- [ ] `npm test` → all pass (incl. new `cads.test.ts`).
- [ ] `npm run lint` → clean.
- [ ] Manual: open the C-Ads Calculator. With defaults (coNow 1M, benchmark 3M, ambition 80%): Target 2.4M, Gap 1.4M. Change ambition slider → gap & budget update live. Confirm Blended ROAS card + verdict banner behave (raise uplift → flips green). Confirm the two-lens footer note is present.
- [ ] STOP — report and hand to user; do NOT push/PR until user approves.

## Self-Review
- Coverage: Target/gap (T1), AM direct lens (T1), cross-impact blended ROAS (T1), simple chained view (T2), local verify (T3). ✓
- Placeholders: none. ✓
- Type consistency: `PlanInputs`/`PlanResult` field names identical across `cads.ts`, `cads.test.ts`, view (`targetCo`, `audienceGap`, `considerationBudget`, `incrementalBuyers`, `incrementalGmv`, `considerationRoas`, `gmvMaxWithConsi`, `blendedRoas`, `roasDelta`). ✓
- Anti-double-count documented + enforced (two lenses not summed). ✓

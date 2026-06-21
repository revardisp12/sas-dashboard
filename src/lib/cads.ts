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

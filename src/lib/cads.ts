// Pure, unit-tested calculation core for the C-Ads (Brand Consideration Ads) Calculator.
// Models the TikTok ACC funnel cascade + the cross-impact of Consideration Ads on GMV Max.
// All rates are decimals (0.103 = 10.3%). No double-counting: the headline blended ROAS
// credits Consideration ONLY via its uplift to GMV Max (conservative model). The funnel
// cascade fields are an "audience-building" lens shown separately, not summed into ROAS.

export interface CAdsInputs {
  totalBudget: number   // Rp — total monthly ad budget across both kantong
  consiShare: number    // 0..1 — share of budget to Consideration ads
  cpco: number          // Rp — cost per consideration
  awToCoRate: number    // 0..1 — Awareness -> Consideration transition rate
  coToBuyerRate: number // 0..1 — Consideration -> Buyer rate
  aov: number           // Rp — average GMV per buyer
  gmvMaxRoas: number    // GMV Max baseline ROAS (GMV per Rp spent)
  consiUplift: number   // 0..1 — uplift Consideration gives to GMV Max GMV
}

export interface CAdsResult {
  budgetConsi: number
  budgetGmvMax: number
  // Funnel-building lens (audience the Consi budget builds; may overlap GMV Max buyers)
  considerationBuilt: number
  awarenessImplied: number
  buyersFromConsi: number
  gmvFromConsi: number
  cpNewBuyer: number
  // Cross-impact lens (conservative business view — no double counting)
  gmvMaxBaseline: number
  gmvMaxWithConsi: number
  incrementalGmv: number
  roasGmvMaxOnly: number
  blendedRoas: number
  roasDelta: number
}

export function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b
}
export function considerationBuilt(budgetConsi: number, cpco: number): number {
  return safeDiv(budgetConsi, cpco)
}
export function awarenessImplied(consideration: number, awToCoRate: number): number {
  return safeDiv(consideration, awToCoRate)
}
export function buyersFromConsideration(consideration: number, coToBuyerRate: number): number {
  return consideration * coToBuyerRate
}
export function gmvFrom(buyers: number, aov: number): number {
  return buyers * aov
}
export function gmvMaxBaseline(budgetGmvMax: number, roas: number): number {
  return budgetGmvMax * roas
}
export function gmvMaxWithUplift(baseline: number, uplift: number): number {
  return baseline * (1 + uplift)
}
export function blendedRoas(gmv: number, totalBudget: number): number {
  return safeDiv(gmv, totalBudget)
}

export function calcCAds(inp: CAdsInputs): CAdsResult {
  const budgetConsi = inp.totalBudget * inp.consiShare
  const budgetGmvMax = inp.totalBudget - budgetConsi

  const consider = considerationBuilt(budgetConsi, inp.cpco)
  const awareness = awarenessImplied(consider, inp.awToCoRate)
  const buyers = buyersFromConsideration(consider, inp.coToBuyerRate)
  const gmvConsi = gmvFrom(buyers, inp.aov)
  const cpNew = safeDiv(budgetConsi, buyers)

  const baseline = gmvMaxBaseline(budgetGmvMax, inp.gmvMaxRoas)
  const withConsi = gmvMaxWithUplift(baseline, inp.consiUplift)
  const roasOnly = blendedRoas(baseline, budgetGmvMax)
  const blended = blendedRoas(withConsi, inp.totalBudget)

  return {
    budgetConsi, budgetGmvMax,
    considerationBuilt: consider,
    awarenessImplied: awareness,
    buyersFromConsi: buyers,
    gmvFromConsi: gmvConsi,
    cpNewBuyer: cpNew,
    gmvMaxBaseline: baseline,
    gmvMaxWithConsi: withConsi,
    incrementalGmv: withConsi - baseline,
    roasGmvMaxOnly: roasOnly,
    blendedRoas: blended,
    roasDelta: blended - roasOnly,
  }
}

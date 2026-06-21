# C-Ads Calculator (P1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "C-Ads Calculator" view to the SAS Dashboard that models the TikTok ACC funnel cascade and the cross-impact of Brand Consideration Ads on GMV Max, with manual inputs and live results.

**Architecture:** Pure calculation logic lives in `src/lib/cads.ts` (unit-tested with vitest, mirroring `rfm.ts`/`csvParser.ts`). The UI is a new client view component `src/components/views/CAdsCalculatorView.tsx`, wired into the existing view-switch in `src/app/page.tsx` and the `Sidebar.tsx` nav, following the exact same pattern as `PerformanceView`. No backend/DB changes in P1 — inputs are manual; wiring to real data is P2.

**Tech Stack:** Next.js (App Router, client components), TypeScript, Tailwind + inline styles, vitest. Reuses `MetricCard`, `fmtCurrency`/`fmtNum` from `@/lib/utils`, brand accent colors.

**Modeling decisions (locked):**
- No double-counting: the **headline Blended ROAS credits Consideration ONLY via its uplift to GMV Max** (conservative). The funnel cascade (Awareness→Consideration→Buyers) is shown as a separate "audience-building" lens, clearly labeled, and is NOT summed into Blended ROAS.
- Backward target-setting (target buyers → required budget) is **deferred to P2**.
- P1 inputs are manual with deck-benchmark defaults (Aw→Co 10.3%, Co→Buyer 2%, uplift 18%).

**Constraint:** Build on a feature branch off `dev`. Verify locally (`npm test` + `npm run dev`). **Do NOT push / open PR until the user verifies locally.**

---

### Task 1: Create feature branch off `dev`

**Files:** none (git only)

- [ ] **Step 1: Confirm clean-ish state and current branch**

Run: `git -C "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Claude/sas-dashboard" branch --show-current`
Expected: `dev`

- [ ] **Step 2: Create and switch to the feature branch**

```bash
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Claude/sas-dashboard"
git checkout -b feature/cads-calculator
```
Expected: `Switched to a new branch 'feature/cads-calculator'`

Note: the repo has iCloud-duplicate files (e.g. `BudgetTab 2.tsx`). Do NOT add or edit any file whose name ends in ` 2.tsx`/` 2.ts`/` 2.sql` — they are sync artifacts. Only touch the exact paths named in this plan.

---

### Task 2: Calculation core `src/lib/cads.ts` (TDD)

**Files:**
- Create: `src/lib/cads.ts`
- Test: `src/lib/cads.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/cads.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/cads.test.ts`
Expected: FAIL — `Cannot find module './cads'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/cads.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/cads.test.ts`
Expected: PASS (all tests green)

- [ ] **Step 5: Commit**

```bash
git add src/lib/cads.ts src/lib/cads.test.ts
git commit -m "feat(cads): add C-Ads calculator calculation core + tests"
```

---

### Task 3: View component `CAdsCalculatorView.tsx`

**Files:**
- Create: `src/components/views/CAdsCalculatorView.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/views/CAdsCalculatorView.tsx`:

```tsx
'use client'
import { useState, useMemo } from 'react'
import { Brand } from '@/lib/types'
import { calcCAds, type CAdsInputs } from '@/lib/cads'
import { fmtCurrency, fmtNum } from '@/lib/utils'
import MetricCard from '@/components/MetricCard'
import { Calculator, Users, ShoppingCart, TrendingUp, Wallet } from 'lucide-react'

const ACCENT: Record<Brand, string> = { reglow: '#C9A96E', amura: '#8FB050', purela: '#9B7FD4' }

const DEFAULTS = {
  totalBudget: 50_000_000,
  consiSharePct: 30,   // %
  cpco: 1_500,         // Rp
  awToCoPct: 10.3,     // %
  coToBuyerPct: 2,     // %
  aov: 150_000,        // Rp
  gmvMaxRoas: 5,
  consiUpliftPct: 18,  // %
}

function NumField({ label, value, onChange, suffix, step = 1 }: {
  label: string; value: number; onChange: (n: number) => void; suffix?: string; step?: number
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: '#6B7280' }}>{label}</span>
      <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
        <input type="number" value={value} step={step} min={0}
          onChange={e => onChange(Math.max(0, Number(e.target.value)))}
          className="w-full bg-transparent outline-none text-sm" style={{ color: '#111827' }} />
        {suffix && <span className="text-xs flex-shrink-0" style={{ color: '#9CA3AF' }}>{suffix}</span>}
      </div>
    </label>
  )
}

export default function CAdsCalculatorView({ brand }: { brand: Brand }) {
  const accent = ACCENT[brand]
  const [f, setF] = useState(DEFAULTS)
  const set = (k: keyof typeof DEFAULTS) => (n: number) => setF(p => ({ ...p, [k]: n }))

  const inputs: CAdsInputs = useMemo(() => ({
    totalBudget: f.totalBudget,
    consiShare: f.consiSharePct / 100,
    cpco: f.cpco,
    awToCoRate: f.awToCoPct / 100,
    coToBuyerRate: f.coToBuyerPct / 100,
    aov: f.aov,
    gmvMaxRoas: f.gmvMaxRoas,
    consiUplift: f.consiUpliftPct / 100,
  }), [f])

  const r = useMemo(() => calcCAds(inputs), [inputs])
  const worthIt = r.roasDelta >= 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${accent}1A`, color: accent }}>
          <Calculator size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#111827' }}>C-Ads Calculator</h2>
          <p className="text-xs" style={{ color: '#6B7280' }}>Model split budget Consideration vs GMV Max → blended ROAS. Angka default = benchmark TikTok TTMS; ganti pakai data lo.</p>
        </div>
      </div>

      {/* Inputs */}
      <div className="rounded-2xl p-5" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NumField label="Total Budget" value={f.totalBudget} onChange={set('totalBudget')} suffix="Rp" step={1_000_000} />
          <NumField label="Split ke Consi" value={f.consiSharePct} onChange={set('consiSharePct')} suffix="%" />
          <NumField label="CPCo" value={f.cpco} onChange={set('cpco')} suffix="Rp" step={100} />
          <NumField label="AOV / buyer" value={f.aov} onChange={set('aov')} suffix="Rp" step={10_000} />
          <NumField label="Aw → Co rate" value={f.awToCoPct} onChange={set('awToCoPct')} suffix="%" step={0.1} />
          <NumField label="Co → Buyer rate" value={f.coToBuyerPct} onChange={set('coToBuyerPct')} suffix="%" step={0.1} />
          <NumField label="GMV Max ROAS" value={f.gmvMaxRoas} onChange={set('gmvMaxRoas')} suffix="x" step={0.1} />
          <NumField label="Uplift ke GMV Max" value={f.consiUpliftPct} onChange={set('consiUpliftPct')} suffix="%" step={0.1} />
        </div>
        <div className="mt-3 text-[11px]" style={{ color: '#9CA3AF' }}>
          Budget Consi: <b style={{ color: accent }}>{fmtCurrency(r.budgetConsi)}</b> · Budget GMV Max: <b style={{ color: accent }}>{fmtCurrency(r.budgetGmvMax)}</b>
        </div>
      </div>

      {/* Lens 1: Funnel cascade (audience building) */}
      <div>
        <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#6B7280' }}>Audience Building (Cascade)</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Awareness (implied)" value={fmtNum(Math.round(r.awarenessImplied))} icon={<TrendingUp size={16} />} accent="#8B5CF6" sub="dari Co ÷ Aw→Co rate" />
          <MetricCard label="Consideration dibangun" value={fmtNum(Math.round(r.considerationBuilt))} icon={<Users size={16} />} accent={accent} sub="Budget Consi ÷ CPCo" />
          <MetricCard label="Buyers (cascade)" value={fmtNum(Math.round(r.buyersFromConsi))} icon={<ShoppingCart size={16} />} accent="#10B981" sub="lens audiens, bisa overlap GMV Max" />
          <MetricCard label="CP / New Buyer" value={fmtCurrency(r.cpNewBuyer)} icon={<Wallet size={16} />} accent="#F07830" />
        </div>
      </div>

      {/* Lens 2: Cross-impact (the decision) */}
      <div>
        <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#6B7280' }}>Cross-Impact ke GMV Max (Konservatif)</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="GMV Max (baseline)" value={fmtCurrency(r.gmvMaxBaseline)} accent="#9CA3AF" sub={`ROAS ${r.roasGmvMaxOnly.toFixed(2)}x`} />
          <MetricCard label="GMV Max + Consi" value={fmtCurrency(r.gmvMaxWithConsi)} accent={accent} sub={`+${f.consiUpliftPct}% uplift`} />
          <MetricCard label="Incremental GMV" value={fmtCurrency(r.incrementalGmv)} icon={<TrendingUp size={16} />} accent="#10B981" />
          <MetricCard label="Blended ROAS" value={`${r.blendedRoas.toFixed(2)}x`} icon={<TrendingUp size={16} />} accent={worthIt ? '#10B981' : '#EF4444'} sub={`${worthIt ? '+' : ''}${r.roasDelta.toFixed(2)}x vs GMV Max-only`} />
        </div>
        <div className="mt-3 rounded-xl px-4 py-3 text-sm" style={{ background: worthIt ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', color: worthIt ? '#047857' : '#B91C1C' }}>
          {worthIt
            ? `✅ Split ini WORTH IT: blended ROAS (${r.blendedRoas.toFixed(2)}x) ≥ GMV Max-only (${r.roasGmvMaxOnly.toFixed(2)}x). Uplift Consi nutupin budget yang digeser.`
            : `⚠️ Split ini belum worth it: blended ROAS (${r.blendedRoas.toFixed(2)}x) < GMV Max-only (${r.roasGmvMaxOnly.toFixed(2)}x). Kecilin split Consi, naikin uplift, atau turunin CPCo.`}
        </div>
      </div>

      <p className="text-[11px]" style={{ color: '#9CA3AF' }}>
        Catatan: &quot;Buyers (cascade)&quot; itu lens pembangunan audiens dan bisa overlap dengan pembeli GMV Max — makanya Blended ROAS cuma ngitung uplift Consi ke GMV Max biar gak double-count.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/views/CAdsCalculatorView.tsx
git commit -m "feat(cads): add C-Ads calculator view component"
```

---

### Task 4: Wire the view into routing + nav

**Files:**
- Modify: `src/lib/types.ts:3`
- Modify: `src/app/page.tsx` (imports, VIEW_LABELS, render switch)
- Modify: `src/components/Sidebar.tsx` (lucide import + nav item)

- [ ] **Step 1: Add the view to the `ActiveView` union**

In `src/lib/types.ts` line 3, append `| 'cads-calculator'`:

```ts
export type ActiveView = Platform | 'overview' | 'funnel' | 'performance' | 'sales' | 'crm' | 'product-analysis' | 'settings' | 'kol' | 'cads-calculator'
```

- [ ] **Step 2: Import the view + label + render branch in `page.tsx`**

Add the import next to the other view imports (near `import PerformanceView from '@/components/views/PerformanceView'`):

```ts
import CAdsCalculatorView from '@/components/views/CAdsCalculatorView'
```

In the `VIEW_LABELS` object, add the entry (after `kol: 'KOL Management',`):

```ts
  'cads-calculator': 'C-Ads Calculator',
```

In the render switch, add a branch right after the `performance` line:

```tsx
          {view === 'cads-calculator' && <CAdsCalculatorView brand={brand} />}
```

- [ ] **Step 3: Add the nav item in `Sidebar.tsx`**

Add `Calculator` to the lucide-react import list (the `import { ... } from 'lucide-react'` block near the top):

```ts
  ChevronDown, ChevronRight, LayoutDashboard, TrendingUp,
  ShoppingCart, LogOut, Users, Package, Settings, Activity, FileText, RefreshCw, Calculator,
```

In the Nav block, add this NavItem right after the Performance NavItem (currently around line 125). It is intentionally NOT gated by `accessible()` in P1 so the planning tool is visible to everyone:

```tsx
        <NavItem icon={Calculator} label="C-Ads Calculator" color="#FF0050" active={view === 'cads-calculator'} onClick={() => onViewChange('cads-calculator')} />
```

- [ ] **Step 4: Typecheck / lint the wiring**

Run: `npm run lint`
Expected: no new errors referencing `cads-calculator`, `CAdsCalculatorView`, or `Calculator`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/app/page.tsx src/components/Sidebar.tsx
git commit -m "feat(cads): wire C-Ads calculator into nav + view router"
```

---

### Task 5: Local verification (DO NOT PUSH)

**Files:** none

- [ ] **Step 1: Run the full unit test suite**

Run: `npm test`
Expected: all tests pass, including `src/lib/cads.test.ts`.

- [ ] **Step 2: Start the local dev server**

Run: `npm run dev`
Expected: Next.js starts on `http://localhost:3000`.

- [ ] **Step 3: Manual smoke check (browser)**

Open `http://localhost:3000`, log in, and verify:
1. The **C-Ads Calculator** item appears in the sidebar (TikTok-pink Calculator icon) under Performance.
2. Clicking it shows the calculator with default inputs.
3. Changing **Split ke Consi** and **Uplift ke GMV Max** updates all result cards live.
4. With defaults (50jt / 30% / uplift 18%), **Blended ROAS ≈ 4.13x** and the banner reads "belum worth it" (because GMV Max-only ROAS is 5x) — proving the tool surfaces the tradeoff.
5. Raising **Uplift** to ~45% flips the banner to "WORTH IT".

- [ ] **Step 4: STOP — hand back to the user**

Do NOT push or open a PR. Report results and let the user verify locally. Pushing to `dev`/PR happens only after the user approves (per project deploy workflow).

---

## Self-Review

**Spec coverage:** Inputs (budget, split, CPCo, rates, AOV, GMV Max ROAS, uplift) → Task 3 ✓. Outputs (cascade + cross-impact + blended ROAS) → Tasks 2–3 ✓. In-dashboard view + nav → Task 4 ✓. Manual P1, no DB → respected ✓. Local-test-before-push → Task 5 ✓. Anti-double-count model → Task 2 (blended ROAS uses GMV Max uplift only) ✓. Backward-target deferred to P2 → not in scope ✓.

**Placeholder scan:** none — all steps contain exact code/commands.

**Type consistency:** `CAdsInputs`/`CAdsResult` field names are identical across `cads.ts`, `cads.test.ts`, and `CAdsCalculatorView.tsx` (`considerationBuilt`, `buyersFromConsi`, `gmvMaxWithConsi`, `blendedRoas`, `roasDelta`). `ActiveView` value `'cads-calculator'` matches in `types.ts`, `page.tsx` (label + render), and `Sidebar.tsx`.

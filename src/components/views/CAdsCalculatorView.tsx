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

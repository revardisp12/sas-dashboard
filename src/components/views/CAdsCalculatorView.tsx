'use client'
import { useState, useMemo } from 'react'
import { Brand } from '@/lib/types'
import { calcPlan, type PlanInputs } from '@/lib/cads'
import { fmtCurrency, fmtNum } from '@/lib/utils'
import MetricCard from '@/components/MetricCard'
import { Calculator, Target, Wallet, Scale } from 'lucide-react'

const ACCENT: Record<Brand, string> = { reglow: '#C9A96E', amura: '#8FB050', purela: '#9B7FD4' }

const DEFAULTS = {
  coNow: 1_000_000,
  coBenchmark: 3_000_000,
  ambitionPct: 80,      // %
  cpco: 200,            // Rp
  coToSalesPct: 1,      // %
  aov: 150_000,         // Rp
  gmvMaxBudget: 35_000_000,
  gmvMaxRoas: 5,
  upliftPct: 18,        // %
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

  const inputs: PlanInputs = useMemo(() => ({
    coNow: f.coNow,
    coBenchmark: f.coBenchmark,
    ambition: f.ambitionPct / 100,
    cpco: f.cpco,
    coToSales: f.coToSalesPct / 100,
    aov: f.aov,
    gmvMaxBudget: f.gmvMaxBudget,
    gmvMaxRoas: f.gmvMaxRoas,
    consiUplift: f.upliftPct / 100,
  }), [f])

  const r = useMemo(() => calcPlan(inputs), [inputs])
  const worthIt = r.roasDelta >= 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${accent}1A`, color: accent }}>
          <Calculator size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#111827' }}>C-Ads Calculator</h2>
          <p className="text-xs" style={{ color: '#6B7280' }}>
            Plan budget Consideration dari target audience → cek worth-it-nya ke GMV Max. Default = benchmark; ganti pakai data real Market Scope/Ads Manager.
          </p>
        </div>
      </div>

      {/* Section 1 — Target */}
      <div className="rounded-2xl p-5" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
        <div className="flex items-center gap-2 mb-4">
          <Target size={16} style={{ color: accent }} />
          <p className="text-sm font-semibold" style={{ color: '#111827' }}>Bagian 1 — Target Audience</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <NumField label="Co audience sekarang" value={f.coNow} onChange={set('coNow')} step={100_000} />
          <NumField label="Benchmark kategori" value={f.coBenchmark} onChange={set('coBenchmark')} step={100_000} />
          <NumField label="Ambisi" value={f.ambitionPct} onChange={set('ambitionPct')} suffix="%" step={5} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <MetricCard label="Target Consideration" value={fmtNum(Math.round(r.targetCo))} accent={accent} sub="benchmark × ambisi" />
          <MetricCard label="Audience Gap" value={fmtNum(Math.round(r.audienceGap))} accent="#6366F1" sub="yang harus ditambah" />
        </div>
      </div>

      {/* Section 2 — Budget (lens langsung / AM) */}
      <div className="rounded-2xl p-5" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
        <div className="flex items-center gap-2 mb-4">
          <Wallet size={16} style={{ color: accent }} />
          <p className="text-sm font-semibold" style={{ color: '#111827' }}>Bagian 2 — Budget (Lens Langsung / AM)</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <NumField label="CPCo" value={f.cpco} onChange={set('cpco')} suffix="Rp" step={50} />
          <NumField label="Co → Sales rate" value={f.coToSalesPct} onChange={set('coToSalesPct')} suffix="%" step={0.1} />
          <NumField label="AOV" value={f.aov} onChange={set('aov')} suffix="Rp" step={10_000} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Budget Consideration" value={fmtCurrency(r.considerationBudget)} accent={accent} sub="gap × CPCo" />
          <MetricCard label="Pembeli tambahan" value={fmtNum(Math.round(r.incrementalBuyers))} accent="#10B981" sub="gap × Co→Sales rate" />
          <MetricCard label="Est. GMV (langsung)" value={fmtCurrency(r.incrementalGmv)} accent="#10B981" sub="lens 1 — lihat catatan" />
          <MetricCard label="ROAS Consideration" value={`${r.considerationRoas.toFixed(2)}x`} accent="#6366F1" sub="GMV langsung ÷ budget" />
        </div>
      </div>

      {/* Section 3 — Worth it? (cross-impact ke GMV Max) */}
      <div className="rounded-2xl p-5" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
        <div className="flex items-center gap-2 mb-4">
          <Scale size={16} style={{ color: accent }} />
          <p className="text-sm font-semibold" style={{ color: '#111827' }}>Bagian 3 — Worth it? (Cross-Impact ke GMV Max)</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <NumField label="Budget GMV Max" value={f.gmvMaxBudget} onChange={set('gmvMaxBudget')} suffix="Rp" step={1_000_000} />
          <NumField label="GMV Max ROAS" value={f.gmvMaxRoas} onChange={set('gmvMaxRoas')} suffix="x" step={0.1} />
          <NumField label="Uplift Consi → GMV Max" value={f.upliftPct} onChange={set('upliftPct')} suffix="%" step={1} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <MetricCard label="GMV Max baseline" value={fmtCurrency(r.gmvMaxBaseline)} accent="#9CA3AF" sub={`ROAS ${r.roasGmvMaxOnly.toFixed(2)}x`} />
          <MetricCard label="GMV Max + Consi" value={fmtCurrency(r.gmvMaxWithConsi)} accent={accent} sub={`+${f.upliftPct}% uplift`} />
          <MetricCard label="Total budget" value={fmtCurrency(r.totalBudget)} accent="#6B7280" sub="Consi + GMV Max" />
          <MetricCard label="Blended ROAS" value={`${r.blendedRoas.toFixed(2)}x`} accent={worthIt ? '#10B981' : '#EF4444'} sub={`${r.roasDelta >= 0 ? '+' : ''}${r.roasDelta.toFixed(2)}x vs GMV Max-only`} />
        </div>
        {/* Verdict banner */}
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: worthIt ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', color: worthIt ? '#047857' : '#B91C1C' }}>
          {worthIt
            ? `✅ WORTH IT: blended ROAS (${r.blendedRoas.toFixed(2)}x) ≥ GMV Max-only (${r.roasGmvMaxOnly.toFixed(2)}x). Uplift Consi nutupin cost-nya.`
            : `⚠️ Belum worth it: blended ROAS (${r.blendedRoas.toFixed(2)}x) < GMV Max-only (${r.roasGmvMaxOnly.toFixed(2)}x). Coba naikin uplift, turunin CPCo, atau kurangi budget Consi.`}
        </div>
      </div>

      {/* Footer note — anti double-count */}
      <p className="text-[11px]" style={{ color: '#9CA3AF' }}>
        2 lensa nilai Consideration — <em>Est. GMV langsung</em> (lens 1) &amp; <em>Blended ROAS</em> (lens 3) JANGAN dijumlah (bisa double-count). Metrik keputusan = Blended ROAS.
      </p>
    </div>
  )
}

'use client'
import { BrandData, Brand, Timeframe } from '@/lib/types'
import { filterByDays, fmtNum } from '@/lib/utils'

interface Props { data: BrandData; brand: Brand; timeframe: Timeframe }

interface Stage {
  label: string; sublabel: string; value: number
  color: string; bg: string; icon: string
}

export default function FunnelView({ data, timeframe }: Props) {
  const ga = filterByDays(data.googleAds, timeframe)
  const meta = filterByDays(data.metaAds, timeframe)
  const tts = filterByDays(data.tiktokShop, timeframe)
  const sales = filterByDays(data.sales, timeframe)

  const awareness = ga.reduce((s, r) => s + r.impressions, 0) + meta.reduce((s, r) => s + r.impressions, 0)
  const consideration = ga.reduce((s, r) => s + r.clicks, 0) + meta.reduce((s, r) => s + r.clicks, 0)
  const conversion = ga.reduce((s, r) => s + r.conversions, 0) + meta.reduce((s, r) => s + r.purchases, 0)
  const purchase = tts.reduce((s, r) => s + r.orders, 0) + sales.reduce((s, r) => s + r.qty, 0)

  const stages: Stage[] = [
    { label: 'Awareness', sublabel: 'Total Impressions (Paid)', value: awareness, color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', icon: '👁' },
    { label: 'Consideration', sublabel: 'Total Clicks (Paid)', value: consideration, color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', icon: '🤔' },
    { label: 'Conversion', sublabel: 'Conversions & Purchases', value: conversion, color: '#F07830', bg: 'rgba(240,120,48,0.12)', icon: '🛒' },
    { label: 'Purchase', sublabel: 'Orders (TikTok Shop + Sales)', value: purchase, color: '#10B981', bg: 'rgba(16,185,129,0.12)', icon: '💰' },
  ]

  const maxVal = Math.max(...stages.map(s => s.value), 1)
  const hasData = awareness > 0 || consideration > 0 || conversion > 0 || purchase > 0

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#4B5563' }}>Funnel Analysis</p>
        <p className="text-sm" style={{ color: '#374151' }}>Dari Awareness hingga Purchase — visualisasi drop-off per stage</p>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-4xl mb-4">📊</p>
          <p className="font-semibold mb-1" style={{ color: '#6B7280' }}>Belum ada data untuk funnel</p>
          <p className="text-sm" style={{ color: '#374151' }}>Upload data Google Ads / Meta Ads / TikTok Shop / Sales terlebih dahulu</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Visual Funnel */}
          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs font-semibold tracking-widest uppercase mb-6" style={{ color: '#6B7280' }}>Funnel Visual</p>
            <div className="flex flex-col items-center gap-0">
              {stages.map((stage, i) => {
                const widthPct = stage.value > 0 ? Math.max((stage.value / maxVal) * 100, 15) : 15
                const nextStage = stages[i + 1]
                const dropoff = nextStage && stage.value > 0
                  ? (((stage.value - nextStage.value) / stage.value) * 100)
                  : null
                return (
                  <div key={stage.label} className="w-full flex flex-col items-center">
                    {/* Trapezoid bar */}
                    <div className="relative flex items-center justify-center rounded-lg py-3 transition-all duration-500"
                      style={{
                        width: `${widthPct}%`,
                        minWidth: 120,
                        background: stage.bg,
                        border: `1px solid ${stage.color}30`,
                        boxShadow: stage.value > 0 ? `0 0 20px ${stage.color}20` : 'none',
                      }}>
                      <span className="text-xs font-bold" style={{ color: stage.color }}>
                        {stage.icon} {stage.value > 0 ? fmtNum(stage.value) : '–'}
                      </span>
                    </div>
                    {/* Drop-off arrow */}
                    {dropoff !== null && (
                      <div className="flex flex-col items-center py-1">
                        <div className="w-px h-3" style={{ background: 'rgba(255,255,255,0.1)' }} />
                        <span className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                          ↓ {dropoff.toFixed(1)}% drop
                        </span>
                        <div className="w-px h-3" style={{ background: 'rgba(255,255,255,0.1)' }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Stage Details */}
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#6B7280' }}>Stage Breakdown</p>
            {stages.map((stage, i) => {
              const pctOfAwareness = awareness > 0 ? (stage.value / awareness) * 100 : 0
              const prevStage = stages[i - 1]
              const convFromPrev = prevStage && prevStage.value > 0
                ? (stage.value / prevStage.value) * 100
                : null

              return (
                <div key={stage.label} className="rounded-xl p-4"
                  style={{ background: stage.bg, border: `1px solid ${stage.color}20` }}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{stage.icon}</span>
                        <span className="text-sm font-bold" style={{ color: stage.color }}>{stage.label}</span>
                      </div>
                      <p className="text-[10px] mt-0.5" style={{ color: '#6B7280' }}>{stage.sublabel}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold" style={{ color: '#F0F0F5' }}>
                        {stage.value > 0 ? fmtNum(stage.value) : '–'}
                      </p>
                      {pctOfAwareness > 0 && (
                        <p className="text-[10px]" style={{ color: '#6B7280' }}>
                          {pctOfAwareness.toFixed(2)}% dari awareness
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(pctOfAwareness, 100)}%`, background: stage.color, boxShadow: `0 0 8px ${stage.color}` }} />
                  </div>
                  {convFromPrev !== null && (
                    <p className="text-[10px] mt-2" style={{ color: convFromPrev >= 50 ? '#10B981' : convFromPrev >= 20 ? '#F59E0B' : '#F87171' }}>
                      {convFromPrev.toFixed(1)}% conversion rate dari stage sebelumnya
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

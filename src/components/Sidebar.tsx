'use client'
import Image from 'next/image'
import { Brand, Platform } from '@/lib/types'
import { BarChart2, Target, ShoppingBag, Camera, Music, ChevronRight } from 'lucide-react'

const PLATFORMS = [
  { id: 'google-ads' as Platform, label: 'Google Ads', icon: BarChart2, color: '#4285F4', section: 'paid' },
  { id: 'meta-ads' as Platform, label: 'Meta Ads', icon: Target, color: '#1877F2', section: 'paid' },
  { id: 'tiktok-shop' as Platform, label: 'TikTok Shop', icon: ShoppingBag, color: '#FF0050', section: 'paid' },
  { id: 'instagram' as Platform, label: 'Instagram', icon: Camera, color: '#E1306C', section: 'organic' },
  { id: 'tiktok-organic' as Platform, label: 'TikTok', icon: Music, color: '#69C9D0', section: 'organic' },
]

const BRAND_CONFIG = {
  reglow: { label: 'Reglow', sub: 'Skincare', color: '#C9A96E', glow: 'rgba(201,169,110,0.3)' },
  amura: { label: 'amura', sub: '', color: '#8FB050', glow: 'rgba(143,176,80,0.3)' },
}

interface Props {
  brand: Brand
  platform: Platform
  onBrandChange: (b: Brand) => void
  onPlatformChange: (p: Platform) => void
}

export default function Sidebar({ brand, platform, onBrandChange, onPlatformChange }: Props) {
  const paid = PLATFORMS.filter(p => p.section === 'paid')
  const organic = PLATFORMS.filter(p => p.section === 'organic')

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col z-50"
      style={{ width: 240, background: '#0A0A18', borderRight: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center"
            style={{ background: 'rgba(240,120,48,0.1)', border: '1px solid rgba(240,120,48,0.2)' }}>
            <Image src="/logo-sas.png" alt="SAS" fill style={{ objectFit: 'contain' }} className="p-1"
              onError={(e) => {
                const t = e.target as HTMLImageElement
                t.style.display = 'none'
                t.parentElement!.innerHTML = '<span style="color:#F07830;font-weight:900;font-size:14px">SAS</span>'
              }} />
          </div>
          <div>
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#F07830' }}>SAS</p>
            <p className="text-[10px]" style={{ color: '#4B5563' }}>Marketing Analytics</p>
          </div>
        </div>
      </div>

      {/* Brand Switcher */}
      <div className="px-4 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <p className="text-[9px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#4B5563' }}>Brand</p>
        <div className="flex flex-col gap-2">
          {(['reglow', 'amura'] as Brand[]).map((b) => {
            const cfg = BRAND_CONFIG[b]
            const active = brand === b
            return (
              <button
                key={b}
                onClick={() => onBrandChange(b)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                style={{
                  background: active ? `rgba(${b === 'reglow' ? '201,169,110' : '143,176,80'},0.12)` : 'transparent',
                  border: `1px solid ${active ? cfg.color + '40' : 'transparent'}`,
                  boxShadow: active ? `0 0 16px ${cfg.glow}` : 'none',
                }}
              >
                <div className="w-2 h-2 rounded-full" style={{ background: active ? cfg.color : '#374151', boxShadow: active ? `0 0 8px ${cfg.color}` : 'none' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: active ? cfg.color : '#6B7280' }}>{cfg.label}</p>
                  {cfg.sub && <p className="text-[10px]" style={{ color: '#4B5563' }}>{cfg.sub}</p>}
                </div>
                {active && <ChevronRight size={12} className="ml-auto" style={{ color: cfg.color }} />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Platform Nav */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <NavSection label="Paid Traffic" platforms={paid} active={platform} onChange={onPlatformChange} />
        <NavSection label="Organic" platforms={organic} active={platform} onChange={onPlatformChange} />
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <p className="text-[10px]" style={{ color: '#374151' }}>PT Sinergi Ayu Semesta © 2026</p>
      </div>
    </aside>
  )
}

function NavSection({ label, platforms, active, onChange }: {
  label: string
  platforms: typeof PLATFORMS
  active: Platform
  onChange: (p: Platform) => void
}) {
  return (
    <div className="mb-5">
      <p className="text-[9px] font-semibold tracking-widest uppercase mb-2" style={{ color: '#4B5563' }}>{label}</p>
      <div className="flex flex-col gap-1">
        {platforms.map((p) => {
          const Icon = p.icon
          const isActive = active === p.id
          return (
            <button
              key={p.id}
              onClick={() => onChange(p.id)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group"
              style={{
                background: isActive ? `${p.color}18` : 'transparent',
                borderLeft: isActive ? `2px solid ${p.color}` : '2px solid transparent',
              }}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  background: isActive ? `${p.color}25` : 'rgba(255,255,255,0.04)',
                  boxShadow: isActive ? `0 0 10px ${p.color}40` : 'none',
                }}>
                <Icon size={14} style={{ color: isActive ? p.color : '#6B7280' }} />
              </div>
              <span className="text-sm font-medium transition-colors"
                style={{ color: isActive ? '#F0F0F5' : '#6B7280' }}>
                {p.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

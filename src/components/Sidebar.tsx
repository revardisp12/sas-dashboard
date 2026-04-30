'use client'
import Image from 'next/image'
import { useState } from 'react'
import { Brand, ActiveView } from '@/lib/types'
import {
  BarChart2, Target, ShoppingBag, Camera, Music,
  ChevronDown, ChevronRight, LayoutDashboard, TrendingUp,
  ShoppingCart, Trash2, DollarSign,
} from 'lucide-react'

const BRAND_CONFIG = {
  reglow: { label: 'Reglow', sub: 'Skincare', color: '#C9A96E', glow: 'rgba(201,169,110,0.3)' },
  amura: { label: 'amura', sub: '', color: '#8FB050', glow: 'rgba(143,176,80,0.3)' },
}

const PAID_PLATFORMS = [
  { id: 'google-ads' as ActiveView, label: 'Google Ads', icon: BarChart2, color: '#4285F4' },
  { id: 'meta-ads' as ActiveView, label: 'Meta Ads', icon: Target, color: '#1877F2' },
  { id: 'tiktok-shop' as ActiveView, label: 'TikTok Shop', icon: ShoppingBag, color: '#FF0050' },
]
const ORGANIC_PLATFORMS = [
  { id: 'instagram' as ActiveView, label: 'Instagram', icon: Camera, color: '#E1306C' },
  { id: 'tiktok-organic' as ActiveView, label: 'TikTok', icon: Music, color: '#69C9D0' },
]

interface Props {
  brand: Brand
  view: ActiveView
  onBrandChange: (b: Brand) => void
  onViewChange: (v: ActiveView) => void
  onReset: () => void
}

export default function Sidebar({ brand, view, onBrandChange, onViewChange, onReset }: Props) {
  const [paidOpen, setPaidOpen] = useState(true)
  const [organicOpen, setOrganicOpen] = useState(true)
  const [salesOpen, setSalesOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  function handleReset() {
    if (!confirmReset) { setConfirmReset(true); setTimeout(() => setConfirmReset(false), 3000); return }
    onReset(); setConfirmReset(false)
  }

  return (
    <aside className="fixed left-0 top-0 h-screen flex flex-col z-50 overflow-y-auto"
      style={{ width: 240, background: '#0A0A18', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

      {/* Logo */}
      <div className="px-5 py-5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(240,120,48,0.1)', border: '1px solid rgba(240,120,48,0.2)' }}>
            <Image src="/logo-sas.png" alt="SAS" fill style={{ objectFit: 'contain' }} className="p-1"
              onError={(e) => { const t = e.target as HTMLImageElement; t.style.display = 'none' }} />
          </div>
          <div>
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#F07830' }}>SAS</p>
            <p className="text-[10px]" style={{ color: '#374151' }}>Marketing Analytics</p>
          </div>
        </div>
      </div>

      {/* Brand switcher */}
      <div className="px-4 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[9px] font-semibold tracking-widest uppercase mb-2" style={{ color: '#374151' }}>Brand</p>
        <div className="flex gap-2">
          {(['reglow', 'amura'] as Brand[]).map(b => {
            const cfg = BRAND_CONFIG[b]
            const active = brand === b
            return (
              <button key={b} onClick={() => onBrandChange(b)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: active ? `rgba(${b === 'reglow' ? '201,169,110' : '143,176,80'},0.15)` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${active ? cfg.color + '50' : 'rgba(255,255,255,0.06)'}`,
                  color: active ? cfg.color : '#4B5563',
                  boxShadow: active ? `0 0 12px ${cfg.glow}` : 'none',
                }}>
                {cfg.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 px-3 py-4 space-y-1">

        {/* Top pages */}
        <NavItem icon={LayoutDashboard} label="Overview" color="#F07830" active={view === 'overview'} onClick={() => onViewChange('overview')} />
        <NavItem icon={TrendingUp} label="Funnel Analysis" color="#8B5CF6" active={view === 'funnel'} onClick={() => onViewChange('funnel')} />

        <div className="py-1" />

        {/* Paid Traffic */}
        <DropSection label="Paid Traffic" open={paidOpen} onToggle={() => setPaidOpen(p => !p)}>
          {PAID_PLATFORMS.map(p => (
            <NavItem key={p.id} icon={p.icon} label={p.label} color={p.color} active={view === p.id} onClick={() => onViewChange(p.id)} indent />
          ))}
        </DropSection>

        {/* Organic */}
        <DropSection label="Organic" open={organicOpen} onToggle={() => setOrganicOpen(p => !p)}>
          {ORGANIC_PLATFORMS.map(p => (
            <NavItem key={p.id} icon={p.icon} label={p.label} color={p.color} active={view === p.id} onClick={() => onViewChange(p.id)} indent />
          ))}
        </DropSection>

        {/* Sales Data */}
        <DropSection label="Sales Data" open={salesOpen} onToggle={() => setSalesOpen(p => !p)} color="#10B981">
          {(['reglow', 'amura'] as Brand[]).map(b => (
            <button key={b}
              onClick={() => { onBrandChange(b); onViewChange('sales') }}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg transition-all text-left ml-2"
              style={{
                background: view === 'sales' && brand === b ? 'rgba(16,185,129,0.1)' : 'transparent',
                borderLeft: view === 'sales' && brand === b ? '2px solid #10B981' : '2px solid transparent',
              }}>
              <DollarSign size={12} style={{ color: view === 'sales' && brand === b ? '#10B981' : '#4B5563' }} />
              <span className="text-xs" style={{ color: view === 'sales' && brand === b ? '#F0F0F5' : '#6B7280' }}>
                {BRAND_CONFIG[b].label} Sales
              </span>
            </button>
          ))}
        </DropSection>
      </div>

      {/* Reset */}
      <div className="px-3 pb-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
        <button onClick={handleReset}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: confirmReset ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${confirmReset ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.06)'}`,
            color: confirmReset ? '#F87171' : '#4B5563',
          }}>
          <Trash2 size={13} />
          {confirmReset ? 'Yakin? Klik lagi' : 'Reset All Data'}
        </button>
      </div>
    </aside>
  )
}

function DropSection({ label, open, onToggle, children, color = '#6B7280' }: {
  label: string; open: boolean; onToggle: () => void; children: React.ReactNode; color?: string
}) {
  return (
    <div>
      <button onClick={onToggle}
        className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg transition-all"
        style={{ color: '#4B5563' }}
        onMouseEnter={e => e.currentTarget.style.color = '#9CA3AF'}
        onMouseLeave={e => e.currentTarget.style.color = '#4B5563'}>
        <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color }}>{label}</span>
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>
      {open && <div className="mt-1 space-y-0.5">{children}</div>}
    </div>
  )
}

function NavItem({ icon: Icon, label, color, active, onClick, indent = false }: {
  icon: React.ElementType; label: string; color: string; active: boolean; onClick: () => void; indent?: boolean
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-3 w-full rounded-xl transition-all text-left ${indent ? 'px-3 py-2 ml-2' : 'px-3 py-2.5'}`}
      style={{
        background: active ? `${color}18` : 'transparent',
        borderLeft: active ? `2px solid ${color}` : '2px solid transparent',
      }}>
      <div className={`${indent ? 'w-6 h-6' : 'w-7 h-7'} rounded-lg flex items-center justify-center flex-shrink-0 transition-all`}
        style={{
          background: active ? `${color}25` : 'rgba(255,255,255,0.04)',
          boxShadow: active ? `0 0 10px ${color}40` : 'none',
        }}>
        <Icon size={indent ? 12 : 14} style={{ color: active ? color : '#6B7280' }} />
      </div>
      <span className={`${indent ? 'text-xs' : 'text-sm'} font-medium`} style={{ color: active ? '#F0F0F5' : '#6B7280' }}>
        {label}
      </span>
    </button>
  )
}

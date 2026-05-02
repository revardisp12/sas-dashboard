'use client'
import Image from 'next/image'
import { useState } from 'react'
import { Brand, ActiveView } from '@/lib/types'
import {
  BarChart2, Target, ShoppingBag, Camera, Music,
  ChevronDown, ChevronRight, LayoutDashboard, TrendingUp,
  ShoppingCart, LogOut, Users, Package, Settings,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const BRAND_CONFIG = {
  reglow: { label: 'Reglow Skincare', color: '#C9A96E', glow: 'rgba(201,169,110,0.3)', rgb: '201,169,110' },
  amura: { label: 'Amura', color: '#8FB050', glow: 'rgba(143,176,80,0.3)', rgb: '143,176,80' },
}

const PAID_PLATFORMS = [
  { id: 'google-ads' as ActiveView, label: 'Google Ads', icon: BarChart2, color: '#4285F4' },
  { id: 'meta-ads' as ActiveView, label: 'Meta Ads', icon: Target, color: '#1877F2' },
  { id: 'tiktok-shop' as ActiveView, label: 'TikTok Shop', icon: ShoppingBag, color: '#FF0050' },
  { id: 'shopee' as ActiveView, label: 'Shopee', icon: ShoppingBag, color: '#F05536' },
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
  accessibleBrands?: Brand[]
  canAccess?: (v: ActiveView) => boolean
  userName?: string
  userRole?: string
}

export default function Sidebar({ brand, view, onBrandChange, onViewChange, accessibleBrands, canAccess, userName, userRole }: Props) {
  const { signOut } = useAuth()
  const [paidOpen, setPaidOpen] = useState(true)
  const [organicOpen, setOrganicOpen] = useState(true)
  const [salesOpen, setSalesOpen] = useState(true)
  const [brandDropOpen, setBrandDropOpen] = useState(false)

  const cfg = BRAND_CONFIG[brand]
  const brands = accessibleBrands ?? ['reglow', 'amura']
  const accessible = canAccess ?? (() => true)

  return (
    <aside className="fixed left-0 top-0 h-screen flex flex-col z-50 overflow-y-auto"
      style={{ width: 240, background: '#FFFFFF', borderRight: '1px solid #E5E7EB' }}>

      {/* Logo */}
      <div className="px-5 py-5 flex-shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
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

      {/* Brand dropdown */}
      <div className="px-4 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
        <p className="text-[9px] font-semibold tracking-widest uppercase mb-2" style={{ color: '#374151' }}>Brand</p>
        <div className="relative">
          <button
            onClick={() => brands.length > 1 && setBrandDropOpen(p => !p)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all"
            style={{
              background: `rgba(${cfg.rgb},0.1)`,
              border: `1px solid rgba(${cfg.rgb},0.3)`,
              boxShadow: `0 0 12px rgba(${cfg.rgb},0.15)`,
              cursor: brands.length > 1 ? 'pointer' : 'default',
            }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }} />
              <span className="text-sm font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
            </div>
            {brands.length > 1 && (
              <ChevronDown size={14} style={{ color: cfg.color, transform: brandDropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            )}
          </button>

          {brandDropOpen && brands.length > 1 && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-50"
              style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
              {brands.map(b => {
                const c = BRAND_CONFIG[b]
                const active = brand === b
                return (
                  <button key={b}
                    onClick={() => { onBrandChange(b); setBrandDropOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-3 text-left transition-all"
                    style={{ background: active ? `rgba(${c.rgb},0.1)` : 'transparent' }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F9FAFB' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                    <span className="text-sm font-medium" style={{ color: active ? c.color : '#9CA3AF' }}>{c.label}</span>
                    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 px-3 py-4 space-y-1">

        {accessible('overview') && <NavItem icon={LayoutDashboard} label="Overview" color="#F07830" active={view === 'overview'} onClick={() => onViewChange('overview')} />}
        {accessible('funnel') && <NavItem icon={TrendingUp} label="Funnel Analysis" color="#8B5CF6" active={view === 'funnel'} onClick={() => onViewChange('funnel')} />}
        {accessible('product-analysis') && <NavItem icon={Package} label="Product Analysis" color="#00D4FF" active={view === 'product-analysis'} onClick={() => onViewChange('product-analysis')} />}

        {(accessible('google-ads') || accessible('meta-ads') || accessible('tiktok-shop') || accessible('shopee')) && (
          <>
            <div className="py-1" />
            <DropSection label="Paid Traffic" open={paidOpen} onToggle={() => setPaidOpen(p => !p)}>
              {PAID_PLATFORMS.filter(p => accessible(p.id)).map(p => (
                <NavItem key={p.id} icon={p.icon} label={p.label} color={p.color} active={view === p.id} onClick={() => onViewChange(p.id)} indent />
              ))}
            </DropSection>
          </>
        )}

        {(accessible('instagram') || accessible('tiktok-organic')) && (
          <DropSection label="Organic" open={organicOpen} onToggle={() => setOrganicOpen(p => !p)}>
            {ORGANIC_PLATFORMS.filter(p => accessible(p.id)).map(p => (
              <NavItem key={p.id} icon={p.icon} label={p.label} color={p.color} active={view === p.id} onClick={() => onViewChange(p.id)} indent />
            ))}
          </DropSection>
        )}

        {(accessible('sales') || accessible('crm')) && (
          <DropSection label="Sales Data" open={salesOpen} onToggle={() => setSalesOpen(p => !p)} color="#10B981">
            {accessible('sales') && <NavItem icon={ShoppingCart} label="Acquisition by CS" color="#10B981" active={view === 'sales'} onClick={() => onViewChange('sales')} indent />}
            {accessible('crm') && <NavItem icon={Users} label="Retention by CRM" color="#8B5CF6" active={view === 'crm'} onClick={() => onViewChange('crm')} indent />}
          </DropSection>
        )}
      </div>

      {/* User info + Settings + Sign out */}
      <div className="px-3 pb-4 flex-shrink-0 space-y-1.5" style={{ borderTop: '1px solid #F3F4F6', paddingTop: 12 }}>
        {accessible('settings') && (
          <NavItem icon={Settings} label="Settings" color="#6B7280" active={view === 'settings'} onClick={() => onViewChange('settings')} />
        )}

        {/* User info */}
        {userName && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
              style={{ background: `${cfg.color}20`, color: cfg.color }}>
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: '#111827' }}>{userName}</p>
              <p className="text-[10px] capitalize" style={{ color: '#9CA3AF' }}>{userRole?.replace('_', ' ')}</p>
            </div>
          </div>
        )}

        <button onClick={() => signOut()}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
          style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#4B5563' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.color = '#EF4444' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.color = '#4B5563' }}>
          <LogOut size={13} />
          Sign Out
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
          background: active ? `${color}25` : '#F3F4F6',
          boxShadow: active ? `0 0 10px ${color}40` : 'none',
        }}>
        <Icon size={indent ? 12 : 14} style={{ color: active ? color : '#6B7280' }} />
      </div>
      <span className={`${indent ? 'text-xs' : 'text-sm'} font-medium`} style={{ color: active ? '#111827' : '#6B7280' }}>
        {label}
      </span>
    </button>
  )
}

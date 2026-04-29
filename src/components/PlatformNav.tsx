'use client'
import { Platform, Brand } from '@/lib/types'
import { BarChart2, Target, ShoppingBag, Camera, Music } from 'lucide-react'

const PLATFORMS: { id: Platform; label: string; icon: React.ReactNode; type: 'paid' | 'organic' }[] = [
  { id: 'google-ads', label: 'Google Ads', icon: <BarChart2 size={16} />, type: 'paid' },
  { id: 'meta-ads', label: 'Meta Ads', icon: <Target size={16} />, type: 'paid' },
  { id: 'tiktok-shop', label: 'TikTok Shop', icon: <ShoppingBag size={16} />, type: 'paid' },
  { id: 'instagram', label: 'Instagram', icon: <Camera size={16} />, type: 'organic' },
  { id: 'tiktok-organic', label: 'TikTok', icon: <Music size={16} />, type: 'organic' },
]

const BRAND_ACCENT: Record<Brand, string> = {
  reglow: 'border-gray-900 text-gray-900',
  amura: 'border-[#6B7C3D] text-[#6B7C3D]',
}

interface Props {
  active: Platform
  brand: Brand
  onChange: (p: Platform) => void
}

export default function PlatformNav({ active, brand, onChange }: Props) {
  const accent = BRAND_ACCENT[brand]
  return (
    <div className="bg-white border-b border-gray-200 px-6">
      <div className="flex gap-1 -mb-px">
        {['paid', 'organic'].map((type) => (
          <div key={type} className="flex items-center">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest mr-2 ml-2 first:ml-0">
              {type}
            </span>
            {PLATFORMS.filter((p) => p.type === type).map((p) => (
              <button
                key={p.id}
                onClick={() => onChange(p.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  active === p.id
                    ? accent + ' bg-gray-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {p.icon}
                {p.label}
              </button>
            ))}
            {type === 'paid' && <div className="w-px h-6 bg-gray-200 mx-3 self-center" />}
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'
import { Brand } from '@/lib/types'

const BRANDS: { id: Brand; label: string; color: string; bg: string; activeBg: string }[] = [
  {
    id: 'reglow',
    label: 'Reglow Skincare',
    color: 'text-gray-900',
    bg: 'bg-gray-100 hover:bg-gray-200',
    activeBg: 'bg-gray-900 text-white',
  },
  {
    id: 'amura',
    label: 'Amura',
    color: 'text-[#5a6b2e]',
    bg: 'bg-[#f0f4e8] hover:bg-[#e2ebd0]',
    activeBg: 'bg-[#6B7C3D] text-white',
  },
  {
    id: 'purela',
    label: 'Purela',
    color: 'text-[#6B4FA8]',
    bg: 'bg-[#F3EFFE] hover:bg-[#E8DCFD]',
    activeBg: 'bg-[#9B7FD4] text-white',
  },
]

interface Props {
  active: Brand
  onChange: (b: Brand) => void
}

export default function BrandTabs({ active, onChange }: Props) {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 mr-3 font-medium uppercase tracking-wider">Brand</span>
        {BRANDS.map((b) => (
          <button
            key={b.id}
            onClick={() => onChange(b.id)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
              active === b.id ? b.activeBg : `${b.bg} ${b.color}`
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  )
}

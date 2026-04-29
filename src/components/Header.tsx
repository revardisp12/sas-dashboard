'use client'
import Image from 'next/image'

export default function Header() {
  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-32">
          <Image
            src="/logo-sas.png"
            alt="PT Sinergi Ayu Semesta"
            fill
            style={{ objectFit: 'contain', objectPosition: 'left' }}
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
            }}
          />
        </div>
        <div className="h-6 w-px bg-gray-300" />
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">Marketing Analytics</p>
          <p className="text-sm font-semibold text-gray-800">Dashboard</p>
        </div>
      </div>
      <p className="text-sm text-gray-500 hidden sm:block">{today}</p>
    </header>
  )
}

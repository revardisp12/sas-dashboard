'use client'
import { useState, useEffect } from 'react'
import { Brand, Platform, BrandData, emptyBrandData } from '@/lib/types'
import { loadData, saveData } from '@/lib/storage'
import { parseFile } from '@/lib/csvParser'
import Sidebar from '@/components/Sidebar'
import GoogleAdsView from '@/components/platforms/GoogleAdsView'
import MetaAdsView from '@/components/platforms/MetaAdsView'
import TikTokShopView from '@/components/platforms/TikTokShopView'
import InstagramView from '@/components/platforms/InstagramView'
import TikTokOrganicView from '@/components/platforms/TikTokOrganicView'

const PLATFORM_LABELS: Record<Platform, string> = {
  'google-ads': 'Google Ads',
  'meta-ads': 'Meta Ads',
  'tiktok-shop': 'TikTok Shop',
  instagram: 'Instagram',
  'tiktok-organic': 'TikTok Organic',
}

const BRAND_LABELS: Record<Brand, string> = {
  reglow: 'Reglow Skincare',
  amura: 'Amura',
}

export default function Dashboard() {
  const [brand, setBrand] = useState<Brand>('reglow')
  const [platform, setPlatform] = useState<Platform>('google-ads')
  const [data, setData] = useState<Record<Brand, BrandData>>({
    reglow: emptyBrandData(),
    amura: emptyBrandData(),
  })

  useEffect(() => { setData(loadData()) }, [])

  async function handleUpload(file: File) {
    const parsed = await parseFile(platform, file)
    setData((prev) => {
      const key =
        platform === 'google-ads' ? 'googleAds'
        : platform === 'meta-ads' ? 'metaAds'
        : platform === 'tiktok-shop' ? 'tiktokShop'
        : platform === 'instagram' ? 'instagram'
        : 'tiktokOrganic'
      const next = { ...prev, [brand]: { ...prev[brand], [key]: parsed } }
      saveData(next)
      return next
    })
  }

  const bd = data[brand]
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#08080F' }}>
      <Sidebar
        brand={brand}
        platform={platform}
        onBrandChange={(b) => { setBrand(b); setPlatform('google-ads') }}
        onPlatformChange={setPlatform}
      />

      <div className="flex-1 flex flex-col overflow-hidden" style={{ marginLeft: 240 }}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,10,24,0.8)', backdropFilter: 'blur(12px)' }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#4B5563' }}>
                {BRAND_LABELS[brand]}
              </span>
              <span style={{ color: '#1F2937' }}>/</span>
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#6B7280' }}>
                {PLATFORM_LABELS[platform]}
              </span>
            </div>
            <h1 className="text-xl font-bold mt-0.5" style={{ color: '#F0F0F5' }}>
              {PLATFORM_LABELS[platform]}
              <span className="text-sm font-normal ml-2" style={{ color: '#4B5563' }}>Analytics</span>
            </h1>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: '#4B5563' }}>{today}</p>
            <div className="flex items-center gap-1.5 mt-1 justify-end">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #10B981' }} />
              <span className="text-[10px] font-medium" style={{ color: '#10B981' }}>Live</span>
            </div>
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-8 py-6">
          {platform === 'google-ads' && <GoogleAdsView data={bd.googleAds} brand={brand} onUpload={handleUpload} />}
          {platform === 'meta-ads' && <MetaAdsView data={bd.metaAds} brand={brand} onUpload={handleUpload} />}
          {platform === 'tiktok-shop' && <TikTokShopView data={bd.tiktokShop} brand={brand} onUpload={handleUpload} />}
          {platform === 'instagram' && <InstagramView data={bd.instagram} brand={brand} onUpload={handleUpload} />}
          {platform === 'tiktok-organic' && <TikTokOrganicView data={bd.tiktokOrganic} brand={brand} onUpload={handleUpload} />}
        </main>
      </div>
    </div>
  )
}

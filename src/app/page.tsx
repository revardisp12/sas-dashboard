'use client'
import { useState, useEffect } from 'react'
import { Brand, Platform, BrandData, emptyBrandData } from '@/lib/types'
import { loadData, saveData } from '@/lib/storage'
import { parseFile } from '@/lib/csvParser'
import Header from '@/components/Header'
import BrandTabs from '@/components/BrandTabs'
import PlatformNav from '@/components/PlatformNav'
import GoogleAdsView from '@/components/platforms/GoogleAdsView'
import MetaAdsView from '@/components/platforms/MetaAdsView'
import TikTokShopView from '@/components/platforms/TikTokShopView'
import InstagramView from '@/components/platforms/InstagramView'
import TikTokOrganicView from '@/components/platforms/TikTokOrganicView'

export default function Dashboard() {
  const [brand, setBrand] = useState<Brand>('reglow')
  const [platform, setPlatform] = useState<Platform>('google-ads')
  const [data, setData] = useState<Record<Brand, BrandData>>({
    reglow: emptyBrandData(),
    amura: emptyBrandData(),
  })

  useEffect(() => {
    setData(loadData())
  }, [])

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <BrandTabs active={brand} onChange={(b) => { setBrand(b); setPlatform('google-ads') }} />
      <PlatformNav active={platform} brand={brand} onChange={setPlatform} />
      <main className="p-6 max-w-screen-xl mx-auto">
        {platform === 'google-ads' && <GoogleAdsView data={bd.googleAds} brand={brand} onUpload={handleUpload} />}
        {platform === 'meta-ads' && <MetaAdsView data={bd.metaAds} brand={brand} onUpload={handleUpload} />}
        {platform === 'tiktok-shop' && <TikTokShopView data={bd.tiktokShop} brand={brand} onUpload={handleUpload} />}
        {platform === 'instagram' && <InstagramView data={bd.instagram} brand={brand} onUpload={handleUpload} />}
        {platform === 'tiktok-organic' && <TikTokOrganicView data={bd.tiktokOrganic} brand={brand} onUpload={handleUpload} />}
      </main>
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { Brand, ActiveView, Timeframe, BrandData, emptyBrandData, ProductMaster } from '@/lib/types'
import { loadData, saveData, resetData, loadProducts, saveProducts } from '@/lib/storage'
import { parseFile } from '@/lib/csvParser'
import { filterByDays } from '@/lib/utils'
import Sidebar from '@/components/Sidebar'
import TimeframeSelector from '@/components/TimeframeSelector'
import OverviewView from '@/components/views/OverviewView'
import FunnelView from '@/components/views/FunnelView'
import SalesView from '@/components/views/SalesView'
import GoogleAdsView from '@/components/platforms/GoogleAdsView'
import MetaAdsView from '@/components/platforms/MetaAdsView'
import TikTokShopView from '@/components/platforms/TikTokShopView'
import ShopeeView from '@/components/platforms/ShopeeView'
import InstagramView from '@/components/platforms/InstagramView'
import TikTokOrganicView from '@/components/platforms/TikTokOrganicView'
import CRMView from '@/components/views/CRMView'
import ProductAnalysisView from '@/components/views/ProductAnalysisView'
import SettingsView from '@/components/views/SettingsView'

const VIEW_LABELS: Record<ActiveView, string> = {
  overview: 'Overview', funnel: 'Funnel Analysis', sales: 'Sales Acquisition by CS',
  crm: 'Sales Retention by CRM', 'product-analysis': 'Product Analysis',
  'google-ads': 'Google Ads', 'meta-ads': 'Meta Ads', 'tiktok-shop': 'TikTok Shop',
  shopee: 'Shopee', instagram: 'Instagram', 'tiktok-organic': 'TikTok Organic',
  settings: 'Settings',
}
const BRAND_LABELS: Record<Brand, string> = { reglow: 'Reglow Skincare', amura: 'Amura' }

export default function Dashboard() {
  const [brand, setBrand] = useState<Brand>('reglow')
  const [view, setView] = useState<ActiveView>('overview')
  const [timeframe, setTimeframe] = useState<Timeframe>(30)
  const [data, setData] = useState<Record<Brand, BrandData>>({ reglow: emptyBrandData(), amura: emptyBrandData() })
  const [products, setProducts] = useState<ProductMaster[]>([])

  useEffect(() => {
    setData(loadData())
    setProducts(loadProducts())
  }, [])

  async function handleUpload(file: File) {
    const uploadView = view === 'sales' ? 'sales' : view
    const parsed = await parseFile(uploadView as ActiveView, file)
    setData(prev => {
      const key =
        uploadView === 'google-ads' ? 'googleAds'
        : uploadView === 'meta-ads' ? 'metaAds'
        : uploadView === 'tiktok-shop' ? 'tiktokShop'
        : uploadView === 'shopee' ? 'shopee'
        : uploadView === 'instagram' ? 'instagram'
        : uploadView === 'tiktok-organic' ? 'tiktokOrganic'
        : uploadView === 'crm' ? 'crm'
        : 'sales'
      const next = { ...prev, [brand]: { ...prev[brand], [key]: parsed } }
      saveData(next)
      return next
    })
  }

  function handleProductsChange(updated: ProductMaster[]) {
    setProducts(updated)
    saveProducts(updated)
  }

  function handleManualSales(rows: import('@/lib/types').SalesRow[]) {
    setData(prev => {
      const next = { ...prev, [brand]: { ...prev[brand], sales: [...prev[brand].sales, ...rows] } }
      saveData(next)
      return next
    })
  }

  function handleManualCRM(rows: import('@/lib/types').CRMRow[]) {
    setData(prev => {
      const next = { ...prev, [brand]: { ...prev[brand], crm: [...prev[brand].crm, ...rows] } }
      saveData(next)
      return next
    })
  }

  function handleReset() {
    setData(resetData())
  }

  const bd = data[brand]
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // Pre-filter data for platform views
  const filtered = {
    googleAds: filterByDays(bd.googleAds, timeframe),
    metaAds: filterByDays(bd.metaAds, timeframe),
    tiktokShop: filterByDays(bd.tiktokShop, timeframe),
    shopee: filterByDays(bd.shopee ?? [], timeframe),
    instagram: filterByDays(bd.instagram, timeframe),
    tiktokOrganic: filterByDays(bd.tiktokOrganic, timeframe),
    sales: filterByDays(bd.sales, timeframe),
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#08080F' }}>
      <Sidebar brand={brand} view={view}
        onBrandChange={b => { setBrand(b); setView('overview') }}
        onViewChange={setView}
        onReset={handleReset}
      />

      <div className="flex-1 flex flex-col overflow-hidden" style={{ marginLeft: 240 }}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,10,24,0.9)', backdropFilter: 'blur(12px)' }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#374151' }}>{BRAND_LABELS[brand]}</span>
              <span style={{ color: '#1F2937' }}>/</span>
              <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#4B5563' }}>{VIEW_LABELS[view]}</span>
            </div>
            <h1 className="text-lg font-bold" style={{ color: '#F0F0F5' }}>
              {VIEW_LABELS[view]}
              <span className="text-sm font-normal ml-2" style={{ color: '#374151' }}>Analytics</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <TimeframeSelector value={timeframe} onChange={setTimeframe} />
            <div className="text-right hidden lg:block">
              <p className="text-[10px]" style={{ color: '#374151' }}>{today}</p>
              <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #10B981' }} />
                <span className="text-[10px] font-medium" style={{ color: '#10B981' }}>Live</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-8 py-6">
          {view === 'overview' && <OverviewView data={bd} brand={brand} timeframe={timeframe} products={products} />}
          {view === 'funnel' && <FunnelView data={bd} brand={brand} timeframe={timeframe} />}
          {view === 'sales' && <SalesView data={bd.sales} brand={brand} timeframe={timeframe} onUpload={handleUpload} products={products} onManualAdd={handleManualSales} />}
          {view === 'google-ads' && <GoogleAdsView data={filtered.googleAds} brand={brand} onUpload={handleUpload} />}
          {view === 'meta-ads' && <MetaAdsView data={filtered.metaAds} brand={brand} onUpload={handleUpload} />}
          {view === 'tiktok-shop' && <TikTokShopView data={filtered.tiktokShop} brand={brand} onUpload={handleUpload} />}
          {view === 'shopee' && <ShopeeView data={filtered.shopee} brand={brand} onUpload={handleUpload} />}
          {view === 'instagram' && <InstagramView data={filtered.instagram} brand={brand} onUpload={handleUpload} />}
          {view === 'tiktok-organic' && <TikTokOrganicView data={filtered.tiktokOrganic} brand={brand} onUpload={handleUpload} />}
          {view === 'crm' && <CRMView data={bd.crm} brand={brand} onUpload={handleUpload} products={products} onManualAdd={handleManualCRM} />}
          {view === 'product-analysis' && <ProductAnalysisView salesData={bd.sales} crmData={bd.crm} brand={brand} timeframe={timeframe} />}
          {view === 'settings' && <SettingsView brand={brand} products={products} onProductsChange={handleProductsChange} />}
        </main>
      </div>
    </div>
  )
}

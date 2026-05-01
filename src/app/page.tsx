'use client'
import { useState, useEffect } from 'react'
import { Brand, ActiveView, Timeframe, DateRange, BrandData, emptyBrandData, ProductMaster } from '@/lib/types'
import { loadData, saveData, resetData, loadProducts, saveProducts } from '@/lib/storage'
import { parseFile } from '@/lib/csvParser'
import { filterByDays, filterByRange } from '@/lib/utils'
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
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
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

  function makeManualHandler<K extends keyof import('@/lib/types').BrandData>(key: K) {
    return (rows: import('@/lib/types').BrandData[K] extends (infer T)[] ? T[] : never) => {
      setData(prev => {
        const existing = prev[brand][key] as unknown[]
        const next = { ...prev, [brand]: { ...prev[brand], [key]: [...existing, ...rows] } }
        saveData(next)
        return next
      })
    }
  }

  function handleReset() {
    setData(resetData())
  }

  const bd = data[brand]
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  function applyFilter<T extends { date: string }>(rows: T[]): T[] {
    if (dateRange) return filterByRange(rows, dateRange.from, dateRange.to)
    return filterByDays(rows, timeframe)
  }

  // Pre-filter data for platform views
  const filtered = {
    googleAds: applyFilter(bd.googleAds),
    metaAds: applyFilter(bd.metaAds),
    tiktokShop: applyFilter(bd.tiktokShop),
    shopee: applyFilter(bd.shopee ?? []),
    instagram: applyFilter(bd.instagram),
    tiktokOrganic: applyFilter(bd.tiktokOrganic),
    sales: applyFilter(bd.sales),
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F8F9FC' }}>
      <Sidebar brand={brand} view={view}
        onBrandChange={b => { setBrand(b); setView('overview') }}
        onViewChange={setView}
        onReset={handleReset}
      />

      <div className="flex-1 flex flex-col overflow-hidden" style={{ marginLeft: 240 }}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid #E5E7EB', background: '#FFFFFF' }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#9CA3AF' }}>{BRAND_LABELS[brand]}</span>
              <span style={{ color: '#D1D5DB' }}>/</span>
              <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#6B7280' }}>{VIEW_LABELS[view]}</span>
            </div>
            <h1 className="text-lg font-bold" style={{ color: '#111827' }}>
              {VIEW_LABELS[view]}
              <span className="text-sm font-normal ml-2" style={{ color: '#9CA3AF' }}>Analytics</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <TimeframeSelector value={timeframe} onChange={t => { setTimeframe(t); setDateRange(null) }} dateRange={dateRange} onDateRangeChange={setDateRange} />
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
          {view === 'google-ads' && <GoogleAdsView data={filtered.googleAds} brand={brand} onUpload={handleUpload} onManualAdd={makeManualHandler('googleAds')} salesData={filtered.sales} />}
          {view === 'meta-ads' && <MetaAdsView data={filtered.metaAds} brand={brand} onUpload={handleUpload} onManualAdd={makeManualHandler('metaAds')} salesData={filtered.sales} />}
          {view === 'tiktok-shop' && <TikTokShopView data={filtered.tiktokShop} brand={brand} onUpload={handleUpload} onManualAdd={makeManualHandler('tiktokShop')} />}
          {view === 'shopee' && <ShopeeView data={filtered.shopee} brand={brand} onUpload={handleUpload} onManualAdd={makeManualHandler('shopee')} />}
          {view === 'instagram' && <InstagramView data={filtered.instagram} brand={brand} onUpload={handleUpload} onManualAdd={makeManualHandler('instagram')} />}
          {view === 'tiktok-organic' && <TikTokOrganicView data={filtered.tiktokOrganic} brand={brand} onUpload={handleUpload} onManualAdd={makeManualHandler('tiktokOrganic')} />}
          {view === 'crm' && <CRMView data={bd.crm} brand={brand} onUpload={handleUpload} products={products} onManualAdd={handleManualCRM} />}
          {view === 'product-analysis' && <ProductAnalysisView salesData={bd.sales} crmData={bd.crm} brand={brand} timeframe={timeframe} />}
          {view === 'settings' && <SettingsView brand={brand} products={products} onProductsChange={handleProductsChange} />}
        </main>
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Brand, ActiveView, Timeframe, DateRange, BrandData, emptyBrandData, ProductMaster, BundleMaster } from '@/lib/types'
import { parseFile } from '@/lib/csvParser'
import { filterByDays, filterByRange } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import {
  loadBrandData,
  getProducts, upsertProduct, bulkInsertProducts, deleteProduct as dbDeleteProduct,
  getBundles, upsertBundle, deleteBundle as dbDeleteBundle,
  appendSales, replaceSales,
  appendCRM, replaceCRM,
  replaceGoogleAds, appendGoogleAds,
  replaceMetaAds, appendMetaAds,
  replaceTikTokShop, appendTikTokShop,
  replaceShopee, appendShopee,
  replaceInstagram, appendInstagram,
  replaceTikTokOrganic, appendTikTokOrganic,
} from '@/lib/db'
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
import PerformanceView from '@/components/views/PerformanceView'
import SettingsView from '@/components/views/SettingsView'
import AIChatButton from '@/components/AIChatButton'
import LoginPage from '@/components/LoginPage'

const VIEW_LABELS: Record<ActiveView, string> = {
  overview: 'Overview', funnel: 'Funnel Analysis', performance: 'Performance',
  sales: 'Sales Acquisition by CS', crm: 'Sales Retention by CRM', 'product-analysis': 'Product Analysis',
  'google-ads': 'Google Ads', 'meta-ads': 'Meta Ads', 'tiktok-shop': 'TikTok Shop',
  shopee: 'Shopee', instagram: 'Instagram', 'tiktok-organic': 'TikTok Organic',
  settings: 'Settings',
}
const BRAND_LABELS: Record<Brand, string> = { reglow: 'Reglow Skincare', amura: 'Amura' }

export default function Dashboard() {
  const { user, profile, loading: authLoading, profileLoading, canAccess, accessibleBrands } = useAuth()

  const [brand, setBrand] = useState<Brand>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sas_brand') as Brand
      if (stored === 'reglow' || stored === 'amura') return stored
    }
    return 'reglow'
  })
  const [view, setView] = useState<ActiveView>('overview')
  const [timeframe, setTimeframe] = useState<Timeframe>(30)
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [data, setData] = useState<Record<Brand, BrandData>>({ reglow: emptyBrandData(), amura: emptyBrandData() })
  const [products, setProducts] = useState<ProductMaster[]>([])
  const [bundles, setBundles] = useState<BundleMaster[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const initialViewSet = useRef(false)

  function handleBrandChange(b: Brand) {
    setBrand(b)
    localStorage.setItem('sas_brand', b)
  }

  // Set initial brand based on profile — only if stored brand is not accessible
  useEffect(() => {
    if (profile && accessibleBrands.length > 0) {
      const stored = localStorage.getItem('sas_brand') as Brand
      if (!accessibleBrands.includes(stored)) {
        handleBrandChange(accessibleBrands[0])
      }
    }
  }, [profile])

  // Load data when brand or auth changes
  const loadData = useCallback(async (b: Brand) => {
    if (!user) return
    setDataLoading(true)
    try {
      const [brandData, prods, bunds] = await Promise.all([
        loadBrandData(b),
        getProducts(),
        getBundles(),
      ])
      setData(prev => ({ ...prev, [b]: brandData }))
      setProducts(prods)
      setBundles(bunds)
    } catch (e) {
      console.error('Load error:', e)
    } finally {
      setDataLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) loadData(brand)
  }, [user?.id, brand])

  // Default view redirect based on role — once only
  useEffect(() => {
    if (profile && !initialViewSet.current) {
      initialViewSet.current = true
      if (!canAccess(view)) {
        const role = profile.role
        if (role === 'cs') setView('sales')
        else if (role === 'crm') setView('crm')
        else setView('overview')
      }
    }
  }, [profile])

  async function handleUpload(file: File) {
    const uploadView = view === 'sales' ? 'sales' : view
    const parsed = await parseFile(uploadView as ActiveView, file)
    const key =
      uploadView === 'google-ads' ? 'googleAds'
      : uploadView === 'meta-ads' ? 'metaAds'
      : uploadView === 'tiktok-shop' ? 'tiktokShop'
      : uploadView === 'shopee' ? 'shopee'
      : uploadView === 'instagram' ? 'instagram'
      : uploadView === 'tiktok-organic' ? 'tiktokOrganic'
      : uploadView === 'crm' ? 'crm'
      : 'sales'

    // Save to Supabase
    try {
      if (uploadView === 'google-ads') await replaceGoogleAds(parsed as import('@/lib/types').GoogleAdsRow[], brand)
      else if (uploadView === 'meta-ads') await replaceMetaAds(parsed as import('@/lib/types').MetaAdsRow[], brand)
      else if (uploadView === 'tiktok-shop') await replaceTikTokShop(parsed as import('@/lib/types').TikTokShopRow[], brand)
      else if (uploadView === 'shopee') await replaceShopee(parsed as import('@/lib/types').ShopeeRow[], brand)
      else if (uploadView === 'instagram') await replaceInstagram(parsed as import('@/lib/types').InstagramRow[], brand)
      else if (uploadView === 'tiktok-organic') await replaceTikTokOrganic(parsed as import('@/lib/types').TikTokOrganicRow[], brand)
      else if (uploadView === 'crm') await replaceCRM(parsed as import('@/lib/types').CRMRow[], brand)
      else await replaceSales(parsed as import('@/lib/types').SalesRow[], brand)
    } catch (e) { console.error('Upload save error:', e) }

    setData(prev => ({ ...prev, [brand]: { ...prev[brand], [key]: parsed } }))
  }

  async function handleProductsChange(updated: ProductMaster[]) {
    setProducts(updated)
    try {
      const current = products.filter(p => p.brand === brand)
      const updatedBrand = updated.filter(p => p.brand === brand)
      // Batch upsert all — much faster than sequential loop
      await Promise.all(updatedBrand.map(p => upsertProduct(p)))
      // Find deleted
      const updatedIds = new Set(updatedBrand.map(p => p.id))
      const toDelete = current.filter(p => !updatedIds.has(p.id))
      await Promise.all(toDelete.map(p => dbDeleteProduct(p.id)))
    } catch (e) { console.error('Products save error:', e) }
  }

  async function handleBulkImportProducts(newProducts: ProductMaster[]): Promise<{ imported: number; error?: string }> {
    try {
      await bulkInsertProducts(newProducts)
      setProducts(prev => [...prev, ...newProducts])
      return { imported: newProducts.length }
    } catch (e) {
      console.error('Bulk import error:', e)
      return { imported: 0, error: e instanceof Error ? e.message : String(e) }
    }
  }

  async function handleBundlesChange(updated: BundleMaster[]) {
    setBundles(updated)
    try {
      const current = bundles.filter(b => b.brand === brand)
      const updatedBrand = updated.filter(b => b.brand === brand)
      for (const b of updatedBrand) await upsertBundle(b)
      const updatedIds = new Set(updatedBrand.map(b => b.id))
      for (const b of current) {
        if (!updatedIds.has(b.id)) await dbDeleteBundle(b.id)
      }
    } catch (e) { console.error('Bundles save error:', e) }
  }

  async function handleManualSales(rows: import('@/lib/types').SalesRow[]) {
    try { await appendSales(rows, brand) } catch (e) { console.error(e) }
    setData(prev => ({ ...prev, [brand]: { ...prev[brand], sales: [...prev[brand].sales, ...rows] } }))
  }

  async function handleManualCRM(rows: import('@/lib/types').CRMRow[]) {
    try { await appendCRM(rows, brand) } catch (e) { console.error(e) }
    setData(prev => ({ ...prev, [brand]: { ...prev[brand], crm: [...prev[brand].crm, ...rows] } }))
  }

  async function handleBulkSales(rows: import('@/lib/types').SalesRow[]) {
    try { await replaceSales(rows, brand) } catch (e) { console.error(e) }
    setData(prev => ({ ...prev, [brand]: { ...prev[brand], sales: rows } }))
  }

  async function handleBulkCRM(rows: import('@/lib/types').CRMRow[]) {
    try { await replaceCRM(rows, brand) } catch (e) { console.error(e) }
    setData(prev => ({ ...prev, [brand]: { ...prev[brand], crm: rows } }))
  }

  function makeManualHandler<K extends keyof import('@/lib/types').BrandData>(key: K) {
    return async (rows: import('@/lib/types').BrandData[K] extends (infer T)[] ? T[] : never) => {
      try {
        if (key === 'googleAds') await appendGoogleAds(rows as import('@/lib/types').GoogleAdsRow[], brand)
        else if (key === 'metaAds') await appendMetaAds(rows as import('@/lib/types').MetaAdsRow[], brand)
        else if (key === 'tiktokShop') await appendTikTokShop(rows as import('@/lib/types').TikTokShopRow[], brand)
        else if (key === 'shopee') await appendShopee(rows as import('@/lib/types').ShopeeRow[], brand)
        else if (key === 'instagram') await appendInstagram(rows as import('@/lib/types').InstagramRow[], brand)
        else if (key === 'tiktokOrganic') await appendTikTokOrganic(rows as import('@/lib/types').TikTokOrganicRow[], brand)
      } catch (e) { console.error(e) }
      setData(prev => {
        const existing = prev[brand][key] as unknown[]
        return { ...prev, [brand]: { ...prev[brand], [key]: [...existing, ...rows] } }
      })
    }
  }

  // ── Auth loading / login guard ────────────────────────────────────────────

  if (authLoading || (!profile && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8F9FC' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: '#C9A96E', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: '#6B7280' }}>Memuat...</p>
        </div>
      </div>
    )
  }

  if (!user) return <LoginPage />

  const bd = data[brand]
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  function applyFilter<T extends { date: string }>(rows: T[]): T[] {
    if (dateRange) return filterByRange(rows, dateRange.from, dateRange.to)
    return filterByDays(rows, timeframe)
  }

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
      <Sidebar
        brand={brand}
        view={view}
        onBrandChange={b => { handleBrandChange(b); setView('overview') }}
        onViewChange={v => { if (canAccess(v)) setView(v) }}
        onReset={() => {}}
        accessibleBrands={accessibleBrands}
        canAccess={canAccess}
        userName={profile?.full_name ?? profile?.role}
        userRole={profile?.role}
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

        {/* Data loading indicator */}
        {dataLoading && (
          <div className="h-0.5 w-full overflow-hidden" style={{ background: '#F3F4F6' }}>
            <div className="h-full animate-pulse" style={{ background: '#C9A96E', width: '60%' }} />
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-8 py-6 pb-24">
          {view === 'overview' && <OverviewView data={bd} brand={brand} timeframe={timeframe} products={products} />}
          {view === 'funnel' && <FunnelView data={bd} brand={brand} timeframe={timeframe} />}
          {view === 'sales' && <SalesView data={bd.sales} brand={brand} timeframe={timeframe} onUpload={handleUpload} onBulkUpload={handleBulkSales} products={products} bundles={bundles} onManualAdd={handleManualSales} />}
          {view === 'google-ads' && <GoogleAdsView data={filtered.googleAds} brand={brand} onUpload={handleUpload} onManualAdd={makeManualHandler('googleAds')} salesData={filtered.sales} />}
          {view === 'meta-ads' && <MetaAdsView data={filtered.metaAds} brand={brand} onUpload={handleUpload} onManualAdd={makeManualHandler('metaAds')} salesData={filtered.sales} />}
          {view === 'tiktok-shop' && <TikTokShopView data={filtered.tiktokShop} brand={brand} onUpload={handleUpload} onManualAdd={makeManualHandler('tiktokShop')} />}
          {view === 'shopee' && <ShopeeView data={filtered.shopee} brand={brand} onUpload={handleUpload} onManualAdd={makeManualHandler('shopee')} />}
          {view === 'instagram' && <InstagramView data={filtered.instagram} brand={brand} onUpload={handleUpload} onManualAdd={makeManualHandler('instagram')} />}
          {view === 'tiktok-organic' && <TikTokOrganicView data={filtered.tiktokOrganic} brand={brand} onUpload={handleUpload} onManualAdd={makeManualHandler('tiktokOrganic')} />}
          {view === 'crm' && <CRMView data={bd.crm} brand={brand} onUpload={handleUpload} onBulkUpload={handleBulkCRM} products={products} bundles={bundles} onManualAdd={handleManualCRM} />}
          {view === 'performance' && <PerformanceView salesData={bd.sales} brand={brand} />}
          {view === 'product-analysis' && <ProductAnalysisView salesData={bd.sales} crmData={bd.crm} brand={brand} timeframe={timeframe} products={products} bundles={bundles} />}
          {view === 'settings' && <SettingsView brand={brand} products={products} onProductsChange={handleProductsChange} onBulkImportProducts={handleBulkImportProducts} bundles={bundles} onBundlesChange={handleBundlesChange} />}
        </main>
      </div>

      <AIChatButton context={{
        currentView: view,
        brand,
        timeframe: dateRange ? `${dateRange.from} – ${dateRange.to}` : `${timeframe === 0 ? 'All' : timeframe + 'H'}`,
        hasData: {
          sales: bd.sales.length > 0,
          crm: bd.crm.length > 0,
          googleAds: bd.googleAds.length > 0,
          metaAds: bd.metaAds.length > 0,
          tiktokShop: bd.tiktokShop.length > 0,
          shopee: (bd.shopee ?? []).length > 0,
          instagram: bd.instagram.length > 0,
          tiktokOrganic: bd.tiktokOrganic.length > 0,
        },
        productCount: products.filter(p => p.brand === brand).length,
        bundleCount: bundles.filter(b => b.brand === brand).length,
      }} />
    </div>
  )
}

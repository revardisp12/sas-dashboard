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
  replaceFacebookOrganic, appendFacebookOrganic,
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
import FacebookOrganicView from '@/components/platforms/FacebookOrganicView'
import CRMView from '@/components/views/CRMView'
import ProductAnalysisView from '@/components/views/ProductAnalysisView'
import PerformanceView from '@/components/views/PerformanceView'
import SettingsView from '@/components/views/SettingsView'
import LoginPage from '@/components/LoginPage'

const VIEW_LABELS: Record<ActiveView, string> = {
  overview: 'Overview', funnel: 'Funnel Analysis', performance: 'Performance',
  sales: 'Sales Acquisition by CS', crm: 'Sales Retention by CRM', 'product-analysis': 'Product Analysis',
  'google-ads': 'Google Ads', 'meta-ads': 'Meta Ads', 'tiktok-shop': 'TikTok Shop',
  shopee: 'Shopee', instagram: 'Instagram', 'tiktok-organic': 'TikTok Organic', 'facebook-organic': 'Facebook Organic',
  settings: 'Settings',
}
const BRAND_LABELS: Record<Brand, string> = { reglow: 'Reglow Skincare', amura: 'Amura', purela: 'Purela' }

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export default function Dashboard() {
  const { user, profile, loading: authLoading, profileLoading, profileError, canAccess, accessibleBrands } = useAuth()

  const [brand, setBrand] = useState<Brand>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sas_brand') as Brand
      if (stored === 'reglow' || stored === 'amura' || stored === 'purela') return stored
    }
    return 'reglow'
  })
  const [view, setView] = useState<ActiveView>('overview')
  const [timeframe, setTimeframe] = useState<Timeframe>(30)
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [data, setData] = useState<Record<Brand, BrandData>>({ reglow: emptyBrandData(), amura: emptyBrandData(), purela: emptyBrandData() })
  const [products, setProducts] = useState<ProductMaster[]>([])
  const [bundles, setBundles] = useState<BundleMaster[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [toast, setToast] = useState<{ kind: 'error' | 'success'; msg: string } | null>(null)
  const initialViewSet = useRef(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.kind === 'error' ? 5000 : 3000)
    return () => clearTimeout(t)
  }, [toast])

  const showError = (msg: string) => setToast({ kind: 'error', msg })
  const showSuccess = (msg: string) => setToast({ kind: 'success', msg })

  function handleBrandChange(b: Brand) {
    if (accessibleBrands.length > 0 && !accessibleBrands.includes(b)) return
    setBrand(b)
    localStorage.setItem('sas_brand', b)
  }

  // Set initial brand based on profile — enforce accessible brand
  useEffect(() => {
    if (profile && accessibleBrands.length > 0) {
      const stored = localStorage.getItem('sas_brand') as Brand
      if (!accessibleBrands.includes(stored)) {
        const correct = accessibleBrands[0]
        setBrand(correct)
        localStorage.setItem('sas_brand', correct)
      }
    }
  }, [profile, accessibleBrands.join(',')])

  // Load data when brand or auth changes
  const loadData = useCallback(async (b: Brand) => {
    if (!user) return
    setDataLoading(true)
    try {
      const [brandResult, prods, bunds] = await Promise.all([
        loadBrandData(b),
        getProducts(b),
        getBundles(b),
      ])
      setData(prev => ({ ...prev, [b]: brandResult.data }))
      setProducts(prods)
      setBundles(bunds)
      if (brandResult.errors.length > 0) {
        const sources = brandResult.errors.map(e => e.source).join(', ')
        showError(`Gagal load ${brandResult.errors.length} sumber data (${sources}). Cek koneksi atau refresh halaman.`)
      }
    } catch (e) {
      console.error('Load error:', e)
      showError(`Gagal load data: ${errMsg(e)}`)
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
    if (accessibleBrands.length > 0 && !accessibleBrands.includes(brand)) return
    const uploadView = view === 'sales' ? 'sales' : view

    let parsed: unknown[]
    try {
      parsed = await parseFile(uploadView as ActiveView, file)
    } catch (e) {
      showError(`Parse CSV gagal: ${errMsg(e)}`)
      return
    }

    const key =
      uploadView === 'google-ads' ? 'googleAds'
      : uploadView === 'meta-ads' ? 'metaAds'
      : uploadView === 'tiktok-shop' ? 'tiktokShop'
      : uploadView === 'shopee' ? 'shopee'
      : uploadView === 'instagram' ? 'instagram'
      : uploadView === 'tiktok-organic' ? 'tiktokOrganic'
      : uploadView === 'facebook-organic' ? 'facebookOrganic'
      : uploadView === 'crm' ? 'crm'
      : 'sales'

    try {
      if (uploadView === 'google-ads') await replaceGoogleAds(parsed as import('@/lib/types').GoogleAdsRow[], brand)
      else if (uploadView === 'meta-ads') await replaceMetaAds(parsed as import('@/lib/types').MetaAdsRow[], brand)
      else if (uploadView === 'tiktok-shop') await replaceTikTokShop(parsed as import('@/lib/types').TikTokShopRow[], brand)
      else if (uploadView === 'shopee') await replaceShopee(parsed as import('@/lib/types').ShopeeRow[], brand)
      else if (uploadView === 'instagram') await replaceInstagram(parsed as import('@/lib/types').InstagramRow[], brand)
      else if (uploadView === 'tiktok-organic') await replaceTikTokOrganic(parsed as import('@/lib/types').TikTokOrganicRow[], brand)
      else if (uploadView === 'facebook-organic') await replaceFacebookOrganic(parsed as import('@/lib/types').FacebookOrganicRow[], brand)
      else if (uploadView === 'crm') await replaceCRM(parsed as import('@/lib/types').CRMRow[], brand)
      else await replaceSales(parsed as import('@/lib/types').SalesRow[], brand)

      setData(prev => ({ ...prev, [brand]: { ...prev[brand], [key]: parsed } }))
      showSuccess(`Upload sukses: ${parsed.length} baris`)
    } catch (e) {
      showError(`Simpan gagal: ${errMsg(e)}`)
    }
  }

  async function handleProductsChange(updated: ProductMaster[]) {
    try {
      const current = products.filter(p => p.brand === brand)
      const updatedBrand = updated.filter(p => p.brand === brand)
      await Promise.all(updatedBrand.map(p => upsertProduct(p)))
      const updatedIds = new Set(updatedBrand.map(p => p.id))
      const toDelete = current.filter(p => !updatedIds.has(p.id))
      await Promise.all(toDelete.map(p => dbDeleteProduct(p.id)))
      setProducts(updated)
    } catch (e) {
      showError(`Simpan produk gagal: ${errMsg(e)}`)
    }
  }

  async function handleBulkImportProducts(newProducts: ProductMaster[]): Promise<{ imported: number; error?: string }> {
    try {
      await bulkInsertProducts(newProducts)
      setProducts(prev => [...prev, ...newProducts])
      showSuccess(`Import ${newProducts.length} produk sukses`)
      return { imported: newProducts.length }
    } catch (e) {
      showError(`Import produk gagal: ${errMsg(e)}`)
      return { imported: 0, error: errMsg(e) }
    }
  }

  async function handleBundlesChange(updated: BundleMaster[]) {
    try {
      const current = bundles.filter(b => b.brand === brand)
      const updatedBrand = updated.filter(b => b.brand === brand)
      for (const b of updatedBrand) await upsertBundle(b)
      const updatedIds = new Set(updatedBrand.map(b => b.id))
      for (const b of current) {
        if (!updatedIds.has(b.id)) await dbDeleteBundle(b.id)
      }
      setBundles(updated)
    } catch (e) {
      showError(`Simpan bundle gagal: ${errMsg(e)}`)
    }
  }

  async function handleManualSales(rows: import('@/lib/types').SalesRow[]) {
    try {
      await appendSales(rows, brand)
      setData(prev => ({ ...prev, [brand]: { ...prev[brand], sales: [...prev[brand].sales, ...rows] } }))
    } catch (e) {
      showError(`Simpan sales gagal: ${errMsg(e)}`)
    }
  }

  async function handleManualCRM(rows: import('@/lib/types').CRMRow[]) {
    try {
      await appendCRM(rows, brand)
      setData(prev => ({ ...prev, [brand]: { ...prev[brand], crm: [...prev[brand].crm, ...rows] } }))
    } catch (e) {
      showError(`Simpan CRM gagal: ${errMsg(e)}`)
    }
  }

  async function handleBulkSales(rows: import('@/lib/types').SalesRow[]) {
    try {
      await replaceSales(rows, brand)
      setData(prev => ({ ...prev, [brand]: { ...prev[brand], sales: rows } }))
      showSuccess(`Replace sales sukses: ${rows.length} baris`)
    } catch (e) {
      showError(`Replace sales gagal: ${errMsg(e)}`)
    }
  }

  async function handleBulkCRM(rows: import('@/lib/types').CRMRow[]) {
    try {
      await replaceCRM(rows, brand)
      setData(prev => ({ ...prev, [brand]: { ...prev[brand], crm: rows } }))
      showSuccess(`Replace CRM sukses: ${rows.length} baris`)
    } catch (e) {
      showError(`Replace CRM gagal: ${errMsg(e)}`)
    }
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
        else if (key === 'facebookOrganic') await appendFacebookOrganic(rows as import('@/lib/types').FacebookOrganicRow[], brand)
        setData(prev => {
          const existing = prev[brand][key] as unknown[]
          return { ...prev, [brand]: { ...prev[brand], [key]: [...existing, ...rows] } }
        })
      } catch (e) {
        showError(`Simpan ${String(key)} gagal: ${errMsg(e)}`)
      }
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

  if (!profile && profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8F9FC' }}>
        <div className="max-w-md p-6 rounded-2xl border bg-white text-center" style={{ borderColor: '#FECACA' }}>
          <h1 className="text-base font-bold mb-2" style={{ color: '#991B1B' }}>Gagal load profile</h1>
          <p className="text-sm mb-4" style={{ color: '#4B5563' }}>{profileError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: '#DC2626', color: '#FFFFFF' }}
          >
            Refresh halaman
          </button>
        </div>
      </div>
    )
  }

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
    facebookOrganic: applyFilter(bd.facebookOrganic ?? []),
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
          {view === 'facebook-organic' && <FacebookOrganicView data={filtered.facebookOrganic} brand={brand} onUpload={handleUpload} onManualAdd={makeManualHandler('facebookOrganic')} />}
          {view === 'crm' && <CRMView data={bd.crm} brand={brand} onUpload={handleUpload} onBulkUpload={handleBulkCRM} products={products} bundles={bundles} onManualAdd={handleManualCRM} />}
          {view === 'performance' && <PerformanceView salesData={bd.sales} brand={brand} />}
          {view === 'product-analysis' && <ProductAnalysisView salesData={bd.sales} crmData={bd.crm} brand={brand} timeframe={timeframe} products={products} bundles={bundles} />}
          {view === 'settings' && <SettingsView brand={brand} products={products} onProductsChange={handleProductsChange} onBulkImportProducts={handleBulkImportProducts} bundles={bundles} onBundlesChange={handleBundlesChange} />}
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 max-w-sm rounded-lg shadow-lg px-4 py-3 text-sm font-medium"
          style={{
            background: toast.kind === 'error' ? '#FEF2F2' : '#ECFDF5',
            color: toast.kind === 'error' ? '#991B1B' : '#065F46',
            border: `1px solid ${toast.kind === 'error' ? '#FECACA' : '#A7F3D0'}`,
          }}
          onClick={() => setToast(null)}
          role="alert"
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}

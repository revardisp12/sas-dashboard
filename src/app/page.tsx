'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Brand, ActiveView, DateRange, BrandData, emptyBrandData, ProductMaster, BundleMaster } from '@/lib/types'
import { parseFile } from '@/lib/csvParser'
import { filterByRange, resolvePeriod, type Period } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { Menu } from 'lucide-react'
import {
  loadBrandData,
  getProducts, upsertProduct, bulkInsertProducts, deleteProduct as dbDeleteProduct,
  getBundles, upsertBundle, deleteBundle as dbDeleteBundle,
  replaceSales,
  appendCRM, replaceCRM,
  replaceGoogleAds, appendGoogleAds,
  replaceMetaAds, appendMetaAds,
  replaceTikTokShop, appendTikTokShop,
  replaceShopee, appendShopee,
  replaceInstagram, appendInstagram,
  replaceTikTokOrganic, appendTikTokOrganic,
  replaceFacebookOrganic, appendFacebookOrganic,
  getLatestSyncStatus, type SyncStatus,
} from '@/lib/db'
import { useRealtimeSync } from '@/lib/wms/useRealtimeSync'
import Sidebar from '@/components/Sidebar'
import TimeframeSelector from '@/components/TimeframeSelector'
import BrandSyncButton from '@/components/wms/BrandSyncButton'
import OverviewView from '@/components/views/OverviewView'
import FunnelView from '@/components/views/FunnelView'
import ChannelSalesView from '@/components/views/ChannelSalesView'
import GoogleAdsView from '@/components/platforms/GoogleAdsView'
import MetaAdsView from '@/components/platforms/MetaAdsView'
import InstagramView from '@/components/platforms/InstagramView'
import TikTokOrganicView from '@/components/platforms/TikTokOrganicView'
import FacebookOrganicView from '@/components/platforms/FacebookOrganicView'
import CRMView from '@/components/views/CRMView'
import ProductAnalysisView from '@/components/views/ProductAnalysisView'
import PerformanceView from '@/components/views/PerformanceView'
import SettingsView from '@/components/views/SettingsView'
import KolView from '@/components/kol/KolView'
import CAdsCalculatorView from '@/components/views/CAdsCalculatorView'
import LoginPage from '@/components/LoginPage'

const VIEW_LABELS: Record<ActiveView, string> = {
  overview: 'Overview', funnel: 'Funnel Analysis', performance: 'Performance',
  sales: 'Sales Acquisition by CS', crm: 'Sales Retention by CRM', 'product-analysis': 'Product Analysis',
  'google-ads': 'Google Ads', 'meta-ads': 'Meta Ads', 'tiktok-shop': 'TikTok Shop',
  shopee: 'Shopee', instagram: 'Instagram', 'tiktok-organic': 'TikTok Organic', 'facebook-organic': 'Facebook Organic',
  settings: 'Settings', kol: 'KOL Management',
  'cads-calculator': 'C-Ads Calculator',
  tokopedia: 'Tokopedia', lazada: 'Lazada',
}
const BRAND_LABELS: Record<Brand, string> = { reglow: 'Reglow Skincare', amura: 'Amura', purela: 'Purela' }

// Map loadBrandData errors[].source (DB table name) -> BrandData key.
// Used to keep previous data for the failed source instead of overwriting
// it with the empty-array fallback baked into loadBrandData.
const TABLE_TO_KEY: Record<string, keyof BrandData> = {
  sales: 'sales',
  crm: 'crm',
  google_ads: 'googleAds',
  meta_ads: 'metaAds',
  tiktok_shop: 'tiktokShop',
  shopee: 'shopee',
  instagram: 'instagram',
  tiktok_organic: 'tiktokOrganic',
  facebook_organic: 'facebookOrganic',
}

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
  const [mobileNav, setMobileNav] = useState(false)
  const [period, setPeriod] = useState<Period>('7d')
  const [dateRange, setDateRange] = useState<DateRange>(() => resolvePeriod('7d'))
  const [data, setData] = useState<Record<Brand, BrandData>>({ reglow: emptyBrandData(), amura: emptyBrandData(), purela: emptyBrandData() })
  const [products, setProducts] = useState<ProductMaster[]>([])
  const [bundles, setBundles] = useState<BundleMaster[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [toast, setToast] = useState<{ kind: 'error' | 'success'; msg: string } | null>(null)
  // Persistent (non-auto-dismissing) indicator of sources that failed to load — the toast
  // above auto-dismisses after 5s, which previously left a "Rp 0" dashboard looking like
  // real data with no lasting signal that something didn't load. Cleared once a source
  // reloads successfully.
  const [degradedSources, setDegradedSources] = useState<string[]>([])
  const [syncHealth, setSyncHealth] = useState<SyncStatus | null>(null)
  const initialViewSet = useRef(false)
  const requestIdRef = useRef(0)

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
        // Correcting brand once the async profile reveals it is inaccessible.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setBrand(correct)
        localStorage.setItem('sas_brand', correct)
      }
    }
  }, [profile, accessibleBrands.join(',')])

  // Load data when brand or auth changes
  const loadData = useCallback(async (b: Brand) => {
    if (!user) return
    // Guard against a stale response: if the user switches brands (or a realtime event fires)
    // again before this call resolves, an older in-flight call finishing late must not
    // clobber the shared (non-per-brand) products/bundles state or the loading indicator with
    // outdated data. `data` itself is safe already (keyed per-brand below).
    const requestId = ++requestIdRef.current
    const isLatest = () => requestId === requestIdRef.current
    setDataLoading(true)
    try {
      const [brandResult, prods, bunds] = await Promise.all([
        loadBrandData(b),
        getProducts(b),
        getBundles(b),
      ])
      const failedKeys = new Set(
        brandResult.errors.map(e => TABLE_TO_KEY[e.source]).filter(Boolean) as (keyof BrandData)[]
      )
      // Selective merge: for sources that failed, keep prev[b][key] instead
      // of overwriting with the empty fallback. Prevents a transient fetch
      // failure from blanking the chart while the toast auto-dismisses.
      setData(prev => {
        const merged = { ...prev[b] } as unknown as Record<string, unknown>
        for (const k of Object.keys(brandResult.data) as (keyof BrandData)[]) {
          if (!failedKeys.has(k)) {
            merged[k] = brandResult.data[k]
          }
        }
        return { ...prev, [b]: merged as unknown as BrandData }
      })
      if (isLatest()) {
        setProducts(prods)
        setBundles(bunds)
        setDegradedSources(brandResult.errors.map(e => e.source))
      }
      if (isLatest() && brandResult.errors.length > 0) {
        const sources = brandResult.errors.map(e => e.source).join(', ')
        showError(`Gagal load ${brandResult.errors.length} sumber data (${sources}). Data sebelumnya dipertahankan. Refresh untuk coba lagi.`)
      }
    } catch (e) {
      console.error('Load error:', e)
      if (isLatest()) showError(`Gagal load data: ${errMsg(e)}`)
    } finally {
      if (isLatest()) setDataLoading(false)
    }
  }, [user])

  const onRealtime = useCallback(() => {
    const loadPromise = user ? loadData(brand) : Promise.resolve()
    const syncPromise = getLatestSyncStatus().then(setSyncHealth).catch(() => setSyncHealth(null))
    return Promise.all([loadPromise, syncPromise]).then(() => undefined)
  }, [user, brand, loadData])
  useRealtimeSync(brand, onRealtime)

  useEffect(() => {
    // Sync-health badge — fetch once on mount (external system, not derivable during render).
    getLatestSyncStatus().then(setSyncHealth).catch(() => setSyncHealth(null))
  }, [])

  useEffect(() => {
    // Fetch brand data from Supabase on auth/brand change (external system).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) loadData(brand)
  }, [user?.id, brand])

  // Default view redirect based on role — once only
  useEffect(() => {
    if (profile && !initialViewSet.current) {
      initialViewSet.current = true
      if (!canAccess(view)) {
        const role = profile.role
        // One-time default-view redirect once the async profile/role resolves.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (role === 'cs') setView('sales')
        else if (role === 'crm') setView('crm')
        else if (role === 'kol_specialist') setView('kol')
        else setView('overview')
      }
    }
  }, [profile])

  // Hoisted above the auth-loading/login/profile-error early returns below (Rules of Hooks —
  // a hook cannot be called conditionally, and those returns happen on some renders but not
  // others). Derives its own `bd` from data[brand] rather than depending on the `bd` variable
  // declared later, since that variable's declaration sits after the early-return guards.
  const filtered = useMemo(() => {
    const bd = data[brand]
    return {
      googleAds: filterByRange(bd.googleAds, dateRange.from, dateRange.to),
      metaAds: filterByRange(bd.metaAds, dateRange.from, dateRange.to),
      instagram: filterByRange(bd.instagram, dateRange.from, dateRange.to),
      tiktokOrganic: filterByRange(bd.tiktokOrganic, dateRange.from, dateRange.to),
      facebookOrganic: filterByRange(bd.facebookOrganic ?? [], dateRange.from, dateRange.to),
      sales: filterByRange(bd.sales, dateRange.from, dateRange.to),
    }
  }, [data, brand, dateRange.from, dateRange.to])

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
      // Partial-success risk: some upserts/deletes may have committed before
      // the reject. Re-fetch from DB to converge local state with truth.
      await loadData(brand)
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
      // Sequential loop may have committed earlier rows before reject; re-sync.
      await loadData(brand)
    }
  }

  async function handleManualCRM(rows: import('@/lib/types').CRMRow[]) {
    try {
      await appendCRM(rows, brand)
      setData(prev => ({ ...prev, [brand]: { ...prev[brand], crm: [...prev[brand].crm, ...rows] } }))
      showSuccess(`CRM ditambahkan: ${rows.length} baris`)
    } catch (e) {
      showError(`Simpan CRM gagal: ${errMsg(e)}`)
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
        showSuccess(`${String(key)} ditambahkan: ${rows.length} baris`)
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

  // Top-bar badge reflects the actual most recent sync run instead of a hardcoded "Live" dot.
  const SYNC_HEALTH_STYLE: Record<string, { color: string; label: string }> = {
    success: { color: '#10B981', label: 'Live' },
    partial: { color: '#F59E0B', label: 'Sebagian Gagal' },
    failed: { color: '#EF4444', label: 'Sync Gagal' },
    running: { color: '#3B82F6', label: 'Syncing…' },
  }
  const { color: syncHealthColor, label: syncHealthLabel } = SYNC_HEALTH_STYLE[syncHealth?.status ?? ''] ?? { color: '#9CA3AF', label: '—' }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F8F9FC' }}>
      <Sidebar
        brand={brand}
        view={view}
        onBrandChange={b => { handleBrandChange(b); setView('overview'); setMobileNav(false) }}
        onViewChange={v => { if (canAccess(v)) { setView(v); setMobileNav(false) } }}
        onReset={() => {}}
        accessibleBrands={accessibleBrands}
        canAccess={canAccess}
        userName={profile?.full_name ?? profile?.role}
        userRole={profile?.role}
        open={mobileNav}
        onClose={() => setMobileNav(false)}
      />
      {mobileNav && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileNav(false)} aria-hidden />
      )}

      <div className="flex-1 flex flex-col overflow-hidden lg:ml-60">
        {/* Top bar */}
        <div className="flex flex-col gap-3 px-4 py-3 flex-shrink-0 lg:flex-row lg:items-center lg:justify-between lg:px-8"
          style={{ borderBottom: '1px solid #E5E7EB', background: '#FFFFFF' }}>
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileNav(true)}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0"
              style={{ background: '#F3F4F6', color: '#374151' }} aria-label="Buka menu">
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#9CA3AF' }}>{BRAND_LABELS[brand]}</span>
                <span style={{ color: '#D1D5DB' }}>/</span>
                <span className="text-[10px] font-semibold tracking-widest uppercase truncate" style={{ color: '#6B7280' }}>{VIEW_LABELS[view]}</span>
              </div>
              <h1 className="text-base lg:text-lg font-bold truncate" style={{ color: '#111827' }}>
                {VIEW_LABELS[view]}
                <span className="text-sm font-normal ml-2 hidden sm:inline" style={{ color: '#9CA3AF' }}>Analytics</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-4 flex-wrap">
            {(['super_admin', 'admin'] as string[]).includes(profile?.role ?? '') && (
              <BrandSyncButton
                brand={brand}
                onResult={r => {
                  if (r.ok) { showSuccess(r.text); loadData(brand) } else showError(r.text)
                  getLatestSyncStatus().then(setSyncHealth).catch(() => setSyncHealth(null))
                }}
              />
            )}
            <TimeframeSelector
              period={period}
              dateRange={dateRange}
              onSelectPeriod={p => { setPeriod(p); setDateRange(resolvePeriod(p)) }}
              onCustomRange={r => { setPeriod('custom'); setDateRange(r) }}
            />
            <div className="text-right hidden lg:block">
              <p className="text-[10px]" style={{ color: '#374151' }}>{today}</p>
              <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: syncHealthColor, boxShadow: `0 0 6px ${syncHealthColor}` }} />
                <span className="text-[10px] font-medium" style={{ color: syncHealthColor }}>{syncHealthLabel}</span>
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

        {/* Persistent (non-auto-dismissing) degraded-source banner — see loadData's comment */}
        {degradedSources.length > 0 && (
          <div className="px-4 lg:px-8 py-1.5 text-[11px] flex items-center gap-2" style={{ background: '#FEF3C7', color: '#92400E', borderBottom: '1px solid #FDE68A' }}>
            <span>⚠️ Gagal load: {degradedSources.join(', ')} — menampilkan data sebelumnya.</span>
            <button onClick={() => loadData(brand)} className="underline font-medium flex-shrink-0">Coba lagi</button>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-4 py-4 pb-24 lg:px-8 lg:py-6">
          {view === 'overview' && <OverviewView data={bd} brand={brand} range={dateRange} products={products} />}
          {view === 'funnel' && <FunnelView data={bd} brand={brand} range={dateRange} />}
          {view === 'sales' && <ChannelSalesView sales={bd.sales} brand={brand} range={dateRange} channel="cs" products={products} />}
          {view === 'shopee' && <ChannelSalesView sales={bd.sales} brand={brand} range={dateRange} channel="shopee" products={products} />}
          {view === 'tiktok-shop' && <ChannelSalesView sales={bd.sales} brand={brand} range={dateRange} channel="tiktok" products={products} />}
          {view === 'tokopedia' && <ChannelSalesView sales={bd.sales} brand={brand} range={dateRange} channel="tokopedia" products={products} />}
          {view === 'lazada' && <ChannelSalesView sales={bd.sales} brand={brand} range={dateRange} channel="lazada" products={products} />}
          {view === 'google-ads' && <GoogleAdsView data={filtered.googleAds} brand={brand} onUpload={handleUpload} onManualAdd={makeManualHandler('googleAds')} salesData={filtered.sales} />}
          {view === 'meta-ads' && <MetaAdsView data={filtered.metaAds} brand={brand} onUpload={handleUpload} onManualAdd={makeManualHandler('metaAds')} salesData={filtered.sales} />}
          {view === 'instagram' && <InstagramView data={filtered.instagram} brand={brand} onUpload={handleUpload} onManualAdd={makeManualHandler('instagram')} />}
          {view === 'tiktok-organic' && <TikTokOrganicView data={filtered.tiktokOrganic} brand={brand} onUpload={handleUpload} onManualAdd={makeManualHandler('tiktokOrganic')} />}
          {view === 'facebook-organic' && <FacebookOrganicView data={filtered.facebookOrganic} brand={brand} onUpload={handleUpload} onManualAdd={makeManualHandler('facebookOrganic')} />}
          {view === 'crm' && <CRMView data={bd.crm} brand={brand} onUpload={handleUpload} onBulkUpload={handleBulkCRM} products={products} bundles={bundles} onManualAdd={handleManualCRM} />}
          {view === 'performance' && <PerformanceView salesData={bd.sales} brand={brand} />}
          {view === 'product-analysis' && <ProductAnalysisView salesData={bd.sales} crmData={bd.crm} brand={brand} products={products} bundles={bundles} />}
          {view === 'settings' && <SettingsView brand={brand} products={products} onProductsChange={handleProductsChange} onBulkImportProducts={handleBulkImportProducts} bundles={bundles} onBundlesChange={handleBundlesChange} />}
          {view === 'kol' && <KolView brand={brand} />}
          {view === 'cads-calculator' && <CAdsCalculatorView brand={brand} />}
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

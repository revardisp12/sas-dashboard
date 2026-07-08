import Papa from 'papaparse'
import {
  GoogleAdsRow, MetaAdsRow, TikTokShopRow, ShopeeRow, InstagramRow, TikTokOrganicRow, FacebookOrganicRow, SalesRow, SalesSource, CRMRow, ActiveView
} from './types'

const VALID_SALES_SOURCES: SalesSource[] = ['organic', 'google-ads', 'meta-ads', 'tiktok-ads']
function normalizeSalesSource(s: unknown): SalesSource {
  return typeof s === 'string' && (VALID_SALES_SOURCES as string[]).includes(s)
    ? (s as SalesSource)
    : 'organic'
}

export function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  let s = String(v).trim().replace(/[Rp%\s]/g, '')

  const hasComma = s.includes(',')
  const hasDot = s.includes('.')

  if (hasComma && hasDot) {
    // Format Indonesia: 1.234.567,89 → hapus dot (ribuan), ganti koma jadi titik
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (hasComma) {
    // Hanya koma: cek apakah desimal (1,72) atau ribuan (1,000)
    if (/,\d{1,2}$/.test(s)) {
      s = s.replace(',', '.') // desimal
    } else {
      s = s.replace(/,/g, '') // ribuan
    }
  } else if (hasDot) {
    // Hanya titik: kalau diikuti tepat 3 digit → ribuan (332.455 → 332455)
    const parts = s.split('.')
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
      s = s.replace(/\./g, '')
    }
    // Kalau titik diikuti 1-2 digit → biarkan sebagai desimal (1.72 → 1.72)
  }

  return parseFloat(s) || 0
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DMY_RE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/

/**
 * Normalize a CSV date cell to YYYY-MM-DD. filterByRange/filterByDays compare dates as
 * plain strings, so a non-ISO date silently sorts outside every period filter and the row
 * just vanishes from the dashboard with no error, no matter how the value was entered.
 * Passes ISO through unchanged; converts the common DD/MM/YYYY or DD-MM-YYYY (Indonesian
 * convention, matching this app's locale — e.g. what Excel/Sheets commonly export as) to
 * ISO; anything else is returned unchanged but logged so it's at least visible in devtools
 * instead of fully silent.
 */
export function normalizeDate(raw: string): string {
  const s = raw.trim()
  if (ISO_DATE_RE.test(s)) return s
  const m = s.match(DMY_RE)
  if (m) {
    const day = Number(m[1]), month = Number(m[2]), year = Number(m[3])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  if (s) console.warn(`[csvParser] unrecognized date format, importing as-is: "${s}"`)
  return s
}

function parseCSV(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (r) => resolve(r.data as Record<string, string>[]),
      error: (e) => reject(e),
    })
  })
}

export async function parseGoogleAds(file: File): Promise<GoogleAdsRow[]> {
  const rows = await parseCSV(file)
  return rows.map(r => ({
    date: normalizeDate(r['Date'] || r['date'] || ''),
    campaign: r['Campaign'] || r['campaign'] || '',
    impressions: toNum(r['Impressions'] || r['impressions']),
    clicks: toNum(r['Clicks'] || r['clicks']),
    ctr: toNum(r['CTR'] || r['ctr']),
    cpc: toNum(r['Avg. CPC'] || r['CPC'] || r['cpc']),
    spend: toNum(r['Cost'] || r['Spend'] || r['spend'] || r['cost']),
    conversions: toNum(r['Conversions'] || r['conversions']),
    convRate: toNum(r['Conv. rate'] || r['Conv rate'] || r['conv_rate']),
    roas: toNum(r['Conv. value / cost'] || r['ROAS'] || r['roas']),
  }))
}

export async function parseMetaAds(file: File): Promise<MetaAdsRow[]> {
  const rows = await parseCSV(file)
  return rows.map(r => ({
    date: normalizeDate(r['Date'] || r['Reporting starts'] || r['date'] || ''),
    campaign: r['Campaign name'] || r['Campaign'] || r['campaign'] || '',
    reach: toNum(r['Reach'] || r['reach']),
    impressions: toNum(r['Impressions'] || r['impressions']),
    clicks: toNum(r['Link clicks'] || r['Clicks'] || r['clicks']),
    ctr: toNum(r['CTR (link click-through rate)'] || r['CTR'] || r['ctr']),
    spend: toNum(r['Amount spent (IDR)'] || r['Amount spent'] || r['Spend'] || r['spend']),
    purchases: toNum(r['Purchases'] || r['Conversions'] || r['purchases']),
    roas: toNum(r['Purchase ROAS (return on ad spend)'] || r['ROAS'] || r['roas']),
    cpm: toNum(r['CPM (cost per 1,000 impressions)'] || r['CPM'] || r['cpm']),
    results: toNum(r['Results'] || r['Leads'] || r['results'] || r['leads'] || r['Purchases'] || r['purchases']),
  }))
}

export async function parseTikTokShop(file: File): Promise<TikTokShopRow[]> {
  const rows = await parseCSV(file)
  return rows.map(r => ({
    date: normalizeDate(r['Date'] || r['date'] || ''),
    gmv: toNum(r['GMV'] || r['gmv']),
    orders: toNum(r['Orders'] || r['orders'] || r['Total orders']),
    unitsSold: toNum(r['Units sold'] || r['units_sold'] || r['Qty sold']),
    revenue: toNum(r['Revenue'] || r['revenue'] || r['Net revenue']),
    productViews: toNum(r['Product views'] || r['product_views'] || r['Views']),
    adSpent: toNum(r['Ad Spent'] || r['ad_spent'] || r['Ad Spend'] || r['ad_spend'] || r['Iklan']),
  }))
}

export async function parseInstagram(file: File): Promise<InstagramRow[]> {
  const rows = await parseCSV(file)
  return rows.map(r => ({
    date: normalizeDate(r['Date'] || r['date'] || ''),
    followers: toNum(r['Followers'] || r['followers'] || r['Total followers']),
    reach: toNum(r['Reach'] || r['reach']),
    impressions: toNum(r['Impressions'] || r['impressions']),
    profileVisits: toNum(r['Profile visits'] || r['profile_visits']),
    engagements: toNum(r['Post engagements'] || r['Engagements'] || r['engagements']),
  }))
}

export async function parseTikTokOrganic(file: File): Promise<TikTokOrganicRow[]> {
  const rows = await parseCSV(file)
  return rows.map(r => ({
    date: normalizeDate(r['Date'] || r['date'] || ''),
    followers: toNum(r['Followers'] || r['followers'] || r['Total followers']),
    views: toNum(r['Video views'] || r['Views'] || r['views']),
    likes: toNum(r['Likes'] || r['likes']),
    comments: toNum(r['Comments'] || r['comments']),
    shares: toNum(r['Shares'] || r['shares']),
  }))
}

// Parse product field yang mungkin berisi multi-produk
// Format: "1 AM-SS50" atau "1 AM-RT-15;1 AM-RNP-30;1 AM-DSP-10" (semicolon)
// atau "1 AM-RT-15,1 AM-RNP-30" (koma, hanya jika CSV sudah di-quote dengan benar)
// SKU pattern: huruf kapital, angka, dan strip (contoh: AM-SS50, AMPDRNS, TAS)
const SKU_RE = /^[A-Z0-9-]+$/

export function parseProductItems(raw: string): Array<{ product: string; qty: number }> {
  if (!raw) return [{ product: '', qty: 1 }]
  // Pilih separator: pakai semicolon kalau ada, fallback ke koma
  const sep = raw.includes(';') ? ';' : ','
  const parts = raw.split(sep).map(p => p.trim()).filter(Boolean)
  const result: Array<{ product: string; qty: number }> = []

  for (const part of parts) {
    // Match format "angka spasi nama_produk", contoh "2 AM-SS50" atau "1 AMPDRNS AMPDRNC"
    const m = part.match(/^(\d+)\s+(.+)$/)
    if (m) {
      const qty = parseInt(m[1], 10)
      const productStr = m[2].trim()
      // Cek apakah productStr adalah beberapa SKU dipisah spasi, contoh "AMPDRNS AMPDRNC"
      const subParts = productStr.split(' ').filter(Boolean)
      const allAreSKUs = subParts.length > 1 && subParts.every(s => SKU_RE.test(s))
      if (allAreSKUs) {
        // Pisah jadi baris terpisah, masing-masing qty 1
        subParts.forEach(sku => result.push({ qty: 1, product: sku }))
      } else {
        result.push({ qty, product: productStr })
      }
    } else {
      // Tanpa angka prefix — cek apakah space-separated SKUs, contoh "AMPDRNS AMPDRNC"
      const subParts = part.split(' ').filter(Boolean)
      const allAreSKUs = subParts.length > 1 && subParts.every(s => SKU_RE.test(s))
      if (allAreSKUs) {
        subParts.forEach(sku => result.push({ qty: 1, product: sku }))
      } else {
        result.push({ qty: 1, product: part })
      }
    }
  }

  return result.length > 0 ? result : [{ qty: 1, product: raw }]
}

// Pure mapping of one parsed CSV record → one or more SalesRows.
// Extracted from parseSales so the multi-product split + qty resolution can be
// unit-tested without constructing a File.
export function salesRowsFromRecord(r: Record<string, string>): SalesRow[] {
  const productRaw = r['Product'] || r['product'] || r['Produk'] || ''
  const totalRevenue = toNum(r['Revenue'] || r['revenue'] || r['Pendapatan'])

  // Distinguish a genuinely blank/absent Qty column (→ fall back to the qty
  // embedded in the product string) from an explicit 0 (which must be kept).
  const qtyRaw = r['Qty'] ?? r['qty'] ?? r['Quantity'] ?? r['quantity']
  const hasQtyCol = qtyRaw !== undefined && String(qtyRaw).trim() !== ''
  const totalQtyCol = toNum(qtyRaw)

  const baseRow = {
    date: normalizeDate(r['Date'] || r['date'] || ''),
    channel: r['Channel'] || r['channel'] || r['Kanal'] || '',
    cogs: toNum(r['COGS'] || r['cogs'] || r['HPP']),
    grossProfit: toNum(r['Gross Profit'] || r['gross_profit'] || r['Laba Kotor']),
    customerName: r['Customer Name'] || r['Nama Customer'] || r['nama_customer'] || '',
    phone: r['Phone'] || r['No HP'] || r['phone'] || r['no_hp'] || '',
    address: r['Address'] || r['Alamat'] || r['address'] || '',
    source: normalizeSalesSource(r['Source'] || r['source'] || r['Ad Source']),
  }

  const items = parseProductItems(productRaw)
  if (items.length <= 1) {
    // Single product — prefer the explicit Qty column (incl. 0) when present,
    // otherwise the qty parsed from the product string, otherwise 1.
    const qty = hasQtyCol ? totalQtyCol : (items[0]?.qty || 1)
    return [{ ...baseRow, product: items[0]?.product ?? productRaw, qty, revenue: totalRevenue }]
  }

  // Multi-product — split revenue proportionally by each item's qty. The last
  // item absorbs the rounding remainder so the per-row revenues sum exactly to
  // the record total.
  const totalItemQty = items.reduce((s, i) => s + i.qty, 0) || 1
  let remaining = totalRevenue
  return items.map((item, idx) => {
    const isLast = idx === items.length - 1
    const rev = isLast ? remaining : Math.round(totalRevenue * (item.qty / totalItemQty))
    if (!isLast) remaining -= rev
    return { ...baseRow, product: item.product, qty: item.qty, revenue: rev }
  })
}

export async function parseSales(file: File): Promise<SalesRow[]> {
  const rows = await parseCSV(file)
  return rows.flatMap(salesRowsFromRecord)
}

export async function parseShopee(file: File): Promise<ShopeeRow[]> {
  const rows = await parseCSV(file)
  return rows.map(r => ({
    date: normalizeDate(r['Date'] || r['date'] || ''),
    gmv: toNum(r['GMV'] || r['gmv']),
    orders: toNum(r['Orders'] || r['orders'] || r['Total orders']),
    unitsSold: toNum(r['Units sold'] || r['units_sold'] || r['Qty sold']),
    revenue: toNum(r['Revenue'] || r['revenue'] || r['Net revenue']),
    productViews: toNum(r['Product views'] || r['product_views'] || r['Views']),
    adSpend: toNum(r['Ad Spend'] || r['ad_spend'] || r['Ads Spend'] || r['Iklan']),
    adClicks: toNum(r['Ad Clicks'] || r['ad_clicks'] || r['Clicks']),
    adImpressions: toNum(r['Ad Impressions'] || r['ad_impressions'] || r['Impressions']),
  }))
}

export async function parseCRM(file: File): Promise<CRMRow[]> {
  const rows = await parseCSV(file)
  // CRM: satu baris = satu transaksi/order, TIDAK di-expand per produk
  // supaya Orders count di RFM akurat (per transaksi, bukan per SKU)
  return rows.map(r => {
    const productRaw = r['Product'] || r['Produk'] || r['product'] || ''
    // Bersihkan prefix qty dari nama produk, simpan sebagai satu string
    const items = parseProductItems(productRaw)
    const productLabel = items.map(i => i.product).join(', ')
    return {
      date: normalizeDate(r['Date'] || r['date'] || r['Tanggal'] || ''),
      customerName: r['Customer Name'] || r['Nama'] || r['nama'] || r['customer_name'] || '',
      phone: r['Phone'] || r['No HP'] || r['phone'] || r['no_hp'] || '',
      product: productLabel,
      qty: toNum(r['Qty'] || r['qty'] || r['Quantity'] || r['quantity']),
      revenue: toNum(r['Revenue'] || r['revenue'] || r['Harga'] || r['Total']),
    }
  })
}

export async function parseFacebookOrganic(file: File): Promise<FacebookOrganicRow[]> {
  const rows = await parseCSV(file)
  return rows.map(r => ({
    date: normalizeDate(r['Date'] || r['date'] || ''),
    reach: toNum(r['Reach'] || r['reach']),
    impressions: toNum(r['Impressions'] || r['impressions']),
    engagements: toNum(r['Engagements'] || r['engagements'] || r['Post engagements']),
  }))
}

export function parseFile(view: ActiveView, file: File) {
  switch (view) {
    case 'google-ads': return parseGoogleAds(file)
    case 'meta-ads': return parseMetaAds(file)
    case 'tiktok-shop': return parseTikTokShop(file)
    case 'shopee': return parseShopee(file)
    case 'instagram': return parseInstagram(file)
    case 'tiktok-organic': return parseTikTokOrganic(file)
    case 'facebook-organic': return parseFacebookOrganic(file)
    case 'sales': return parseSales(file)
    case 'crm': return parseCRM(file)
    default: throw new Error('Unknown view')
  }
}

export const CSV_TEMPLATES: Record<string, { name: string; headers: string[]; example: string[] }> = {
  'google-ads': {
    name: 'google_ads_template.csv',
    headers: ['Date', 'Campaign', 'Impressions', 'Clicks', 'CTR', 'Avg. CPC', 'Cost', 'Conversions', 'Conv. rate', 'ROAS'],
    example: ['2024-04-01', 'Brand Campaign', '10000', '350', '3.50', '2500', '875000', '42', '12.00', '3.5'],
  },
  'meta-ads': {
    name: 'meta_ads_template.csv',
    headers: ['Date', 'Campaign name', 'Reach', 'Impressions', 'Link clicks', 'CTR', 'Amount spent (IDR)', 'Purchases', 'Purchase ROAS (return on ad spend)', 'CPM (cost per 1,000 impressions)'],
    example: ['2024-04-01', 'Retargeting', '8000', '12000', '240', '2.00', '500000', '18', '3.2', '41667'],
  },
  'tiktok-shop': {
    name: 'tiktok_shop_template.csv',
    headers: ['Date', 'GMV', 'Orders', 'Units sold', 'Revenue', 'Product views', 'Ad Spent'],
    example: ['2024-04-01', '15000000', '75', '90', '14000000', '1800', '500000'],
  },
  instagram: {
    name: 'instagram_template.csv',
    headers: ['Date', 'Followers', 'Reach', 'Impressions', 'Profile visits', 'Post engagements'],
    example: ['2024-04-01', '25000', '8500', '12000', '420', '680'],
  },
  'tiktok-organic': {
    name: 'tiktok_organic_template.csv',
    headers: ['Date', 'Followers', 'Video views', 'Likes', 'Comments', 'Shares'],
    example: ['2024-04-01', '18000', '45000', '3200', '180', '95'],
  },
  'facebook-organic': {
    name: 'facebook_organic_template.csv',
    headers: ['Date', 'Reach', 'Impressions', 'Engagements'],
    example: ['2024-04-01', '12000', '18000', '850'],
  },
  sales: {
    name: 'sales_template.csv',
    headers: ['Date', 'Customer Name', 'Phone', 'Product', 'Qty', 'Revenue', 'Channel', 'Source'],
    example: ['2024-04-01', 'Siti Rahma', '081234567890', '1 AM-SS50;2 AM-NG-20', '3', '450000', 'WhatsApp', 'meta-ads'],
  },
  shopee: {
    name: 'shopee_template.csv',
    headers: ['Date', 'GMV', 'Orders', 'Units sold', 'Revenue', 'Product views', 'Ad Spend', 'Ad Clicks', 'Ad Impressions'],
    example: ['2024-04-01', '18000000', '90', '110', '17000000', '2370', '1500000', '3200', '85000'],
  },
  crm: {
    name: 'crm_template.csv',
    headers: ['Date', 'Customer Name', 'Phone', 'Product', 'Qty', 'Revenue'],
    example: ['2024-04-01', 'Siti Rahma', '081234567890', 'Serum Vitamin C', '2', '300000'],
  },
  'product-master': {
    name: 'product_master_template.csv',
    headers: ['SKU', 'Product Name', 'Price', 'COGS'],
    example: ['SVC-001', 'Serum Vitamin C', '150000', '60000'],
  },
}

export function downloadTemplate(view: string) {
  const tpl = CSV_TEMPLATES[view]
  if (!tpl) return
  const csv = tpl.headers.join(',') + '\n' + tpl.example.join(',')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = tpl.name; a.click()
  URL.revokeObjectURL(url)
}

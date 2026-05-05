'use client'
import { useState } from 'react'
import { SalesRow, Brand, Timeframe, ProductMaster, BundleMaster } from '@/lib/types'
import { filterByDays, fmtCurrency, fmtNum } from '@/lib/utils'
import CSVUploader from '@/components/CSVUploader'
import CSVValidationModal, { validateProductField, InvalidRow } from '@/components/CSVValidationModal'
import { parseSales } from '@/lib/csvParser'
import { DollarSign, Package, TrendingUp, ShoppingCart, Plus, X, Trash2 } from 'lucide-react'
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const BRAND_COLOR: Record<Brand, string> = { reglow: '#C9A96E', amura: '#8FB050' }
const chartStyle = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, padding: 20 }
const PIE_COLORS = ['#F07830', '#8B5CF6', '#00D4FF', '#10B981', '#F59E0B', '#E1306C']
const CHANNELS = ['TikTok Shop', 'Shopee', 'Tokopedia', 'Instagram DM', 'WhatsApp', 'Website', 'Offline', 'Lainnya']
const AD_SOURCES = [
  { value: 'organic', label: 'Organic / Direct', color: '#6B7280' },
  { value: 'google-ads', label: 'Google Ads', color: '#4285F4' },
  { value: 'meta-ads', label: 'Meta Ads', color: '#1877F2' },
  { value: 'tiktok-ads', label: 'TikTok Ads', color: '#FF0050' },
]

interface LineItem { product: string; sku: string; qty: string; price: string; cogs: string; selectValue: string }
interface Props {
  data: SalesRow[]
  brand: Brand
  timeframe: Timeframe
  onUpload: (file: File) => Promise<void>
  onBulkUpload?: (rows: SalesRow[]) => void
  products: ProductMaster[]
  bundles: BundleMaster[]
  onManualAdd?: (rows: SalesRow[]) => void
}

const EMPTY_LINE: LineItem = { product: '', sku: '', qty: '1', price: '', cogs: '', selectValue: '' }

export default function SalesView({ data, brand, timeframe, onUpload, onBulkUpload, products, bundles, onManualAdd }: Props) {
  const accent = BRAND_COLOR[brand]
  const filtered = filterByDays(data, timeframe)
  const brandProducts = products.filter(p => p.brand === brand)
  const brandBundles = bundles.filter(b => b.brand === brand)

  const [modal, setModal] = useState(false)
  const [validationModal, setValidationModal] = useState<{
    validRows: SalesRow[]
    invalidRows: InvalidRow[]
  } | null>(null)

  async function handleCSVFile(file: File) {
    if (brandProducts.length === 0) { await onUpload(file); return }
    const rows = await parseSales(file)
    const validRows: SalesRow[] = []
    const invalidRows: InvalidRow[] = []
    rows.forEach((row, i) => {
      if (validateProductField(row.product, brandProducts, brandBundles)) {
        validRows.push(row)
      } else {
        invalidRows.push({ rowIndex: i + 1, date: row.date, product: row.product })
      }
    })
    setValidationModal({ validRows, invalidRows })
  }
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [channel, setChannel] = useState(CHANNELS[0])
  const [source, setSource] = useState('organic')
  const [lines, setLines] = useState<LineItem[]>([{ ...EMPTY_LINE }])

  function handleProductSelect(idx: number, value: string) {
    if (!value) {
      setLines(prev => prev.map((l, i) => i === idx ? { ...EMPTY_LINE } : l))
      return
    }
    if (value.startsWith('bundle:')) {
      const bundleId = value.replace('bundle:', '')
      const b = brandBundles.find(b => b.id === bundleId)
      if (!b) return
      setLines(prev => prev.map((l, i) => i === idx
        ? { ...l, selectValue: value, sku: '', product: b.name, price: String(b.price), cogs: String(b.cogs) }
        : l))
    } else {
      const pm = brandProducts.find(p => p.sku === value)
      if (!pm) return
      setLines(prev => prev.map((l, i) => i === idx
        ? { ...l, selectValue: value, sku: pm.sku, product: pm.name, price: String(pm.price), cogs: String(pm.cogs) }
        : l))
    }
  }

  function addLine() { setLines(prev => [...prev, { ...EMPTY_LINE }]) }
  function removeLine(idx: number) { setLines(prev => prev.filter((_, i) => i !== idx)) }
  function updateLine(idx: number, key: keyof LineItem, val: string) {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [key]: val } : l))
  }

  function handleSave() {
    const rows: SalesRow[] = lines
      .filter(l => l.product && Number(l.qty) > 0)
      .map(l => {
        const qty = Number(l.qty) || 0
        const price = Number(l.price) || 0
        const cogs = Number(l.cogs) || 0
        return {
          date, product: l.product, qty,
          revenue: price * qty,
          channel,
          cogs: cogs * qty,
          grossProfit: (price - cogs) * qty,
          customerName, phone, address,
          source,
        }
      })
    if (rows.length === 0) return
    onManualAdd?.(rows)
    setModal(false)
    setLines([{ ...EMPTY_LINE }])

    setCustomerName(''); setPhone(''); setAddress('')
    setSource('organic')
  }

  const totalRevenue = filtered.reduce((s, r) => s + r.revenue, 0)
  const totalQty = filtered.reduce((s, r) => s + r.qty, 0)
  const totalProfit = filtered.reduce((s, r) => s + r.grossProfit, 0)
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  const productMap: Record<string, { qty: number; revenue: number }> = {}
  filtered.forEach(r => {
    if (!productMap[r.product]) productMap[r.product] = { qty: 0, revenue: 0 }
    productMap[r.product].qty += r.qty
    productMap[r.product].revenue += r.revenue
  })
  const topProducts = Object.entries(productMap).map(([product, v]) => ({ product, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 5)

  const channelMap: Record<string, number> = {}
  filtered.forEach(r => { channelMap[r.channel] = (channelMap[r.channel] || 0) + r.revenue })
  const channelData = Object.entries(channelMap).map(([name, value]) => ({ name, value }))

  const dateMap: Record<string, { revenue: number; profit: number }> = {}
  filtered.forEach(r => {
    if (!dateMap[r.date]) dateMap[r.date] = { revenue: 0, profit: 0 }
    dateMap[r.date].revenue += r.revenue
    dateMap[r.date].profit += r.grossProfit
  })
  const trendData = Object.entries(dateMap).sort(([a], [b]) => a.localeCompare(b)).slice(-30).map(([date, v]) => ({ date, Revenue: v.revenue, Profit: v.profit }))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#4B5563' }}>Sales Data</span>
          </div>
          <p className="text-sm" style={{ color: '#4B5563' }}>{filtered.length > 0 ? `${filtered.length} transaksi` : 'Upload CSV atau input manual'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all flex-shrink-0"
            style={{ background: `rgba(${({'reglow':'201,169,110','amura':'143,176,80','purela':'155,127,212'})[brand]},0.15)`, border: `1px solid rgba(${({'reglow':'201,169,110','amura':'143,176,80','purela':'155,127,212'})[brand]},0.3)`, color: accent }}>
            <Plus size={14} /> Input Manual
          </button>
          <div className="w-56 flex-shrink-0">
            <CSVUploader platform="sales" hasData={data.length > 0} onUpload={handleCSVFile} accent={accent} />
          </div>
        </div>
      </div>

      {filtered.length > 0 ? (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <MetricCard label="Total Revenue" value={fmtCurrency(totalRevenue)} icon={<DollarSign size={14} />} accent={accent} />
            <MetricCard label="Gross Profit" value={fmtCurrency(totalProfit)} icon={<TrendingUp size={14} />} accent="#10B981" />
            <MetricCard label="Units Sold" value={fmtNum(totalQty)} icon={<Package size={14} />} accent="#8B5CF6" />
            <MetricCard label="Profit Margin" value={margin.toFixed(1) + '%'} icon={<ShoppingCart size={14} />} accent="#00D4FF" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div style={chartStyle}>
              <p className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: '#6B7280' }}>Top 5 Produk (Revenue)</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <YAxis type="category" dataKey="product" tick={{ fontSize: 9, fill: '#9CA3AF' }} width={90} />
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, color: '#111827', fontSize: 11 }} />
                  <Bar dataKey="revenue" fill={accent} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={chartStyle}>
              <p className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: '#6B7280' }}>Revenue per Channel</p>
              {channelData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={channelData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                      {channelData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, color: '#111827', fontSize: 11 }}
                      formatter={(v) => fmtCurrency(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-40" style={{ color: '#374151' }}>Tidak ada data channel</div>}
            </div>
          </div>
          {trendData.length > 0 && (
            <div style={chartStyle}>
              <p className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: '#6B7280' }}>Revenue & Profit Trend</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#4B5563' }} />
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, color: '#111827', fontSize: 11 }}
                    formatter={(v) => fmtCurrency(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 10, color: '#6B7280' }} />
                  <Line type="monotone" dataKey="Revenue" stroke={accent} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Profit" stroke="#10B981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: `${accent}15`, border: `1px solid ${accent}30`, boxShadow: `0 0 30px ${accent}15` }}>
            <DollarSign size={28} style={{ color: accent }} />
          </div>
          <p className="font-semibold mb-1" style={{ color: '#6B7280' }}>Belum ada data sales</p>
          <p className="text-sm" style={{ color: '#374151' }}>Upload CSV atau klik "+ Input Manual" di atas</p>
        </div>
      )}

      {/* Manual Input Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
              <div>
                <p className="font-semibold" style={{ color: '#111827' }}>Input Manual — Acquisition by CS</p>
                <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Tambah transaksi baru</p>
              </div>
              <button onClick={() => setModal(false)} style={{ color: '#6B7280' }}><X size={18} /></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Tanggal + Channel */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tanggal">
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-dark" />
                </Field>
                <Field label="Channel">
                  <select value={channel} onChange={e => setChannel(e.target.value)} className="input-dark">
                    {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>

              {/* Ad Source */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest block mb-2" style={{ color: '#4B5563' }}>
                  Sumber Iklan (Ad Source)
                </label>
                <div className="flex gap-2 flex-wrap">
                  {AD_SOURCES.map(s => (
                    <button key={s.value} type="button" onClick={() => setSource(s.value)}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                      style={source === s.value
                        ? { background: s.color, color: '#fff', border: `1px solid ${s.color}` }
                        : { background: '#F9FAFB', color: '#6B7280', border: '1px solid #E5E7EB' }
                      }>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer info */}
              <div className="grid grid-cols-3 gap-4">
                <Field label="Nama Customer">
                  <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Siti Rahma" className="input-dark" />
                </Field>
                <Field label="No. HP">
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="081234567890" className="input-dark" />
                </Field>
                <Field label="Alamat">
                  <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Jl. Sudirman..." className="input-dark" />
                </Field>
              </div>

              {/* Product lines */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#6B7280' }}>Produk</p>
                  <button onClick={addLine} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                    style={{ background: `rgba(${({'reglow':'201,169,110','amura':'143,176,80','purela':'155,127,212'})[brand]},0.1)`, color: accent }}>
                    <Plus size={11} /> Tambah Baris
                  </button>
                </div>
                <div className="space-y-3">
                  {lines.map((line, idx) => (
                    <div key={idx} className="grid gap-2 items-end" style={{ gridTemplateColumns: '2fr 80px 120px 120px 32px' }}>
                      <div>
                        {idx === 0 && <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: '#4B5563' }}>Produk</label>}
                        <select value={line.selectValue} onChange={e => handleProductSelect(idx, e.target.value)}
                          disabled={brandProducts.length === 0 && brandBundles.length === 0}
                          className="input-dark"
                          style={{ color: (brandProducts.length === 0 && brandBundles.length === 0) ? '#9CA3AF' : undefined, cursor: (brandProducts.length === 0 && brandBundles.length === 0) ? 'not-allowed' : 'pointer' }}>
                          <option value="">{(brandProducts.length === 0 && brandBundles.length === 0) ? '— Isi Product Master dulu —' : '— Pilih produk —'}</option>
                          {brandProducts.length > 0 && (
                            <optgroup label="── Individual ──">
                              {brandProducts.map(p => <option key={p.sku} value={p.sku}>{p.name}</option>)}
                            </optgroup>
                          )}
                          {brandBundles.length > 0 && (
                            <optgroup label="── Bundle ──">
                              {brandBundles.map(b => <option key={b.id} value={`bundle:${b.id}`}>📦 {b.name}</option>)}
                            </optgroup>
                          )}
                        </select>
                      </div>
                      <div>
                        {idx === 0 && <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: '#4B5563' }}>Qty</label>}
                        <input type="number" min="1" value={line.qty} onChange={e => updateLine(idx, 'qty', e.target.value)} className="input-dark" />
                      </div>
                      <div>
                        {idx === 0 && <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: '#4B5563' }}>Harga Jual</label>}
                        <input type="number" value={line.price} onChange={e => updateLine(idx, 'price', e.target.value)}
                          placeholder={brandProducts.length > 0 ? 'Auto' : '150000'} className="input-dark"
                          readOnly={!!line.selectValue} style={{ opacity: line.selectValue ? 0.6 : 1 }} />
                      </div>
                      <div>
                        {idx === 0 && <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: '#4B5563' }}>COGS</label>}
                        <input type="number" value={line.cogs} onChange={e => updateLine(idx, 'cogs', e.target.value)}
                          placeholder={brandProducts.length > 0 ? 'Auto' : '60000'} className="input-dark"
                          readOnly={!!line.selectValue} style={{ opacity: line.selectValue ? 0.6 : 1 }} />
                      </div>
                      <button onClick={() => removeLine(idx)} disabled={lines.length === 1}
                        className="pb-0.5" style={{ color: lines.length === 1 ? '#374151' : '#6B7280' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Total preview */}
                {lines.some(l => l.price && l.qty) && (
                  <div className="mt-3 p-3 rounded-xl flex gap-6 text-xs" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                    {(() => {
                      const rev = lines.reduce((s, l) => s + (Number(l.price) || 0) * (Number(l.qty) || 0), 0)
                      const cogs = lines.reduce((s, l) => s + (Number(l.cogs) || 0) * (Number(l.qty) || 0), 0)
                      const gp = rev - cogs
                      return <>
                        <span style={{ color: '#9CA3AF' }}>Revenue: <strong style={{ color: '#111827' }}>{fmtCurrency(rev)}</strong></span>
                        <span style={{ color: '#9CA3AF' }}>COGS: <strong style={{ color: '#111827' }}>{fmtCurrency(cogs)}</strong></span>
                        <span style={{ color: '#9CA3AF' }}>Gross Profit: <strong style={{ color: '#10B981' }}>{fmtCurrency(gp)}</strong></span>
                        {rev > 0 && <span style={{ color: '#9CA3AF' }}>Margin: <strong style={{ color: gp / rev >= 0.3 ? '#10B981' : '#F59E0B' }}>{((gp / rev) * 100).toFixed(1)}%</strong></span>}
                      </>
                    })()}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#9CA3AF' }}>
                  Batal
                </button>
                <button onClick={handleSave} className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: `rgba(${({'reglow':'201,169,110','amura':'143,176,80','purela':'155,127,212'})[brand]},0.2)`, border: `1px solid rgba(${({'reglow':'201,169,110','amura':'143,176,80','purela':'155,127,212'})[brand]},0.4)`, color: accent }}>
                  Simpan Transaksi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .input-dark {
          width: 100%;
          padding: 8px 12px;
          border-radius: 10px;
          font-size: 13px;
          outline: none;
          background: #F9FAFB;
          border: 1px solid #E5E7EB;
          color: #111827;
          transition: border-color 0.15s;
        }
        .input-dark:focus { border-color: #D1D5DB; }
        .input-dark option { background: #FFFFFF; color: #111827; }
      `}</style>

      {validationModal && (
        <CSVValidationModal
          title="CS Sales"
          brand={brand}
          validCount={validationModal.validRows.length}
          invalidRows={validationModal.invalidRows}
          onConfirm={() => {
            onBulkUpload?.(validationModal.validRows)
            setValidationModal(null)
          }}
          onClose={() => setValidationModal(null)}
        />
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: '#4B5563' }}>{label}</label>
      {children}
    </div>
  )
}

function MetricCard({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent: string }) {
  const r = parseInt(accent.slice(1, 3), 16) || 240
  const g = parseInt(accent.slice(3, 5), 16) || 120
  const b = parseInt(accent.slice(5, 7), 16) || 48
  return (
    <div className="rounded-2xl p-4 relative overflow-hidden"
      style={{ background: `rgba(${r},${g},${b},0.05)`, border: `1px solid rgba(${r},${g},${b},0.15)` }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#6B7280' }}>{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `rgba(${r},${g},${b},0.15)`, color: accent }}>{icon}</div>
      </div>
      <p className="text-xl font-bold" style={{ color: '#111827' }}>{value}</p>
    </div>
  )
}

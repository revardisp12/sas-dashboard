'use client'
import { useState, useRef } from 'react'
import { Brand, ProductMaster, BundleMaster, BundleComponent } from '@/lib/types'
import { saveProducts } from '@/lib/storage'
import { downloadTemplate } from '@/lib/csvParser'
import { Package, Plus, Trash2, Edit2, Check, X, Upload, Zap, ChevronRight, Layers } from 'lucide-react'
import Papa from 'papaparse'

const BRAND_COLOR = { reglow: '#C9A96E', amura: '#8FB050' }
const BRAND_RGB = { reglow: '201,169,110', amura: '143,176,80' }

interface Props {
  brand: Brand
  products: ProductMaster[]
  onProductsChange: (products: ProductMaster[]) => void
  bundles: BundleMaster[]
  onBundlesChange: (bundles: BundleMaster[]) => void
}

const EMPTY_FORM = { sku: '', name: '', price: '', cogs: '' }
const EMPTY_BUNDLE_FORM = { name: '', price: '', components: [{ sku: '', qty: '1' }] }

function toNum(v: string) { return parseFloat(v.replace(/[^0-9.]/g, '')) || 0 }
function fmtRp(n: number) { return 'Rp ' + n.toLocaleString('id-ID') }

export default function SettingsView({ brand, products, onProductsChange, bundles, onBundlesChange }: Props) {
  const [tab, setTab] = useState<'product-master' | 'bundle-master' | 'api'>('product-master')

  // Product Master state
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Bundle Master state
  const [bundleForm, setBundleForm] = useState<{ name: string; price: string; components: { sku: string; qty: string }[] }>(EMPTY_BUNDLE_FORM)
  const [editBundleId, setEditBundleId] = useState<string | null>(null)
  const [editBundleForm, setEditBundleForm] = useState<{ name: string; price: string; components: { sku: string; qty: string }[] }>(EMPTY_BUNDLE_FORM)
  const [deleteBundleId, setDeleteBundleId] = useState<string | null>(null)

  const color = BRAND_COLOR[brand]
  const rgb = BRAND_RGB[brand]
  const brandProducts = products.filter(p => p.brand === brand)
  const brandBundles = bundles.filter(b => b.brand === brand)

  // ── Product Master helpers ────────────────────────────────────────────────

  function saveP(updated: ProductMaster[]) { onProductsChange(updated); saveProducts(updated) }

  function addProduct() {
    const price = toNum(form.price)
    const cogs = toNum(form.cogs)
    if (!form.sku.trim() || !form.name.trim() || !price) return
    saveP([...products, {
      id: Date.now().toString(),
      sku: form.sku.trim(), name: form.name.trim(),
      price, cogs, margin: price > 0 ? Math.round(((price - cogs) / price) * 100) : 0,
      brand,
    }])
    setForm(EMPTY_FORM)
  }

  function startEdit(p: ProductMaster) {
    setEditId(p.id)
    setEditForm({ sku: p.sku, name: p.name, price: String(p.price), cogs: String(p.cogs) })
  }

  function confirmEdit() {
    if (!editId) return
    const price = toNum(editForm.price)
    const cogs = toNum(editForm.cogs)
    saveP(products.map(p => p.id === editId
      ? { ...p, sku: editForm.sku.trim(), name: editForm.name.trim(), price, cogs, margin: price > 0 ? Math.round(((price - cogs) / price) * 100) : 0 }
      : p
    ))
    setEditId(null)
  }

  function deleteProduct(id: string) {
    if (deleteId !== id) { setDeleteId(id); setTimeout(() => setDeleteId(null), 3000); return }
    saveP(products.filter(p => p.id !== id))
    setDeleteId(null)
  }

  function handleCSV(file: File) {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data as Record<string, string>[]
        const imported: ProductMaster[] = rows.map(r => {
          const price = toNum(r['Price'] || r['Harga Jual'] || r['price'] || '0')
          const cogs = toNum(r['COGS'] || r['HPP'] || r['cogs'] || '0')
          return {
            id: Date.now().toString() + Math.random(),
            sku: r['SKU'] || r['sku'] || '',
            name: r['Product Name'] || r['Nama Produk'] || r['name'] || '',
            price, cogs,
            margin: price > 0 ? Math.round(((price - cogs) / price) * 100) : 0,
            brand,
          }
        }).filter(p => p.sku && p.name)
        const existingIds = new Set(products.filter(p => p.brand === brand).map(p => p.sku))
        const newOnes = imported.filter(p => !existingIds.has(p.sku))
        saveP([...products, ...newOnes])
        if (fileRef.current) fileRef.current.value = ''
      },
    })
  }

  // ── Bundle Master helpers ────────────────────────────────────────────────

  function saveB(updated: BundleMaster[]) { onBundlesChange(updated) }

  function calcBundleCogs(components: { sku: string; qty: string }[]): number {
    return components.reduce((sum, c) => {
      const p = brandProducts.find(p => p.sku === c.sku)
      return sum + (p ? p.cogs * (parseInt(c.qty) || 0) : 0)
    }, 0)
  }

  function addBundle() {
    if (!bundleForm.name.trim() || !toNum(bundleForm.price)) return
    const validComponents = bundleForm.components.filter(c => c.sku && parseInt(c.qty) > 0)
    if (validComponents.length === 0) return
    const price = toNum(bundleForm.price)
    const cogs = calcBundleCogs(validComponents)
    saveB([...bundles, {
      id: Date.now().toString(),
      name: bundleForm.name.trim(),
      components: validComponents.map(c => ({ sku: c.sku, qty: parseInt(c.qty) })) as BundleComponent[],
      price, cogs,
      margin: price > 0 ? Math.round(((price - cogs) / price) * 100) : 0,
      brand,
    }])
    setBundleForm(EMPTY_BUNDLE_FORM)
  }

  function startEditBundle(b: BundleMaster) {
    setEditBundleId(b.id)
    setEditBundleForm({
      name: b.name,
      price: String(b.price),
      components: b.components.map(c => ({ sku: c.sku, qty: String(c.qty) })),
    })
  }

  function confirmEditBundle() {
    if (!editBundleId) return
    const price = toNum(editBundleForm.price)
    const validComponents = editBundleForm.components.filter(c => c.sku && parseInt(c.qty) > 0)
    const cogs = calcBundleCogs(validComponents)
    saveB(bundles.map(b => b.id === editBundleId
      ? { ...b, name: editBundleForm.name.trim(), price, cogs, margin: price > 0 ? Math.round(((price - cogs) / price) * 100) : 0, components: validComponents.map(c => ({ sku: c.sku, qty: parseInt(c.qty) })) as BundleComponent[] }
      : b
    ))
    setEditBundleId(null)
  }

  function deleteBundle(id: string) {
    if (deleteBundleId !== id) { setDeleteBundleId(id); setTimeout(() => setDeleteBundleId(null), 3000); return }
    saveB(bundles.filter(b => b.id !== id))
    setDeleteBundleId(null)
  }

  function updateBundleComponent(idx: number, key: 'sku' | 'qty', val: string, isEdit = false) {
    if (isEdit) {
      setEditBundleForm(f => ({ ...f, components: f.components.map((c, i) => i === idx ? { ...c, [key]: val } : c) }))
    } else {
      setBundleForm(f => ({ ...f, components: f.components.map((c, i) => i === idx ? { ...c, [key]: val } : c) }))
    }
  }

  function addBundleComponent(isEdit = false) {
    if (isEdit) {
      setEditBundleForm(f => ({ ...f, components: [...f.components, { sku: '', qty: '1' }] }))
    } else {
      setBundleForm(f => ({ ...f, components: [...f.components, { sku: '', qty: '1' }] }))
    }
  }

  function removeBundleComponent(idx: number, isEdit = false) {
    if (isEdit) {
      setEditBundleForm(f => ({ ...f, components: f.components.filter((_, i) => i !== idx) }))
    } else {
      setBundleForm(f => ({ ...f, components: f.components.filter((_, i) => i !== idx) }))
    }
  }

  const marginColor = (m: number) => m >= 50 ? '#10B981' : m >= 30 ? '#F59E0B' : '#EF4444'

  const BundleComponentForm = ({ components, isEdit }: { components: { sku: string; qty: string }[]; isEdit: boolean }) => (
    <div className="space-y-2">
      {components.map((c, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <select
            value={c.sku}
            onChange={e => updateBundleComponent(idx, 'sku', e.target.value, isEdit)}
            className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: c.sku ? '#111827' : '#9CA3AF' }}>
            <option value="">— Pilih produk —</option>
            {brandProducts.map(p => <option key={p.sku} value={p.sku}>{p.sku} — {p.name}</option>)}
          </select>
          <input
            type="number" min="1" value={c.qty}
            onChange={e => updateBundleComponent(idx, 'qty', e.target.value, isEdit)}
            className="w-16 px-2 py-2 rounded-xl text-sm text-center outline-none"
            style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
          <button
            onClick={() => removeBundleComponent(idx, isEdit)}
            disabled={components.length === 1}
            style={{ color: components.length === 1 ? '#D1D5DB' : '#9CA3AF' }}>
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={() => addBundleComponent(isEdit)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
        style={{ background: `rgba(${rgb},0.1)`, color }}>
        <Plus size={11} /> Tambah Produk
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex gap-2 flex-wrap">
        {([
          ['product-master', Package, 'Product Master'],
          ['bundle-master', Layers, 'Bundle Master'],
          ['api', Zap, 'API Integration'],
        ] as const).map(([id, Icon, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: tab === id ? `rgba(${rgb},0.15)` : '#F9FAFB',
              border: `1px solid ${tab === id ? `rgba(${rgb},0.3)` : '#E5E7EB'}`,
              color: tab === id ? color : '#6B7280',
            }}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── PRODUCT MASTER ── */}
      {tab === 'product-master' && (
        <div className="space-y-5">
          <div className="rounded-2xl p-5 space-y-4" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
            <p className="text-sm font-semibold" style={{ color: '#111827' }}>Tambah Produk</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: '#6B7280' }}>SKU</label>
                <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                  placeholder="e.g. SVC-001"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: '#6B7280' }}>Nama Produk</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Serum Vitamin C"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: '#6B7280' }}>Harga Jual (Rp)</label>
                <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="150000"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: '#6B7280' }}>COGS / HPP (Rp)</label>
                <input value={form.cogs} onChange={e => setForm(f => ({ ...f, cogs: e.target.value }))}
                  placeholder="60000"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
              </div>
            </div>
            {form.price && form.cogs && (
              <div className="flex items-center gap-2 text-xs" style={{ color: '#9CA3AF' }}>
                <span>Margin preview:</span>
                <span className="font-bold" style={{ color: marginColor(toNum(form.price) > 0 ? Math.round(((toNum(form.price) - toNum(form.cogs)) / toNum(form.price)) * 100) : 0) }}>
                  {toNum(form.price) > 0 ? Math.round(((toNum(form.price) - toNum(form.cogs)) / toNum(form.price)) * 100) + '%' : '—'}
                </span>
                <span>• Gross Profit: {toNum(form.price) > 0 ? fmtRp(toNum(form.price) - toNum(form.cogs)) : '—'}</span>
              </div>
            )}
            <div className="flex gap-3 flex-wrap">
              <button onClick={addProduct}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{ background: `rgba(${rgb},0.15)`, border: `1px solid rgba(${rgb},0.3)`, color }}>
                <Plus size={14} /> Tambah Produk
              </button>
              <button onClick={() => downloadTemplate('product-master')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#9CA3AF' }}>
                Download Template CSV
              </button>
              <label className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all"
                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#9CA3AF' }}>
                <Upload size={14} /> Bulk Import CSV
                <input ref={fileRef} type="file" accept=".csv" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleCSV(e.target.files[0]) }} />
              </label>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
            <div className="px-5 py-3 grid text-[10px] font-semibold uppercase tracking-widest"
              style={{ gridTemplateColumns: '100px 1fr 120px 120px 80px 80px', color: '#4B5563', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              <span>SKU</span><span>Nama Produk</span><span>Harga Jual</span><span>COGS</span><span>Margin</span><span></span>
            </div>
            {brandProducts.length === 0 ? (
              <div className="py-16 text-center">
                <Package size={32} className="mx-auto mb-3 opacity-20" style={{ color: '#6B7280' }} />
                <p className="text-sm" style={{ color: '#4B5563' }}>Belum ada produk. Tambahkan di atas atau import CSV.</p>
              </div>
            ) : brandProducts.map((p, i) => (
              <div key={p.id} className="px-5 py-3.5 grid items-center"
                style={{ gridTemplateColumns: '100px 1fr 120px 120px 80px 80px', borderBottom: i < brandProducts.length - 1 ? '1px solid #F3F4F6' : 'none', background: editId === p.id ? '#F9FAFB' : 'transparent' }}>
                {editId === p.id ? (
                  <>
                    <input value={editForm.sku} onChange={e => setEditForm(f => ({ ...f, sku: e.target.value }))}
                      className="px-2 py-1 rounded-lg text-xs mr-2 outline-none"
                      style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
                    <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className="px-2 py-1 rounded-lg text-xs mr-2 outline-none"
                      style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
                    <input value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                      className="px-2 py-1 rounded-lg text-xs mr-2 outline-none"
                      style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
                    <input value={editForm.cogs} onChange={e => setEditForm(f => ({ ...f, cogs: e.target.value }))}
                      className="px-2 py-1 rounded-lg text-xs mr-2 outline-none"
                      style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
                    <span className="text-xs font-bold" style={{ color: marginColor(toNum(editForm.price) > 0 ? Math.round(((toNum(editForm.price) - toNum(editForm.cogs)) / toNum(editForm.price)) * 100) : 0) }}>
                      {toNum(editForm.price) > 0 ? Math.round(((toNum(editForm.price) - toNum(editForm.cogs)) / toNum(editForm.price)) * 100) + '%' : '—'}
                    </span>
                    <div className="flex gap-1.5 justify-end">
                      <button onClick={confirmEdit} className="p-1.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}><Check size={12} /></button>
                      <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg" style={{ background: 'rgba(107,114,128,0.1)', color: '#6B7280' }}><X size={12} /></button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-mono" style={{ color: '#9CA3AF' }}>{p.sku}</span>
                    <span className="text-sm font-medium" style={{ color: '#111827' }}>{p.name}</span>
                    <span className="text-sm" style={{ color: '#9CA3AF' }}>{fmtRp(p.price)}</span>
                    <span className="text-sm" style={{ color: '#9CA3AF' }}>{fmtRp(p.cogs)}</span>
                    <span className="text-sm font-bold" style={{ color: marginColor(p.margin) }}>{p.margin}%</span>
                    <div className="flex gap-1.5 justify-end">
                      <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg" style={{ background: '#F9FAFB', color: '#6B7280' }}><Edit2 size={12} /></button>
                      <button onClick={() => deleteProduct(p.id)} className="p-1.5 rounded-lg"
                        style={{ background: deleteId === p.id ? 'rgba(239,68,68,0.15)' : '#F9FAFB', color: deleteId === p.id ? '#F87171' : '#6B7280' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          {brandProducts.length > 0 && (
            <p className="text-xs" style={{ color: '#374151' }}>{brandProducts.length} produk terdaftar untuk {brand === 'reglow' ? 'Reglow Skincare' : 'Amura'}</p>
          )}
        </div>
      )}

      {/* ── BUNDLE MASTER ── */}
      {tab === 'bundle-master' && (
        <div className="space-y-5">
          {brandProducts.length === 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#D97706' }}>
              <span>⚠️</span>
              <span>Tambah produk di tab <strong>Product Master</strong> dulu sebelum membuat bundle.</span>
            </div>
          )}

          {/* Add bundle form */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
            <p className="text-sm font-semibold" style={{ color: '#111827' }}>Tambah Bundle</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: '#6B7280' }}>Nama Bundle</label>
                <input value={bundleForm.name} onChange={e => setBundleForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Amura Starter Kit"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: '#6B7280' }}>Harga Bundle (Rp)</label>
                <input value={bundleForm.price} onChange={e => setBundleForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="150000"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider block mb-2" style={{ color: '#6B7280' }}>Komponen Produk</label>
              <BundleComponentForm components={bundleForm.components} isEdit={false} />
            </div>

            {/* Preview COGS & Margin */}
            {(() => {
              const cogs = calcBundleCogs(bundleForm.components)
              const price = toNum(bundleForm.price)
              const margin = price > 0 ? Math.round(((price - cogs) / price) * 100) : 0
              return cogs > 0 || price > 0 ? (
                <div className="flex items-center gap-4 text-xs" style={{ color: '#9CA3AF' }}>
                  <span>COGS auto: <strong style={{ color: '#111827' }}>{fmtRp(cogs)}</strong></span>
                  {price > 0 && <span>Margin: <strong style={{ color: marginColor(margin) }}>{margin}%</strong></span>}
                  {price > 0 && cogs > 0 && <span>Gross Profit: <strong style={{ color: '#10B981' }}>{fmtRp(price - cogs)}</strong></span>}
                </div>
              ) : null
            })()}

            <button onClick={addBundle}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ background: `rgba(${rgb},0.15)`, border: `1px solid rgba(${rgb},0.3)`, color }}>
              <Plus size={14} /> Tambah Bundle
            </button>
          </div>

          {/* Bundle list */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
            <div className="px-5 py-3 grid text-[10px] font-semibold uppercase tracking-widest"
              style={{ gridTemplateColumns: '1fr 120px 120px 80px 80px', color: '#4B5563', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              <span>Nama Bundle</span><span>Harga</span><span>COGS</span><span>Margin</span><span></span>
            </div>
            {brandBundles.length === 0 ? (
              <div className="py-16 text-center">
                <Layers size={32} className="mx-auto mb-3 opacity-20" style={{ color: '#6B7280' }} />
                <p className="text-sm" style={{ color: '#4B5563' }}>Belum ada bundle. Tambahkan bundle resmi di atas.</p>
              </div>
            ) : brandBundles.map((b, i) => (
              <div key={b.id}>
                <div className="px-5 py-3.5 grid items-center"
                  style={{ gridTemplateColumns: '1fr 120px 120px 80px 80px', borderBottom: '1px solid #F3F4F6', background: editBundleId === b.id ? '#F9FAFB' : 'transparent' }}>
                  {editBundleId === b.id ? (
                    <>
                      <input value={editBundleForm.name} onChange={e => setEditBundleForm(f => ({ ...f, name: e.target.value }))}
                        className="px-2 py-1 rounded-lg text-sm mr-2 outline-none"
                        style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
                      <input value={editBundleForm.price} onChange={e => setEditBundleForm(f => ({ ...f, price: e.target.value }))}
                        className="px-2 py-1 rounded-lg text-xs mr-2 outline-none"
                        style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>{fmtRp(calcBundleCogs(editBundleForm.components))}</span>
                      <span className="text-xs font-bold" style={{ color: marginColor(toNum(editBundleForm.price) > 0 ? Math.round(((toNum(editBundleForm.price) - calcBundleCogs(editBundleForm.components)) / toNum(editBundleForm.price)) * 100) : 0) }}>
                        {toNum(editBundleForm.price) > 0 ? Math.round(((toNum(editBundleForm.price) - calcBundleCogs(editBundleForm.components)) / toNum(editBundleForm.price)) * 100) + '%' : '—'}
                      </span>
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={confirmEditBundle} className="p-1.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}><Check size={12} /></button>
                        <button onClick={() => setEditBundleId(null)} className="p-1.5 rounded-lg" style={{ background: 'rgba(107,114,128,0.1)', color: '#6B7280' }}><X size={12} /></button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="text-sm font-medium" style={{ color: '#111827' }}>📦 {b.name}</span>
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#6B7280' }}>{b.components.length} produk</span>
                      </div>
                      <span className="text-sm" style={{ color: '#9CA3AF' }}>{fmtRp(b.price)}</span>
                      <span className="text-sm" style={{ color: '#9CA3AF' }}>{fmtRp(b.cogs)}</span>
                      <span className="text-sm font-bold" style={{ color: marginColor(b.margin) }}>{b.margin}%</span>
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => startEditBundle(b)} className="p-1.5 rounded-lg" style={{ background: '#F9FAFB', color: '#6B7280' }}><Edit2 size={12} /></button>
                        <button onClick={() => deleteBundle(b.id)} className="p-1.5 rounded-lg"
                          style={{ background: deleteBundleId === b.id ? 'rgba(239,68,68,0.15)' : '#F9FAFB', color: deleteBundleId === b.id ? '#F87171' : '#6B7280' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
                {/* Component detail rows */}
                {editBundleId === b.id ? (
                  <div className="px-5 pb-4" style={{ background: '#F9FAFB', borderBottom: i < brandBundles.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#6B7280' }}>Edit Komponen</p>
                    <BundleComponentForm components={editBundleForm.components} isEdit={true} />
                  </div>
                ) : (
                  <div className="px-5 pb-3 flex flex-wrap gap-2" style={{ background: '#FAFAFA', borderBottom: i < brandBundles.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                    {b.components.map((c, ci) => {
                      const prod = brandProducts.find(p => p.sku === c.sku)
                      return (
                        <span key={ci} className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: '#F3F4F6', color: '#4B5563' }}>
                          {c.qty}× {prod ? prod.name : c.sku}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
          {brandBundles.length > 0 && (
            <p className="text-xs" style={{ color: '#374151' }}>{brandBundles.length} bundle terdaftar untuk {brand === 'reglow' ? 'Reglow Skincare' : 'Amura'}</p>
          )}
        </div>
      )}

      {/* ── API INTEGRATION ── */}
      {tab === 'api' && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: '#6B7280' }}>Integrasikan data langsung dari platform eksternal. Fitur ini akan segera tersedia.</p>
          {[
            { name: 'Warehouse Management System (WMS)', desc: 'Sinkronisasi stok & COGS otomatis', color: '#10B981', status: 'Planned' },
            { name: 'Google Ads API', desc: 'Pull data kampanye otomatis', color: '#4285F4', status: 'Planned' },
            { name: 'Meta Ads API', desc: 'Pull data Facebook & Instagram Ads', color: '#1877F2', status: 'Planned' },
            { name: 'TikTok Ads API', desc: 'Pull data TikTok Ads & Shop', color: '#FF0050', status: 'Planned' },
          ].map(api => (
            <div key={api.name} className="flex items-center justify-between px-5 py-4 rounded-2xl"
              style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${api.color}18` }}>
                  <Zap size={14} style={{ color: api.color }} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#111827' }}>{api.name}</p>
                  <p className="text-xs" style={{ color: '#6B7280' }}>{api.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(107,114,128,0.1)', color: '#6B7280' }}>{api.status}</span>
                <ChevronRight size={14} style={{ color: '#374151' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

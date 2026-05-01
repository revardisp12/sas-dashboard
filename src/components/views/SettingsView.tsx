'use client'
import { useState, useRef } from 'react'
import { Brand, ProductMaster } from '@/lib/types'
import { saveProducts } from '@/lib/storage'
import { downloadTemplate } from '@/lib/csvParser'
import { Package, Plus, Trash2, Edit2, Check, X, Upload, Settings, Zap, ChevronRight } from 'lucide-react'
import Papa from 'papaparse'

const BRAND_COLOR = { reglow: '#C9A96E', amura: '#8FB050' }
const BRAND_RGB = { reglow: '201,169,110', amura: '143,176,80' }

interface Props {
  brand: Brand
  products: ProductMaster[]
  onProductsChange: (products: ProductMaster[]) => void
}

const EMPTY_FORM = { sku: '', name: '', price: '', cogs: '' }

function toNum(v: string) { return parseFloat(v.replace(/[^0-9.]/g, '')) || 0 }
function fmtRp(n: number) { return 'Rp ' + n.toLocaleString('id-ID') }

export default function SettingsView({ brand, products, onProductsChange }: Props) {
  const [tab, setTab] = useState<'product-master' | 'api'>('product-master')
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const color = BRAND_COLOR[brand]
  const rgb = BRAND_RGB[brand]

  const brandProducts = products.filter(p => p.brand === brand)

  function save(updated: ProductMaster[]) {
    onProductsChange(updated)
    saveProducts(updated)
  }

  function addProduct() {
    const price = toNum(form.price)
    const cogs = toNum(form.cogs)
    if (!form.sku.trim() || !form.name.trim() || !price) return
    const newProduct: ProductMaster = {
      id: Date.now().toString(),
      sku: form.sku.trim(),
      name: form.name.trim(),
      price,
      cogs,
      margin: price > 0 ? Math.round(((price - cogs) / price) * 100) : 0,
      brand,
    }
    save([...products, newProduct])
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
    save(products.map(p => p.id === editId
      ? { ...p, sku: editForm.sku.trim(), name: editForm.name.trim(), price, cogs, margin: price > 0 ? Math.round(((price - cogs) / price) * 100) : 0 }
      : p
    ))
    setEditId(null)
  }

  function deleteProduct(id: string) {
    if (deleteId !== id) { setDeleteId(id); setTimeout(() => setDeleteId(null), 3000); return }
    save(products.filter(p => p.id !== id))
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
            price,
            cogs,
            margin: price > 0 ? Math.round(((price - cogs) / price) * 100) : 0,
            brand,
          }
        }).filter(p => p.sku && p.name)
        const existingIds = new Set(products.filter(p => p.brand === brand).map(p => p.sku))
        const newOnes = imported.filter(p => !existingIds.has(p.sku))
        save([...products, ...newOnes])
        if (fileRef.current) fileRef.current.value = ''
      },
    })
  }

  const marginColor = (m: number) => m >= 50 ? '#10B981' : m >= 30 ? '#F59E0B' : '#EF4444'

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex gap-2">
        {([['product-master', Package, 'Product Master'], ['api', Zap, 'API Integration']] as const).map(([id, Icon, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: tab === id ? `rgba(${rgb},0.15)` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${tab === id ? `rgba(${rgb},0.4)` : 'rgba(255,255,255,0.06)'}`,
              color: tab === id ? color : '#6B7280',
            }}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'product-master' && (
        <div className="space-y-5">
          {/* Add product form */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-sm font-semibold" style={{ color: '#F0F0F5' }}>Tambah Produk</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: '#6B7280' }}>SKU</label>
                <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                  placeholder="e.g. SVC-001"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F0F5' }} />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: '#6B7280' }}>Nama Produk</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Serum Vitamin C"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F0F5' }} />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: '#6B7280' }}>Harga Jual (Rp)</label>
                <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="150000"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F0F5' }} />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: '#6B7280' }}>COGS / HPP (Rp)</label>
                <input value={form.cogs} onChange={e => setForm(f => ({ ...f, cogs: e.target.value }))}
                  placeholder="60000"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F0F5' }} />
              </div>
            </div>
            {/* Margin preview */}
            {form.price && form.cogs && (
              <div className="flex items-center gap-2 text-xs" style={{ color: '#9CA3AF' }}>
                <span>Margin preview:</span>
                <span className="font-bold" style={{ color: marginColor(Math.round(((toNum(form.price) - toNum(form.cogs)) / toNum(form.price)) * 100)) }}>
                  {toNum(form.price) > 0
                    ? Math.round(((toNum(form.price) - toNum(form.cogs)) / toNum(form.price)) * 100) + '%'
                    : '—'}
                </span>
                <span>• Gross Profit: {toNum(form.price) > 0 ? fmtRp(toNum(form.price) - toNum(form.cogs)) : '—'}</span>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={addProduct}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{ background: `rgba(${rgb},0.15)`, border: `1px solid rgba(${rgb},0.3)`, color }}>
                <Plus size={14} /> Tambah Produk
              </button>
              <button onClick={() => { downloadTemplate('product-master') }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9CA3AF' }}>
                Download Template CSV
              </button>
              <label className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9CA3AF' }}>
                <Upload size={14} /> Bulk Import CSV
                <input ref={fileRef} type="file" accept=".csv" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleCSV(e.target.files[0]) }} />
              </label>
            </div>
          </div>

          {/* Product list */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="px-5 py-3 grid text-[10px] font-semibold uppercase tracking-widest"
              style={{ gridTemplateColumns: '100px 1fr 120px 120px 80px 80px', color: '#4B5563', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span>SKU</span><span>Nama Produk</span><span>Harga Jual</span><span>COGS</span><span>Margin</span><span></span>
            </div>
            {brandProducts.length === 0 ? (
              <div className="py-16 text-center">
                <Package size={32} className="mx-auto mb-3 opacity-20" style={{ color: '#6B7280' }} />
                <p className="text-sm" style={{ color: '#4B5563' }}>Belum ada produk. Tambahkan di atas atau import CSV.</p>
              </div>
            ) : brandProducts.map((p, i) => (
              <div key={p.id}
                className="px-5 py-3.5 grid items-center"
                style={{
                  gridTemplateColumns: '100px 1fr 120px 120px 80px 80px',
                  borderBottom: i < brandProducts.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  background: editId === p.id ? 'rgba(255,255,255,0.03)' : 'transparent',
                }}>
                {editId === p.id ? (
                  <>
                    <input value={editForm.sku} onChange={e => setEditForm(f => ({ ...f, sku: e.target.value }))}
                      className="px-2 py-1 rounded-lg text-xs mr-2 outline-none"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#F0F0F5' }} />
                    <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className="px-2 py-1 rounded-lg text-xs mr-2 outline-none"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#F0F0F5' }} />
                    <input value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                      className="px-2 py-1 rounded-lg text-xs mr-2 outline-none"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#F0F0F5' }} />
                    <input value={editForm.cogs} onChange={e => setEditForm(f => ({ ...f, cogs: e.target.value }))}
                      className="px-2 py-1 rounded-lg text-xs mr-2 outline-none"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#F0F0F5' }} />
                    <span className="text-xs font-bold" style={{ color: marginColor(toNum(editForm.price) > 0 ? Math.round(((toNum(editForm.price) - toNum(editForm.cogs)) / toNum(editForm.price)) * 100) : 0) }}>
                      {toNum(editForm.price) > 0 ? Math.round(((toNum(editForm.price) - toNum(editForm.cogs)) / toNum(editForm.price)) * 100) + '%' : '—'}
                    </span>
                    <div className="flex gap-1.5 justify-end">
                      <button onClick={confirmEdit} className="p-1.5 rounded-lg transition-all" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}><Check size={12} /></button>
                      <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg transition-all" style={{ background: 'rgba(107,114,128,0.1)', color: '#6B7280' }}><X size={12} /></button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-mono" style={{ color: '#9CA3AF' }}>{p.sku}</span>
                    <span className="text-sm font-medium" style={{ color: '#F0F0F5' }}>{p.name}</span>
                    <span className="text-sm" style={{ color: '#9CA3AF' }}>{fmtRp(p.price)}</span>
                    <span className="text-sm" style={{ color: '#9CA3AF' }}>{fmtRp(p.cogs)}</span>
                    <span className="text-sm font-bold" style={{ color: marginColor(p.margin) }}>{p.margin}%</span>
                    <div className="flex gap-1.5 justify-end">
                      <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg transition-all" style={{ background: 'rgba(255,255,255,0.04)', color: '#6B7280' }}><Edit2 size={12} /></button>
                      <button onClick={() => deleteProduct(p.id)}
                        className="p-1.5 rounded-lg transition-all"
                        style={{ background: deleteId === p.id ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)', color: deleteId === p.id ? '#F87171' : '#6B7280' }}>
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
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${api.color}18` }}>
                  <Zap size={14} style={{ color: api.color }} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#F0F0F5' }}>{api.name}</p>
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

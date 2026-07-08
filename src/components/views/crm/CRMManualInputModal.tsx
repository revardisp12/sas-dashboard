'use client'
import { useState } from 'react'
import { CRMRow, Brand, ProductMaster } from '@/lib/types'
import { Plus, Trash2, X } from 'lucide-react'
import { BRAND_RGB } from '@/lib/brand'
import { todayWIB } from '@/lib/utils'

interface LineItem { product: string; sku: string; qty: string; revenue: string }
const EMPTY_LINE: LineItem = { product: '', sku: '', qty: '1', revenue: '' }

interface Props {
  brand: Brand
  accent: string
  brandProducts: ProductMaster[]
  onSave: (rows: CRMRow[]) => void
  onClose: () => void
}

export default function CRMManualInputModal({ brand, accent, brandProducts, onSave, onClose }: Props) {
  const [date, setDate] = useState(todayWIB())
  const [customer, setCustomer] = useState('')
  const [phone, setPhone] = useState('')
  const [lines, setLines] = useState<LineItem[]>([{ ...EMPTY_LINE }])
  const rgb = BRAND_RGB[brand]

  function pickProduct(idx: number, sku: string) {
    const pm = brandProducts.find(p => p.sku === sku)
    if (!pm) return
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, sku: pm.sku, product: pm.name, revenue: String(pm.price) } : l))
  }
  function addLine() { setLines(prev => [...prev, { ...EMPTY_LINE }]) }
  function removeLine(idx: number) { setLines(prev => prev.filter((_, i) => i !== idx)) }
  function updateLine(idx: number, key: keyof LineItem, val: string) {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [key]: val } : l))
  }
  function handleSave() {
    const rows: CRMRow[] = lines
      .filter(l => l.product && Number(l.qty) > 0)
      .map(l => ({
        date,
        customerName: customer,
        phone,
        product: l.product,
        qty: Number(l.qty) || 1,
        revenue: Number(l.revenue) || 0,
      }))
    if (rows.length === 0) return
    onSave(rows)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
          <div>
            <p className="font-semibold" style={{ color: '#111827' }}>Input Manual — CRM</p>
            <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Tambah transaksi customer</p>
          </div>
          <button onClick={onClose} style={{ color: '#6B7280' }}><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: '#4B5563' }}>Tanggal</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: '#4B5563' }}>Nama Customer</label>
              <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Siti Rahma"
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: '#4B5563' }}>No. HP</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="081234567890"
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#6B7280' }}>Produk</p>
              <button onClick={addLine} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                style={{ background: `rgba(${rgb},0.1)`, color: accent }}>
                <Plus size={11} /> Tambah Baris
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="grid gap-2 items-end" style={{ gridTemplateColumns: '2fr 70px 120px 32px' }}>
                  <div>
                    {idx === 0 && <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: '#4B5563' }}>Produk</label>}
                    <select value={line.sku} onChange={e => pickProduct(idx, e.target.value)}
                      disabled={brandProducts.length === 0}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: brandProducts.length === 0 ? '#9CA3AF' : '#111827', cursor: brandProducts.length === 0 ? 'not-allowed' : 'pointer' }}>
                      <option value="">{brandProducts.length === 0 ? '— Isi Product Master dulu —' : '— Pilih produk —'}</option>
                      {brandProducts.map(p => <option key={p.sku} value={p.sku}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    {idx === 0 && <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: '#4B5563' }}>Qty</label>}
                    <input type="number" min="1" value={line.qty} onChange={e => updateLine(idx, 'qty', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
                  </div>
                  <div>
                    {idx === 0 && <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: '#4B5563' }}>Revenue (Rp)</label>}
                    <input type="number" value={line.revenue} onChange={e => updateLine(idx, 'revenue', e.target.value)}
                      placeholder={line.sku ? 'Auto' : '150000'}
                      readOnly={!!line.sku}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827', opacity: line.sku ? 0.6 : 1 }} />
                  </div>
                  <button onClick={() => removeLine(idx)} disabled={lines.length === 1}
                    className="pb-0.5" style={{ color: lines.length === 1 ? '#374151' : '#6B7280' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#9CA3AF' }}>
              Batal
            </button>
            <button onClick={handleSave} className="px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: `rgba(${rgb},0.2)`, border: `1px solid rgba(${rgb},0.4)`, color: accent }}>
              Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

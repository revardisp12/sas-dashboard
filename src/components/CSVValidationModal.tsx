'use client'
import { X, CheckCircle, AlertTriangle, XCircle, Download } from 'lucide-react'
import { Brand, ProductMaster, BundleMaster } from '@/lib/types'

export interface InvalidRow {
  rowIndex: number
  date: string
  product: string
}

interface Props {
  title: string
  brand: Brand
  validCount: number
  invalidRows: InvalidRow[]
  onConfirm: () => void
  onClose: () => void
}

const BRAND_RGB: Record<Brand, string> = { reglow: '201,169,110', amura: '143,176,80' }
const BRAND_COLOR: Record<Brand, string> = { reglow: '#C9A96E', amura: '#8FB050' }

export function validateProductField(
  product: string,
  brandProducts: ProductMaster[],
  brandBundles: BundleMaster[],
): boolean {
  if (!product.trim()) return false
  const lower = product.trim().toLowerCase()
  const matchSku = brandProducts.some(p => p.sku.toLowerCase() === lower)
  if (matchSku) return true
  const matchName = brandProducts.some(p => p.name.toLowerCase() === lower)
  if (matchName) return true
  const matchBundle = brandBundles.some(b => b.name.toLowerCase() === lower)
  return matchBundle
}

function downloadInvalidCSV(invalidRows: InvalidRow[]) {
  const header = 'Row,Tanggal,Produk'
  const body = invalidRows.map(r => `${r.rowIndex},${r.date},"${r.product}"`).join('\n')
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'invalid_rows.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function CSVValidationModal({ title, brand, validCount, invalidRows, onConfirm, onClose }: Props) {
  const rgb = BRAND_RGB[brand]
  const color = BRAND_COLOR[brand]
  const allInvalid = validCount === 0
  const allValid = invalidRows.length === 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #E5E7EB' }}>
          <div className="flex items-center gap-2.5">
            {allValid
              ? <CheckCircle size={16} style={{ color: '#10B981' }} />
              : allInvalid
                ? <XCircle size={16} style={{ color: '#EF4444' }} />
                : <AlertTriangle size={16} style={{ color: '#F59E0B' }} />}
            <div>
              <p className="font-semibold text-sm" style={{ color: '#111827' }}>
                {allValid ? 'CSV Valid' : allInvalid ? 'Upload Gagal' : 'Validasi CSV'} — {title}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                {allValid
                  ? `${validCount} baris siap disimpan`
                  : allInvalid
                    ? `${invalidRows.length} baris tidak dikenali`
                    : `${validCount} valid · ${invalidRows.length} tidak dikenali`}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: '#6B7280' }}><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {allValid && (
            <div className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <CheckCircle size={20} style={{ color: '#10B981', flexShrink: 0 }} />
              <p className="text-sm" style={{ color: '#065F46' }}>
                Semua produk ditemukan di Product Master.
              </p>
            </div>
          )}

          {allInvalid && (
            <div className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <XCircle size={20} style={{ color: '#EF4444', flexShrink: 0 }} />
              <p className="text-sm" style={{ color: '#7F1D1D' }}>
                Tidak ada produk yang cocok dengan Product Master. Periksa nama/SKU di CSV atau tambah produk di Settings.
              </p>
            </div>
          )}

          {!allValid && !allInvalid && (
            <div className="rounded-xl p-3"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <p className="text-xs" style={{ color: '#92400E' }}>
                Baris di bawah tidak cocok dengan SKU, nama produk, atau nama bundle di Product Master. Baris ini akan dilewati.
              </p>
            </div>
          )}

          {invalidRows.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#4B5563' }}>
                Produk Tidak Dikenali ({invalidRows.length} baris)
              </p>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                      <th className="text-left px-3 py-2 font-semibold" style={{ color: '#6B7280', width: 48 }}>#</th>
                      <th className="text-left px-3 py-2 font-semibold" style={{ color: '#6B7280', width: 100 }}>Tanggal</th>
                      <th className="text-left px-3 py-2 font-semibold" style={{ color: '#6B7280' }}>Produk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invalidRows.slice(0, 50).map((r, i) => (
                      <tr key={i} style={{ borderBottom: i < invalidRows.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                        <td className="px-3 py-2" style={{ color: '#9CA3AF' }}>{r.rowIndex}</td>
                        <td className="px-3 py-2" style={{ color: '#6B7280' }}>{r.date || '—'}</td>
                        <td className="px-3 py-2 font-medium" style={{ color: '#EF4444' }}>{r.product || '(kosong)'}</td>
                      </tr>
                    ))}
                    {invalidRows.length > 50 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-center" style={{ color: '#9CA3AF' }}>
                          +{invalidRows.length - 50} baris lainnya
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <button onClick={() => downloadInvalidCSV(invalidRows)}
                className="flex items-center gap-1.5 mt-2 text-xs"
                style={{ color: '#6B7280' }}>
                <Download size={11} /> Download baris tidak valid
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid #E5E7EB' }}>
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#9CA3AF' }}>
            {allInvalid ? 'Tutup' : 'Batal'}
          </button>
          {!allInvalid && (
            <button onClick={onConfirm}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: `rgba(${rgb},0.2)`, border: `1px solid rgba(${rgb},0.4)`, color }}>
              {allValid ? `Simpan ${validCount} Baris` : `Simpan ${validCount} Baris Valid`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

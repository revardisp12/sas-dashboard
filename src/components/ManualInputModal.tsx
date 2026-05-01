'use client'
import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { Brand } from '@/lib/types'

export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'number' | 'date'
  placeholder?: string
  defaultValue?: string
}

interface Props {
  title: string
  subtitle?: string
  brand: Brand
  fields: FieldDef[]
  onSave: (row: Record<string, string>) => void
  onClose: () => void
}

const BRAND_RGB: Record<Brand, string> = { reglow: '201,169,110', amura: '143,176,80' }
const BRAND_COLOR: Record<Brand, string> = { reglow: '#C9A96E', amura: '#8FB050' }

export default function ManualInputModal({ title, subtitle, brand, fields, onSave, onClose }: Props) {
  const initForm = () => fields.reduce<Record<string, string>>((acc, f) => {
    acc[f.key] = f.defaultValue ?? (f.type === 'date' ? new Date().toISOString().slice(0, 10) : '')
    return acc
  }, {})

  const [form, setForm] = useState<Record<string, string>>(initForm)
  const rgb = BRAND_RGB[brand]
  const color = BRAND_COLOR[brand]

  function handleSave() {
    onSave(form)
    setForm(initForm())
  }

  const half = Math.ceil(fields.length / 2)
  const col1 = fields.slice(0, half)
  const col2 = fields.slice(half)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid #E5E7EB' }}>
          <div>
            <p className="font-semibold" style={{ color: '#111827' }}>{title}</p>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{ color: '#6B7280' }}><X size={18} /></button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-4">
            {[col1, col2].map((col, ci) => (
              <div key={ci} className="space-y-4">
                {col.map(f => (
                  <div key={f.key}>
                    <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5"
                      style={{ color: '#4B5563' }}>{f.label}</label>
                    <input
                      type={f.type}
                      value={form[f.key] ?? ''}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder ?? ''}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-all"
                      style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-6">
            <button onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#9CA3AF' }}>
              Batal
            </button>
            <button onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: `rgba(${rgb},0.2)`, border: `1px solid rgba(${rgb},0.4)`, color }}>
              <Plus size={14} /> Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

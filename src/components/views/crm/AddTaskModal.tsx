'use client'
import { useState } from 'react'
import { CustomerRFM } from '@/lib/types'
import { SEGMENT_CONFIG } from '@/lib/rfm'
import { X } from 'lucide-react'

interface Props {
  customer: CustomerRFM
  accent: string
  initialNote?: string
  initialDueDate?: string
  onSave: (note: string, dueDate: string) => void
  onClose: () => void
}

export default function AddTaskModal({ customer, accent, initialNote = '', initialDueDate = '', onSave, onClose }: Props) {
  const [note, setNote] = useState(initialNote)
  const [dueDate, setDueDate] = useState(initialDueDate)

  function handleSave() {
    if (!note || !dueDate) return
    onSave(note, dueDate)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #E5E7EB' }}>
          <div>
            <h3 className="text-base font-bold" style={{ color: '#111827' }}>Tambah Follow-up Task</h3>
            <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{customer.customerName} · <span style={{ color: SEGMENT_CONFIG[customer.segment].color }}>{customer.segment}</span></p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F9FAFB', color: '#6B7280' }}><X size={14} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] font-semibold tracking-widest uppercase mb-2 block" style={{ color: '#4B5563' }}>Catatan / Aksi</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none"
              style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
          </div>
          <div>
            <label className="text-[10px] font-semibold tracking-widest uppercase mb-2 block" style={{ color: '#4B5563' }}>Due Date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
          </div>
          <button onClick={handleSave}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: accent, color: '#FFFFFF', boxShadow: `0 0 20px ${accent}60` }}>
            Tambah Task
          </button>
        </div>
      </div>
    </div>
  )
}

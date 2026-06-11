'use client'
import { CustomerRFM } from '@/lib/types'
import { fmtCurrency } from '@/lib/utils'
import { SEGMENT_CONFIG, scoreColor } from '@/lib/rfm'
import { X, Phone, Calendar, ShoppingBag, TrendingUp } from 'lucide-react'
import OriginBadge from '@/components/wms/OriginBadge'

interface Props {
  customer: CustomerRFM
  onClose: () => void
}

export default function CustomerDetailModal({ customer, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5" style={{ borderBottom: '1px solid #E5E7EB' }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold" style={{ color: '#111827' }}>{customer.customerName}</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: SEGMENT_CONFIG[customer.segment].bg, color: SEGMENT_CONFIG[customer.segment].color }}>{customer.segment}</span>
            </div>
            <p className="text-xs" style={{ color: '#6B7280' }}>{SEGMENT_CONFIG[customer.segment].action}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F9FAFB', color: '#6B7280' }}><X size={14} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2"><Phone size={12} style={{ color: '#4B5563' }} /><span className="text-sm" style={{ color: '#9CA3AF' }}>{customer.phone || '–'}</span></div>
            <div className="flex items-center gap-2"><Calendar size={12} style={{ color: '#4B5563' }} /><span className="text-sm" style={{ color: '#9CA3AF' }}>Last: {customer.lastOrderDate}</span></div>
            <div className="flex items-center gap-2"><ShoppingBag size={12} style={{ color: '#4B5563' }} /><span className="text-sm" style={{ color: '#9CA3AF' }}>{customer.frequency}x pembelian</span></div>
            <div className="flex items-center gap-2"><TrendingUp size={12} style={{ color: '#4B5563' }} /><span className="text-sm font-bold" style={{ color: '#10B981' }}>{fmtCurrency(customer.monetary)}</span></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Recency', score: customer.rScore, sub: `${customer.recencyDays} hari lalu` },
              { label: 'Frequency', score: customer.fScore, sub: `${customer.frequency}x order` },
              { label: 'Monetary', score: customer.mScore, sub: fmtCurrency(customer.monetary) },
            ].map(item => (
              <div key={item.label} className="rounded-xl p-3 text-center" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#4B5563' }}>{item.label}</p>
                <p className="text-2xl font-bold" style={{ color: scoreColor(item.score) }}>{item.score}</p>
                <p className="text-[10px] mt-1" style={{ color: '#6B7280' }}>{item.sub}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#4B5563' }}>Riwayat Transaksi</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {customer.transactions.map((tx, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: '#F9FAFB' }}>
                  <div><p className="text-xs font-medium" style={{ color: '#111827' }}>{tx.product}</p><p className="text-[10px]" style={{ color: '#4B5563' }}>{tx.date} · {tx.qty}x</p></div>
                  <div className="flex items-center gap-2">
                    <OriginBadge origin={tx.origin} />
                    <p className="text-sm font-bold" style={{ color: '#10B981' }}>{fmtCurrency(tx.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

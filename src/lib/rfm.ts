import type { CRMRow, CRMTimeframe, CustomerRFM, RFMSegment } from './types'

export const SEGMENT_CONFIG: Record<RFMSegment, { color: string; bg: string; action: string }> = {
  'Champions':          { color: '#10B981', bg: 'rgba(16,185,129,0.15)',  action: 'Minta review/testimoni, tawarkan upsell produk premium' },
  'Loyal Customers':    { color: '#3B82F6', bg: 'rgba(59,130,246,0.15)',  action: 'Tawarkan loyalty reward atau bundling eksklusif' },
  'Potential Loyalist': { color: '#00D4FF', bg: 'rgba(0,212,255,0.15)',   action: 'Kirim tips pemakaian, dorong pembelian kedua' },
  'New Customers':      { color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)', action: 'Follow up kepuasan, rekomendasikan produk lanjutan' },
  'Promising':          { color: '#A78BFA', bg: 'rgba(167,139,250,0.15)', action: 'Edukasi manfaat produk, tawarkan paket hemat' },
  'Need Attention':     { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)',  action: 'Ingatkan stok hampir habis, beri penawaran spesial' },
  'About to Sleep':     { color: '#F07830', bg: 'rgba(240,120,48,0.15)',  action: 'Kirim penawaran diskon reaktivasi' },
  "Can't Lose Them":    { color: '#EF4444', bg: 'rgba(239,68,68,0.15)',   action: 'Hubungi personal ASAP — tawarkan deal eksklusif' },
  'At Risk':            { color: '#F87171', bg: 'rgba(248,113,113,0.15)', action: 'Re-engagement campaign, tanya kenapa berhenti beli' },
  'Hibernating':        { color: '#6B7280', bg: 'rgba(107,114,128,0.15)', action: 'Win-back offer dengan diskon besar atau hadiah' },
}

export function getSegment(r: number, f: number): RFMSegment {
  if (r >= 4 && f >= 4) return 'Champions'
  if (r >= 3 && f >= 3) return 'Loyal Customers'
  if (f >= 4 && r <= 2) return "Can't Lose Them"
  if (r <= 2 && f >= 3) return 'At Risk'
  if (r >= 3 && f <= 2) return 'Potential Loyalist'
  if (r === 5 && f === 1) return 'New Customers'
  if (r === 4 && f <= 2) return 'Promising'
  if (r === 3 && f === 3) return 'Need Attention'
  if (r <= 2 && f <= 2) return 'About to Sleep'
  return 'Hibernating'
}

function scoreQuintile(value: number, sorted: number[], reverse = false): number {
  if (sorted.length === 0) return 1
  const idx = sorted.findIndex(v => v >= value)
  const pos = idx === -1 ? sorted.length - 1 : idx
  const pct = pos / (sorted.length - 1 || 1)
  const score = Math.ceil(pct * 4) + 1
  const clamped = Math.min(5, Math.max(1, score))
  return reverse ? 6 - clamped : clamped
}

export function filterByDaysCRM(data: CRMRow[], days: CRMTimeframe): CRMRow[] {
  if (days === 0 || data.length === 0) return data
  const timestamps = data.map(r => new Date(r.date).getTime()).filter(t => !isNaN(t))
  if (timestamps.length === 0) return data
  const maxDate = new Date(Math.max(...timestamps))
  const cutoff = new Date(maxDate)
  cutoff.setDate(cutoff.getDate() - days + 1)
  return data.filter(r => { const d = new Date(r.date); return !isNaN(d.getTime()) && d >= cutoff })
}

export function calcRFM(data: CRMRow[]): CustomerRFM[] {
  if (data.length === 0) return []
  const timestamps = data.map(r => new Date(r.date).getTime()).filter(t => !isNaN(t))
  const maxDate = new Date(Math.max(...timestamps))
  const customerMap: Record<string, CRMRow[]> = {}
  data.forEach(r => {
    const key = r.phone || r.customerName
    if (!customerMap[key]) customerMap[key] = []
    customerMap[key].push(r)
  })
  const raw = Object.entries(customerMap).map(([, txns]) => {
    const sorted = [...txns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const lastDate = new Date(sorted[0].date)
    const recencyDays = Math.max(0, Math.floor((maxDate.getTime() - lastDate.getTime()) / 86400000))
    return { customerName: txns[0].customerName, phone: txns[0].phone, lastOrderDate: sorted[0].date, recencyDays, frequency: txns.length, monetary: txns.reduce((s, r) => s + r.revenue, 0), transactions: sorted }
  })
  const recencySorted = [...raw.map(r => r.recencyDays)].sort((a, b) => a - b)
  const freqSorted = [...raw.map(r => r.frequency)].sort((a, b) => a - b)
  const monSorted = [...raw.map(r => r.monetary)].sort((a, b) => a - b)
  return raw.map(r => {
    const rScore = scoreQuintile(r.recencyDays, recencySorted, true)
    const fScore = scoreQuintile(r.frequency, freqSorted)
    const mScore = scoreQuintile(r.monetary, monSorted)
    return { ...r, rScore, fScore, mScore, segment: getSegment(rScore, fScore) }
  })
}

export function scoreColor(score: number): string {
  if (score >= 5) return '#10B981'
  if (score >= 4) return '#3B82F6'
  if (score >= 3) return '#F59E0B'
  if (score >= 2) return '#F07830'
  return '#EF4444'
}

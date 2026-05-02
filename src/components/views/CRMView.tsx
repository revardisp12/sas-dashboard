'use client'
import { useState, useMemo, useEffect } from 'react'
import { CRMRow, Brand, CRMTimeframe, CustomerRFM, RFMSegment, FollowUpTask, ProductMaster, BundleMaster } from '@/lib/types'
import { fmtCurrency, fmtNum } from '@/lib/utils'
import { loadTasks, saveTasks } from '@/lib/storage'
import CSVUploader from '@/components/CSVUploader'
import CSVValidationModal, { validateProductField, InvalidRow } from '@/components/CSVValidationModal'
import { parseCRM } from '@/lib/csvParser'
import { Users, X, Phone, Calendar, ShoppingBag, TrendingUp, Plus, ChevronRight, Trash2, Search, ChevronDown, Download } from 'lucide-react'

const BRAND_COLOR: Record<Brand, string> = { reglow: '#C9A96E', amura: '#8FB050' }

const SEGMENT_CONFIG: Record<RFMSegment, { color: string; bg: string; action: string }> = {
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

function getSegment(r: number, f: number): RFMSegment {
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

function filterByDaysCRM(data: CRMRow[], days: CRMTimeframe): CRMRow[] {
  if (days === 0 || data.length === 0) return data
  const timestamps = data.map(r => new Date(r.date).getTime()).filter(t => !isNaN(t))
  if (timestamps.length === 0) return data
  const maxDate = new Date(Math.max(...timestamps))
  const cutoff = new Date(maxDate)
  cutoff.setDate(cutoff.getDate() - days + 1)
  return data.filter(r => { const d = new Date(r.date); return !isNaN(d.getTime()) && d >= cutoff })
}

function calcRFM(data: CRMRow[]): CustomerRFM[] {
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

const TIMEFRAME_OPTIONS: { label: string; value: CRMTimeframe }[] = [
  { label: '30H', value: 30 }, { label: '90H', value: 90 },
  { label: '180H', value: 180 }, { label: '1 Tahun', value: 365 }, { label: 'All', value: 0 },
]

type Tab = 'rfm' | 'pipeline' | 'actions'

interface CRMLineItem { product: string; sku: string; qty: string; revenue: string }
const EMPTY_CRM_LINE: CRMLineItem = { product: '', sku: '', qty: '1', revenue: '' }

interface Props {
  data: CRMRow[]
  brand: Brand
  onUpload: (file: File) => Promise<void>
  onBulkUpload?: (rows: CRMRow[]) => void
  products?: ProductMaster[]
  bundles?: BundleMaster[]
  onManualAdd?: (rows: CRMRow[]) => void
}

export default function CRMView({ data, brand, onUpload, onBulkUpload, products = [], bundles = [], onManualAdd }: Props) {
  const accent = BRAND_COLOR[brand]
  const [timeframe, setTimeframe] = useState<CRMTimeframe>(90)
  const [tab, setTab] = useState<Tab>('rfm')
  const [selectedSegment, setSelectedSegment] = useState<RFMSegment | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRFM | null>(null)
  const [page, setPage] = useState(1)
  const [tasks, setTasks] = useState<FollowUpTask[]>([])
  const [addTaskModal, setAddTaskModal] = useState<{ customer: CustomerRFM } | null>(null)
  const [taskForm, setTaskForm] = useState({ note: '', dueDate: '' })

  // Action List accordion state
  const [expandedSegment, setExpandedSegment] = useState<RFMSegment | null>(null)
  const [segmentSearch, setSegmentSearch] = useState<Partial<Record<RFMSegment, string>>>({})
  const [segmentPage, setSegmentPage] = useState<Partial<Record<RFMSegment, number>>>({})
  const ACTION_PER_PAGE = 20
  const PER_PAGE = 10

  const [crmModal, setCrmModal] = useState(false)
  const [crmDate, setCrmDate] = useState(new Date().toISOString().slice(0, 10))
  const [crmCustomer, setCrmCustomer] = useState('')
  const [crmPhone, setCrmPhone] = useState('')
  const [crmLines, setCrmLines] = useState<CRMLineItem[]>([{ ...EMPTY_CRM_LINE }])
  const brandProducts = products.filter(p => p.brand === brand)
  const brandBundles = bundles.filter(b => b.brand === brand)

  const [validationModal, setValidationModal] = useState<{
    validRows: CRMRow[]
    invalidRows: InvalidRow[]
  } | null>(null)

  async function handleCSVFile(file: File) {
    if (brandProducts.length === 0) { await onUpload(file); return }
    const rows = await parseCRM(file)
    const validRows: CRMRow[] = []
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

  function pickCrmProduct(idx: number, sku: string) {
    const pm = brandProducts.find(p => p.sku === sku)
    if (!pm) return
    setCrmLines(prev => prev.map((l, i) => i === idx ? { ...l, sku: pm.sku, product: pm.name, revenue: String(pm.price) } : l))
  }
  function addCrmLine() { setCrmLines(prev => [...prev, { ...EMPTY_CRM_LINE }]) }
  function removeCrmLine(idx: number) { setCrmLines(prev => prev.filter((_, i) => i !== idx)) }
  function updateCrmLine(idx: number, key: keyof CRMLineItem, val: string) {
    setCrmLines(prev => prev.map((l, i) => i === idx ? { ...l, [key]: val } : l))
  }
  function saveCrmManual() {
    const rows: CRMRow[] = crmLines
      .filter(l => l.product && Number(l.qty) > 0)
      .map(l => ({
        date: crmDate,
        customerName: crmCustomer,
        phone: crmPhone,
        product: l.product,
        qty: Number(l.qty) || 1,
        revenue: Number(l.revenue) || 0,
      }))
    if (rows.length === 0) return
    onManualAdd?.(rows)
    setCrmModal(false)
    setCrmLines([{ ...EMPTY_CRM_LINE }])
    setCrmCustomer(''); setCrmPhone('')
  }

  useEffect(() => { setTasks(loadTasks().filter(t => t.brand === brand)) }, [brand])

  const filtered = useMemo(() => filterByDaysCRM(data, timeframe), [data, timeframe])
  const customers = useMemo(() => calcRFM(filtered), [filtered])

  const matrixCount: Record<string, number> = {}
  customers.forEach(c => { matrixCount[`${c.rScore}-${c.fScore}`] = (matrixCount[`${c.rScore}-${c.fScore}`] || 0) + 1 })

  const segmentCounts: Record<RFMSegment, number> = {} as Record<RFMSegment, number>
  customers.forEach(c => { segmentCounts[c.segment] = (segmentCounts[c.segment] || 0) + 1 })

  const displayedCustomers = selectedSegment ? customers.filter(c => c.segment === selectedSegment) : customers
  const pageCustomers = displayedCustomers.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const totalPages = Math.ceil(displayedCustomers.length / PER_PAGE)

  const todayStr = new Date().toISOString().split('T')[0]
  const todayTasks = tasks.filter(t => t.dueDate === todayStr && t.status !== 'done')

  function updateTaskStatus(id: string, status: FollowUpTask['status']) {
    const allTasks = loadTasks()
    const updated = allTasks.map(t => t.id === id ? { ...t, status } : t)
    saveTasks(updated)
    setTasks(updated.filter(t => t.brand === brand))
  }

  function addTask(customer: CustomerRFM) {
    if (!taskForm.note || !taskForm.dueDate) return
    const allTasks = loadTasks()
    const newTask: FollowUpTask = {
      id: Date.now().toString(),
      customerName: customer.customerName,
      phone: customer.phone,
      segment: customer.segment,
      note: taskForm.note,
      dueDate: taskForm.dueDate,
      status: 'todo',
      brand,
      createdAt: new Date().toISOString(),
    }
    const updated = [...allTasks, newTask]
    saveTasks(updated)
    setTasks(updated.filter(t => t.brand === brand))
    setAddTaskModal(null)
    setTaskForm({ note: '', dueDate: '' })
  }

  function exportSegmentCSV(seg: RFMSegment, segCustomers: CustomerRFM[]) {
    const rows = [
      ['Nama', 'No. HP', 'Last Order', 'Sejak (hari)', 'Orders', 'Total Spend', 'R', 'F', 'M'].join(','),
      ...segCustomers.map(c => [
        `"${c.customerName}"`, c.phone || '', c.lastOrderDate, c.recencyDays, c.frequency, c.monetary, c.rScore, c.fScore, c.mScore
      ].join(',')),
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${seg.replace(/\s+/g, '-').toLowerCase()}-customers.csv`
    a.click()
  }

  function deleteTask(id: string) {
    const allTasks = loadTasks()
    const updated = allTasks.filter(t => t.id !== id)
    saveTasks(updated)
    setTasks(updated.filter(t => t.brand === brand))
  }

  return (
    <div className="space-y-5">
      {/* Empty state */}
      {data.length === 0 && (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#4B5563' }}>Sales Retention by CRM</p>
              <p className="text-sm" style={{ color: '#4B5563' }}>Upload data transaksi CS untuk mulai analisis RFM</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setCrmModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0"
                style={{ background: `rgba(${brand === 'reglow' ? '201,169,110' : '143,176,80'},0.15)`, border: `1px solid rgba(${brand === 'reglow' ? '201,169,110' : '143,176,80'},0.3)`, color: accent }}>
                <Plus size={14} /> Input Manual
              </button>
              <div className="w-56 flex-shrink-0">
                <CSVUploader platform="crm" hasData={false} onUpload={handleCSVFile} accent={accent} />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl"
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: `${accent}15`, border: `1px solid ${accent}30`, boxShadow: `0 0 30px ${accent}15` }}>
              <Users size={28} style={{ color: accent }} />
            </div>
            <p className="font-semibold mb-1" style={{ color: '#6B7280' }}>Belum ada data CRM</p>
            <p className="text-sm mb-1" style={{ color: '#374151' }}>Upload CSV transaksi customer dari CS</p>
            <p className="text-xs" style={{ color: '#1F2937' }}>Format: Date, Customer Name, Phone, Product, Qty, Revenue</p>
          </div>
        </div>
      )}

      {/* Main content when data exists */}
      {data.length > 0 && <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#4B5563' }}>Sales Retention by CRM</span>
          </div>
          <p className="text-sm" style={{ color: '#4B5563' }}>{customers.length} customers dianalisis</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
            {TIMEFRAME_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setTimeframe(opt.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: timeframe === opt.value ? accent : 'transparent', color: timeframe === opt.value ? '#FFFFFF' : '#6B7280', boxShadow: timeframe === opt.value ? `0 0 12px ${accent}60` : 'none' }}>
                {opt.label}
              </button>
            ))}
          </div>
          <button onClick={() => setCrmModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all flex-shrink-0"
            style={{ background: `rgba(${brand === 'reglow' ? '201,169,110' : '143,176,80'},0.15)`, border: `1px solid rgba(${brand === 'reglow' ? '201,169,110' : '143,176,80'},0.3)`, color: accent }}>
            <Plus size={14} /> Input Manual
          </button>
          <div className="w-44 flex-shrink-0">
            <CSVUploader platform="crm" hasData={data.length > 0} onUpload={handleCSVFile} accent={accent} />
          </div>
        </div>
      </div>

      {/* Reminder banner */}
      {todayTasks.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <span className="text-sm font-medium" style={{ color: '#F59E0B' }}>
            🔔 {todayTasks.length} follow-up jatuh tempo hari ini
          </span>
          <button onClick={() => setTab('pipeline')} className="text-xs font-semibold flex items-center gap-1" style={{ color: '#F59E0B' }}>
            Lihat Pipeline <ChevronRight size={12} />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Total Customers', value: fmtNum(customers.length), color: accent },
          { label: 'Champions', value: fmtNum(segmentCounts['Champions'] || 0), color: '#10B981' },
          { label: 'At Risk / Can\'t Lose', value: fmtNum((segmentCounts['At Risk'] || 0) + (segmentCounts["Can't Lose Them"] || 0)), color: '#EF4444' },
          { label: 'Total Revenue', value: fmtCurrency(customers.reduce((s, c) => s + c.monetary, 0)), color: '#8B5CF6' },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
            <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: '#4B5563' }}>{stat.label}</p>
            <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
        {([['rfm', 'RFM Matrix'], ['pipeline', 'Pipeline'], ['actions', 'Action List']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: tab === t ? accent : 'transparent', color: tab === t ? '#FFFFFF' : '#6B7280', boxShadow: tab === t ? `0 0 12px ${accent}60` : 'none' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: RFM MATRIX ── */}
      {tab === 'rfm' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#6B7280' }}>RFM Matrix</p>
            <div className="flex gap-3">
              <div className="flex items-center justify-center" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                <span className="text-[9px] tracking-widest uppercase" style={{ color: '#374151' }}>Frequency ↑</span>
              </div>
              <div className="flex-1">
                <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                  {[5, 4, 3, 2, 1].map(fScore => [1, 2, 3, 4, 5].map(rScore => {
                    const count = matrixCount[`${rScore}-${fScore}`] || 0
                    const seg = getSegment(rScore, fScore)
                    const cfg = SEGMENT_CONFIG[seg]
                    const isSelected = selectedSegment === seg
                    const pct = customers.length > 0 ? ((count / customers.length) * 100).toFixed(0) : '0'
                    return (
                      <button key={`${rScore}-${fScore}`}
                        onClick={() => { setSelectedSegment(isSelected ? null : seg); setPage(1) }}
                        className="rounded-lg flex flex-col items-center justify-center transition-all"
                        style={{ aspectRatio: '1', background: count > 0 ? cfg.bg : '#F9FAFB', border: isSelected ? `2px solid ${cfg.color}` : `1px solid ${count > 0 ? cfg.color + '30' : '#F9FAFB'}`, boxShadow: isSelected ? `0 0 16px ${cfg.color}40` : 'none', opacity: selectedSegment && !isSelected ? 0.4 : 1 }}>
                        {count > 0 ? (<><span className="text-xs font-bold leading-none" style={{ color: cfg.color }}>{pct}%</span><span className="text-[9px] leading-none mt-0.5" style={{ color: cfg.color + 'aa' }}>{count}</span></>) : (<span style={{ color: '#F9FAFB', fontSize: 10 }}>–</span>)}
                      </button>
                    )
                  }))}
                </div>
                <div className="grid mt-1" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                  {[1, 2, 3, 4, 5].map(r => <div key={r} className="text-center"><span className="text-[9px]" style={{ color: '#374151' }}>{r}</span></div>)}
                </div>
                <p className="text-center text-[9px] tracking-widest uppercase mt-1" style={{ color: '#374151' }}>Recency →</p>
              </div>
            </div>
          </div>
          <div className="lg:col-span-2 rounded-2xl p-5 space-y-1.5" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
            <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#6B7280' }}>Segments</p>
            {(Object.entries(SEGMENT_CONFIG) as [RFMSegment, typeof SEGMENT_CONFIG[RFMSegment]][]).map(([seg, cfg]) => {
              const count = segmentCounts[seg] || 0
              const pct = customers.length > 0 ? (count / customers.length) * 100 : 0
              const isSelected = selectedSegment === seg
              return (
                <button key={seg} onClick={() => { setSelectedSegment(isSelected ? null : seg); setPage(1) }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left"
                  style={{ background: isSelected ? cfg.bg : 'transparent', border: isSelected ? `1px solid ${cfg.color}40` : '1px solid transparent', opacity: selectedSegment && !isSelected ? 0.4 : 1 }}>
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: cfg.color }} />
                  <span className="text-xs flex-1" style={{ color: isSelected ? '#111827' : '#9CA3AF' }}>{seg}</span>
                  <span className="text-xs font-bold" style={{ color: cfg.color }}>{count}</span>
                  <div className="w-12 h-1.5 rounded-full overflow-hidden flex-shrink-0" style={{ background: '#F9FAFB' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cfg.color }} />
                  </div>
                </button>
              )
            })}
          </div>

          {/* Customer Table */}
          <div className="lg:col-span-5 rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
            <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
              <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#6B7280' }}>Customer List</p>
              {selectedSegment && (
                <button onClick={() => { setSelectedSegment(null); setPage(1) }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold"
                  style={{ background: SEGMENT_CONFIG[selectedSegment].bg, color: SEGMENT_CONFIG[selectedSegment].color, border: `1px solid ${SEGMENT_CONFIG[selectedSegment].color}40` }}>
                  {selectedSegment} <X size={10} />
                </button>
              )}
              <span className="text-[10px]" style={{ color: '#4B5563' }}>{displayedCustomers.length} customers</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                    {['Nama', 'No HP', 'Last Buy', 'Orders', 'Total Spend', 'R', 'F', 'M', 'Segment', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#374151' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageCustomers.map((c, i) => {
                    const cfg = SEGMENT_CONFIG[c.segment]
                    return (
                      <tr key={i} className="transition-all" style={{ borderBottom: '1px solid #E5E7EB' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td className="px-4 py-3 text-sm font-medium cursor-pointer" style={{ color: '#111827' }} onClick={() => setSelectedCustomer(c)}>{c.customerName}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#6B7280' }}>{c.phone || '–'}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#6B7280' }}>{c.lastOrderDate}</td>
                        <td className="px-4 py-3 text-sm font-bold" style={{ color: '#111827' }}>{c.frequency}x</td>
                        <td className="px-4 py-3 text-sm font-bold" style={{ color: '#10B981' }}>{fmtCurrency(c.monetary)}</td>
                        <td className="px-4 py-3"><ScoreBadge score={c.rScore} /></td>
                        <td className="px-4 py-3"><ScoreBadge score={c.fScore} /></td>
                        <td className="px-4 py-3"><ScoreBadge score={c.mScore} /></td>
                        <td className="px-4 py-3"><span className="px-2 py-1 rounded-full text-[10px] font-semibold" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>{c.segment}</span></td>
                        <td className="px-4 py-3">
                          <button onClick={() => { setAddTaskModal({ customer: c }); setTaskForm({ note: SEGMENT_CONFIG[c.segment].action, dueDate: todayStr }) }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all"
                            style={{ background: '#F9FAFB', color: '#6B7280' }}>
                            <Plus size={10} /> Task
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid #E5E7EB' }}>
                <span className="text-[10px]" style={{ color: '#4B5563' }}>{(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, displayedCustomers.length)} of {displayedCustomers.length}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded-lg text-xs disabled:opacity-30" style={{ background: '#F9FAFB', color: '#9CA3AF' }}>← Prev</button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 rounded-lg text-xs disabled:opacity-30" style={{ background: '#F9FAFB', color: '#9CA3AF' }}>Next →</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: PIPELINE ── */}
      {tab === 'pipeline' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['todo', 'ongoing', 'done'] as FollowUpTask['status'][]).map(status => {
            const labels: Record<FollowUpTask['status'], { label: string; color: string }> = {
              todo: { label: 'To Do', color: '#F59E0B' },
              ongoing: { label: 'On Going', color: '#3B82F6' },
              done: { label: 'Done', color: '#10B981' },
            }
            const colTasks = tasks.filter(t => t.status === status)
            const { label, color } = labels[status]
            return (
              <div key={status} className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-xs font-semibold" style={{ color }}>{label}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${color}20`, color }}>{colTasks.length}</span>
                </div>
                <div className="p-3 space-y-2 min-h-32">
                  {colTasks.length === 0 && (
                    <p className="text-center text-xs py-8" style={{ color: '#374151' }}>Tidak ada task</p>
                  )}
                  {colTasks.map(task => {
                    const segCfg = SEGMENT_CONFIG[task.segment]
                    const isOverdue = task.dueDate < todayStr && task.status !== 'done'
                    return (
                      <div key={task.id} className="rounded-xl p-3" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-sm font-semibold" style={{ color: '#111827' }}>{task.customerName}</p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: segCfg.bg, color: segCfg.color }}>{task.segment}</span>
                          </div>
                          <button onClick={() => deleteTask(task.id)} style={{ color: '#374151' }}><X size={12} /></button>
                        </div>
                        <p className="text-xs mb-2" style={{ color: '#9CA3AF' }}>{task.note}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px]" style={{ color: isOverdue ? '#EF4444' : '#4B5563' }}>
                            📅 {task.dueDate}{isOverdue ? ' — Overdue!' : ''}
                          </span>
                          <div className="flex gap-1">
                            {status !== 'todo' && <button onClick={() => updateTaskStatus(task.id, status === 'ongoing' ? 'todo' : 'ongoing')} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#F9FAFB', color: '#6B7280' }}>←</button>}
                            {status !== 'done' && <button onClick={() => updateTaskStatus(task.id, status === 'todo' ? 'ongoing' : 'done')} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#F9FAFB', color: '#6B7280' }}>→</button>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── TAB: ACTION LIST ── */}
      {tab === 'actions' && (
        <div className="space-y-2">
          {(Object.entries(SEGMENT_CONFIG) as [RFMSegment, typeof SEGMENT_CONFIG[RFMSegment]][])
            .filter(([seg]) => (segmentCounts[seg] || 0) > 0)
            .map(([seg, cfg]) => {
              const segCustomers = customers.filter(c => c.segment === seg)
              const isExpanded = expandedSegment === seg
              const search = segmentSearch[seg] || ''
              const currentPage = segmentPage[seg] || 1
              const filtered = segCustomers.filter(c =>
                c.customerName.toLowerCase().includes(search.toLowerCase()) ||
                (c.phone || '').includes(search)
              )
              const totalPg = Math.ceil(filtered.length / ACTION_PER_PAGE)
              const paginated = filtered.slice((currentPage - 1) * ACTION_PER_PAGE, currentPage * ACTION_PER_PAGE)

              return (
                <div key={seg} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${isExpanded ? cfg.color + '40' : '#E5E7EB'}`, background: '#FFFFFF', transition: 'border-color 0.2s' }}>
                  {/* Accordion header */}
                  <button
                    className="w-full flex items-center justify-between px-5 py-4 text-left"
                    style={{ background: isExpanded ? cfg.bg : 'transparent' }}
                    onClick={() => setExpandedSegment(isExpanded ? null : seg)}>
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: cfg.color }} />
                      <span className="text-sm font-bold" style={{ color: cfg.color }}>{seg}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                        {segCustomers.length} customers
                      </span>
                      <span className="text-xs hidden sm:block" style={{ color: '#9CA3AF' }}>💡 {cfg.action}</span>
                    </div>
                    <ChevronDown size={16} style={{ color: cfg.color, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div style={{ borderTop: `1px solid ${cfg.color}20` }}>
                      {/* Search + Export bar */}
                      <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                          <Search size={12} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                          <input
                            value={search}
                            onChange={e => {
                              setSegmentSearch(p => ({ ...p, [seg]: e.target.value }))
                              setSegmentPage(p => ({ ...p, [seg]: 1 }))
                            }}
                            placeholder="Cari nama atau nomor HP..."
                            className="flex-1 text-xs outline-none bg-transparent"
                            style={{ color: '#111827' }} />
                          {search && (
                            <button onClick={() => setSegmentSearch(p => ({ ...p, [seg]: '' }))} style={{ color: '#9CA3AF' }}>
                              <X size={12} />
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => exportSegmentCSV(seg, segCustomers)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all flex-shrink-0"
                          style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#6B7280' }}>
                          <Download size={12} /> Export CSV
                        </button>
                      </div>

                      {/* Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
                              {['Nama', 'No. HP', 'Last Order', 'Sejak', 'Orders', 'Total Spend', 'Action'].map(h => (
                                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#9CA3AF' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {paginated.length === 0 ? (
                              <tr><td colSpan={7} className="px-4 py-8 text-center text-xs" style={{ color: '#9CA3AF' }}>Tidak ada customer ditemukan</td></tr>
                            ) : paginated.map((c, i) => (
                              <tr key={i}
                                style={{ borderBottom: '1px solid #F9FAFB' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <td className="px-4 py-3 text-sm font-medium cursor-pointer" style={{ color: '#111827' }} onClick={() => setSelectedCustomer(c)}>{c.customerName}</td>
                                <td className="px-4 py-3 text-xs" style={{ color: '#6B7280' }}>{c.phone || '–'}</td>
                                <td className="px-4 py-3 text-xs" style={{ color: '#6B7280' }}>{c.lastOrderDate}</td>
                                <td className="px-4 py-3 text-xs font-semibold" style={{ color: c.recencyDays > 60 ? '#EF4444' : '#F59E0B' }}>{c.recencyDays} hari</td>
                                <td className="px-4 py-3 text-sm font-bold" style={{ color: '#111827' }}>{c.frequency}x</td>
                                <td className="px-4 py-3 text-sm font-bold" style={{ color: '#10B981' }}>{fmtCurrency(c.monetary)}</td>
                                <td className="px-4 py-3">
                                  <button
                                    onClick={() => { setAddTaskModal({ customer: c }); setTaskForm({ note: cfg.action, dueDate: todayStr }) }}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                                    style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                                    <Plus size={10} /> Task
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      {totalPg > 1 && (
                        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid #F3F4F6' }}>
                          <span className="text-[10px]" style={{ color: '#9CA3AF' }}>
                            {(currentPage - 1) * ACTION_PER_PAGE + 1}–{Math.min(currentPage * ACTION_PER_PAGE, filtered.length)} dari {filtered.length}
                            {search && ` (filter: "${search}")`}
                          </span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setSegmentPage(p => ({ ...p, [seg]: Math.max(1, currentPage - 1) }))}
                              disabled={currentPage === 1}
                              className="px-3 py-1 rounded-lg text-xs disabled:opacity-30 transition-all"
                              style={{ background: '#F9FAFB', color: '#6B7280' }}>← Prev</button>
                            <span className="text-xs px-2" style={{ color: '#9CA3AF' }}>{currentPage} / {totalPg}</span>
                            <button onClick={() => setSegmentPage(p => ({ ...p, [seg]: Math.min(totalPg, currentPage + 1) }))}
                              disabled={currentPage === totalPg}
                              className="px-3 py-1 rounded-lg text-xs disabled:opacity-30 transition-all"
                              style={{ background: '#F9FAFB', color: '#6B7280' }}>Next →</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      )}

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setSelectedCustomer(null)}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between p-5" style={{ borderBottom: '1px solid #E5E7EB' }}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold" style={{ color: '#111827' }}>{selectedCustomer.customerName}</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: SEGMENT_CONFIG[selectedCustomer.segment].bg, color: SEGMENT_CONFIG[selectedCustomer.segment].color }}>{selectedCustomer.segment}</span>
                </div>
                <p className="text-xs" style={{ color: '#6B7280' }}>{SEGMENT_CONFIG[selectedCustomer.segment].action}</p>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F9FAFB', color: '#6B7280' }}><X size={14} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2"><Phone size={12} style={{ color: '#4B5563' }} /><span className="text-sm" style={{ color: '#9CA3AF' }}>{selectedCustomer.phone || '–'}</span></div>
                <div className="flex items-center gap-2"><Calendar size={12} style={{ color: '#4B5563' }} /><span className="text-sm" style={{ color: '#9CA3AF' }}>Last: {selectedCustomer.lastOrderDate}</span></div>
                <div className="flex items-center gap-2"><ShoppingBag size={12} style={{ color: '#4B5563' }} /><span className="text-sm" style={{ color: '#9CA3AF' }}>{selectedCustomer.frequency}x pembelian</span></div>
                <div className="flex items-center gap-2"><TrendingUp size={12} style={{ color: '#4B5563' }} /><span className="text-sm font-bold" style={{ color: '#10B981' }}>{fmtCurrency(selectedCustomer.monetary)}</span></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[{ label: 'Recency', score: selectedCustomer.rScore, sub: `${selectedCustomer.recencyDays} hari lalu` }, { label: 'Frequency', score: selectedCustomer.fScore, sub: `${selectedCustomer.frequency}x order` }, { label: 'Monetary', score: selectedCustomer.mScore, sub: fmtCurrency(selectedCustomer.monetary) }].map(item => (
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
                  {selectedCustomer.transactions.map((tx, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: '#F9FAFB' }}>
                      <div><p className="text-xs font-medium" style={{ color: '#111827' }}>{tx.product}</p><p className="text-[10px]" style={{ color: '#4B5563' }}>{tx.date} · {tx.qty}x</p></div>
                      <p className="text-sm font-bold" style={{ color: '#10B981' }}>{fmtCurrency(tx.revenue)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {addTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setAddTaskModal(null)}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #E5E7EB' }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: '#111827' }}>Tambah Follow-up Task</h3>
                <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{addTaskModal.customer.customerName} · <span style={{ color: SEGMENT_CONFIG[addTaskModal.customer.segment].color }}>{addTaskModal.customer.segment}</span></p>
              </div>
              <button onClick={() => setAddTaskModal(null)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F9FAFB', color: '#6B7280' }}><X size={14} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-semibold tracking-widest uppercase mb-2 block" style={{ color: '#4B5563' }}>Catatan / Aksi</label>
                <textarea value={taskForm.note} onChange={e => setTaskForm(p => ({ ...p, note: e.target.value }))} rows={3}
                  className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
              </div>
              <div>
                <label className="text-[10px] font-semibold tracking-widest uppercase mb-2 block" style={{ color: '#4B5563' }}>Due Date</label>
                <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm(p => ({ ...p, dueDate: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
              </div>
              <button onClick={() => addTask(addTaskModal.customer)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: accent, color: '#FFFFFF', boxShadow: `0 0 20px ${accent}60` }}>
                Tambah Task
              </button>
            </div>
          </div>
        </div>
      )}
      </>}

      {/* CRM Manual Input Modal — shown in both empty and filled state */}
      {crmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
              <div>
                <p className="font-semibold" style={{ color: '#111827' }}>Input Manual — CRM</p>
                <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Tambah transaksi customer</p>
              </div>
              <button onClick={() => setCrmModal(false)} style={{ color: '#6B7280' }}><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: '#4B5563' }}>Tanggal</label>
                  <input type="date" value={crmDate} onChange={e => setCrmDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: '#4B5563' }}>Nama Customer</label>
                  <input value={crmCustomer} onChange={e => setCrmCustomer(e.target.value)} placeholder="Siti Rahma"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: '#4B5563' }}>No. HP</label>
                <input value={crmPhone} onChange={e => setCrmPhone(e.target.value)} placeholder="081234567890"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
              </div>

              {/* Product lines */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#6B7280' }}>Produk</p>
                  <button onClick={addCrmLine} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: `rgba(${brand === 'reglow' ? '201,169,110' : '143,176,80'},0.1)`, color: accent }}>
                    <Plus size={11} /> Tambah Baris
                  </button>
                </div>
                <div className="space-y-2">
                  {crmLines.map((line, idx) => (
                    <div key={idx} className="grid gap-2 items-end" style={{ gridTemplateColumns: '2fr 70px 120px 32px' }}>
                      <div>
                        {idx === 0 && <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: '#4B5563' }}>Produk</label>}
                        <select value={line.sku} onChange={e => pickCrmProduct(idx, e.target.value)}
                          disabled={brandProducts.length === 0}
                          className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                          style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: brandProducts.length === 0 ? '#9CA3AF' : '#111827', cursor: brandProducts.length === 0 ? 'not-allowed' : 'pointer' }}>
                          <option value="">{brandProducts.length === 0 ? '— Isi Product Master dulu —' : '— Pilih produk —'}</option>
                          {brandProducts.map(p => <option key={p.sku} value={p.sku}>{p.name}</option>)}
                        </select>
                      </div>
                      <div>
                        {idx === 0 && <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: '#4B5563' }}>Qty</label>}
                        <input type="number" min="1" value={line.qty} onChange={e => updateCrmLine(idx, 'qty', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                          style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827' }} />
                      </div>
                      <div>
                        {idx === 0 && <label className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: '#4B5563' }}>Revenue (Rp)</label>}
                        <input type="number" value={line.revenue} onChange={e => updateCrmLine(idx, 'revenue', e.target.value)}
                          placeholder={line.sku ? 'Auto' : '150000'}
                          readOnly={!!line.sku}
                          className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                          style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827', opacity: line.sku ? 0.6 : 1 }} />
                      </div>
                      <button onClick={() => removeCrmLine(idx)} disabled={crmLines.length === 1}
                        className="pb-0.5" style={{ color: crmLines.length === 1 ? '#374151' : '#6B7280' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setCrmModal(false)} className="px-5 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#9CA3AF' }}>
                  Batal
                </button>
                <button onClick={saveCrmManual} className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: `rgba(${brand === 'reglow' ? '201,169,110' : '143,176,80'},0.2)`, border: `1px solid rgba(${brand === 'reglow' ? '201,169,110' : '143,176,80'},0.4)`, color: accent }}>
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {validationModal && (
        <CSVValidationModal
          title="CRM"
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

function ScoreBadge({ score }: { score: number }) {
  return <span className="inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold" style={{ background: `${scoreColor(score)}20`, color: scoreColor(score) }}>{score}</span>
}

function scoreColor(score: number): string {
  if (score >= 5) return '#10B981'
  if (score >= 4) return '#3B82F6'
  if (score >= 3) return '#F59E0B'
  if (score >= 2) return '#F07830'
  return '#EF4444'
}

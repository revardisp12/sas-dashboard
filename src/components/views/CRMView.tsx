'use client'
import { useState, useMemo, useEffect } from 'react'
import { CRMRow, Brand, CRMTimeframe, CustomerRFM, RFMSegment, FollowUpTask, ProductMaster, BundleMaster } from '@/lib/types'
import { fmtCurrency, fmtNum } from '@/lib/utils'
import { loadTasks, saveTasks } from '@/lib/storage'
import CSVUploader from '@/components/CSVUploader'
import CSVValidationModal, { validateProductField, InvalidRow } from '@/components/CSVValidationModal'
import { parseCRM } from '@/lib/csvParser'
import { Users, Plus, ChevronRight } from 'lucide-react'
import { BRAND_COLORS } from '@/lib/brand'
import { filterByDaysCRM, calcRFM } from '@/lib/rfm'
import RFMMatrixTab from './crm/RFMMatrixTab'
import PipelineTab from './crm/PipelineTab'
import ActionListTab from './crm/ActionListTab'
import CustomerDetailModal from './crm/CustomerDetailModal'
import AddTaskModal from './crm/AddTaskModal'
import CRMManualInputModal from './crm/CRMManualInputModal'

const BRAND_RGB: Record<Brand, string> = { reglow: '201,169,110', amura: '143,176,80', purela: '155,127,212' }

const TIMEFRAME_OPTIONS: { label: string; value: CRMTimeframe }[] = [
  { label: '30H', value: 30 }, { label: '90H', value: 90 },
  { label: '180H', value: 180 }, { label: '1 Tahun', value: 365 }, { label: 'All', value: 0 },
]

type Tab = 'rfm' | 'pipeline' | 'actions'

interface AddTaskTarget {
  customer: CustomerRFM
  initialNote: string
  initialDueDate: string
}

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
  const accent = BRAND_COLORS[brand]
  const rgb = BRAND_RGB[brand]
  const [timeframe, setTimeframe] = useState<CRMTimeframe>(90)
  const [tab, setTab] = useState<Tab>('rfm')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRFM | null>(null)
  const [tasks, setTasks] = useState<FollowUpTask[]>([])
  const [addTaskTarget, setAddTaskTarget] = useState<AddTaskTarget | null>(null)
  const [crmModal, setCrmModal] = useState(false)
  const [validationModal, setValidationModal] = useState<{
    validRows: CRMRow[]
    invalidRows: InvalidRow[]
  } | null>(null)

  const brandProducts = products.filter(p => p.brand === brand)
  const brandBundles = bundles.filter(b => b.brand === brand)

  useEffect(() => { setTasks(loadTasks().filter(t => t.brand === brand)) }, [brand])

  const filtered = useMemo(() => filterByDaysCRM(data, timeframe), [data, timeframe])
  const customers = useMemo(() => calcRFM(filtered), [filtered])

  const matrixCount = useMemo(() => {
    const m: Record<string, number> = {}
    customers.forEach(c => { m[`${c.rScore}-${c.fScore}`] = (m[`${c.rScore}-${c.fScore}`] || 0) + 1 })
    return m
  }, [customers])

  const segmentCounts = useMemo(() => {
    const s: Record<RFMSegment, number> = {} as Record<RFMSegment, number>
    customers.forEach(c => { s[c.segment] = (s[c.segment] || 0) + 1 })
    return s
  }, [customers])

  const todayStr = new Date().toISOString().split('T')[0]
  const todayTasks = tasks.filter(t => t.dueDate === todayStr && t.status !== 'done')

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

  function updateTaskStatus(id: string, status: FollowUpTask['status']) {
    const allTasks = loadTasks()
    const updated = allTasks.map(t => t.id === id ? { ...t, status } : t)
    saveTasks(updated)
    setTasks(updated.filter(t => t.brand === brand))
  }

  function deleteTask(id: string) {
    const allTasks = loadTasks()
    const updated = allTasks.filter(t => t.id !== id)
    saveTasks(updated)
    setTasks(updated.filter(t => t.brand === brand))
  }

  function addTask(customer: CustomerRFM, note: string, dueDate: string) {
    const allTasks = loadTasks()
    const newTask: FollowUpTask = {
      id: Date.now().toString(),
      customerName: customer.customerName,
      phone: customer.phone,
      segment: customer.segment,
      note,
      dueDate,
      status: 'todo',
      brand,
      createdAt: new Date().toISOString(),
    }
    const updated = [...allTasks, newTask]
    saveTasks(updated)
    setTasks(updated.filter(t => t.brand === brand))
    setAddTaskTarget(null)
  }

  function openAddTask(customer: CustomerRFM, note: string) {
    setAddTaskTarget({ customer, initialNote: note, initialDueDate: todayStr })
  }

  function handleCrmManualSave(rows: CRMRow[]) {
    onManualAdd?.(rows)
    setCrmModal(false)
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#4B5563' }}>Sales Retention by CRM</p>
            <p className="text-sm" style={{ color: '#4B5563' }}>Upload data transaksi CS untuk mulai analisis RFM</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setCrmModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0"
              style={{ background: `rgba(${rgb},0.15)`, border: `1px solid rgba(${rgb},0.3)`, color: accent }}>
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

        {crmModal && (
          <CRMManualInputModal brand={brand} accent={accent} brandProducts={brandProducts}
            onSave={handleCrmManualSave} onClose={() => setCrmModal(false)} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
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
            style={{ background: `rgba(${rgb},0.15)`, border: `1px solid rgba(${rgb},0.3)`, color: accent }}>
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

      {/* Tab content */}
      {tab === 'rfm' && (
        <RFMMatrixTab
          customers={customers}
          segmentCounts={segmentCounts}
          matrixCount={matrixCount}
          todayStr={todayStr}
          onCustomerClick={setSelectedCustomer}
          onAddTaskClick={openAddTask}
        />
      )}
      {tab === 'pipeline' && (
        <PipelineTab
          tasks={tasks}
          todayStr={todayStr}
          onDeleteTask={deleteTask}
          onUpdateStatus={updateTaskStatus}
        />
      )}
      {tab === 'actions' && (
        <ActionListTab
          customers={customers}
          segmentCounts={segmentCounts}
          todayStr={todayStr}
          onCustomerClick={setSelectedCustomer}
          onAddTaskClick={openAddTask}
        />
      )}

      {/* Modals */}
      {selectedCustomer && (
        <CustomerDetailModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
      {addTaskTarget && (
        <AddTaskModal
          customer={addTaskTarget.customer}
          accent={accent}
          initialNote={addTaskTarget.initialNote}
          initialDueDate={addTaskTarget.initialDueDate}
          onSave={(note, dueDate) => addTask(addTaskTarget.customer, note, dueDate)}
          onClose={() => setAddTaskTarget(null)}
        />
      )}
      {crmModal && (
        <CRMManualInputModal brand={brand} accent={accent} brandProducts={brandProducts}
          onSave={handleCrmManualSave} onClose={() => setCrmModal(false)} />
      )}
      {validationModal && (
        <CSVValidationModal
          title="CRM"
          brand={brand}
          validCount={validationModal.validRows.length}
          invalidRows={validationModal.invalidRows}
          onConfirm={async () => {
            await onBulkUpload?.(validationModal.validRows)
            setValidationModal(null)
          }}
          onClose={() => setValidationModal(null)}
        />
      )}
    </div>
  )
}

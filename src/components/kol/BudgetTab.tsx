'use client'
import { useState, useEffect, type CSSProperties } from 'react'
import type { Brand } from '@/lib/types'
import type { KolBudget, KolCampaign, KolContent } from '@/lib/kol/types'
import {
  getBudgets, upsertBudget, deleteBudget,
  getCampaigns, getContents,
} from '@/lib/kol/db'
import { btnPrimary } from '@/components/kol/BulkUploadBox'

// ── colour tokens (match kol-preview) ──
const C = {
  bg: '#F8F9FC', card: '#FFFFFF', border: '#E5E7EB',
  text: '#111827', sub: '#6B7280', cyan: '#0EA5E9',
  green: '#10B981', amber: '#F59E0B', red: '#EF4444',
}

const rp = (n: number) => 'Rp' + n.toLocaleString('id-ID')

const btnEdit: CSSProperties = {
  fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 6,
  background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB', cursor: 'pointer',
}
const btnDanger: CSSProperties = {
  fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 6,
  background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', cursor: 'pointer',
}

interface BudgetForm { id?: string; name: string; nominal: string }
const BLANK_FORM: BudgetForm = { name: '', nominal: '' }

export default function BudgetTab({ brand }: { brand: Brand }) {
  const [budgets, setBudgets] = useState<KolBudget[]>([])
  const [campaigns, setCampaigns] = useState<KolCampaign[]>([])
  const [contents, setContents] = useState<KolContent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<BudgetForm>(BLANK_FORM)
  const [saving, setSaving] = useState(false)

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [b, ca, co] = await Promise.all([
        getBudgets(brand),
        getCampaigns(brand),
        getContents(brand),
      ])
      setBudgets(b)
      setCampaigns(ca)
      setContents(co)
    } catch (e) {
      setError(`Gagal load data: ${e instanceof Error ? e.message : String(e)}`)
    }
    setLoading(false)
  }

  // Load budgets + campaigns + contents on mount (external DB).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAll() }, [brand])

  // ── utilization: sum of fees for all contents whose campaign belongs to this budget ──
  function usedForBudget(budget: KolBudget): number {
    const campaignIds = new Set(
      campaigns.filter(ca => ca.budgetId === budget.id).map(ca => ca.id)
    )
    return contents
      .filter(co => co.campaignId !== null && campaignIds.has(co.campaignId))
      .reduce((sum, co) => sum + co.fee, 0)
  }

  function openAdd() { setForm(BLANK_FORM); setShowForm(true); setError(null) }

  function openEdit(b: KolBudget) {
    setForm({ id: b.id, name: b.name, nominal: String(b.nominal) })
    setShowForm(true)
    setError(null)
  }

  function closeForm() { setShowForm(false); setForm(BLANK_FORM); setError(null) }

  async function handleSave() {
    if (!form.name.trim()) { setError('Nama budget wajib diisi'); return }
    setSaving(true)
    setError(null)
    try {
      await upsertBudget(
        { id: form.id, name: form.name.trim(), nominal: Number(form.nominal) || 0 },
        brand,
      )
      closeForm()
      await loadAll()
    } catch (e) {
      setError(`Gagal simpan: ${e instanceof Error ? e.message : String(e)}`)
    }
    setSaving(false)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus budget "${name}"?`)) return
    setError(null)
    try {
      await deleteBudget(id)
      await loadAll()
    } catch (e) {
      setError(`Gagal hapus: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <div>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Budget</h2>
        <button onClick={openAdd} style={btnPrimary}>+ Tambah Budget</button>
      </div>

      {/* error */}
      {error && (
        <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* add / edit form */}
      {showForm && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: C.text }}>
            {form.id ? 'Edit Budget' : 'Tambah Budget'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.sub, display: 'block', marginBottom: 4 }}>Nama Budget</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Reglow Q2 2026"
                style={{ width: '100%', fontSize: 13, padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, color: C.text, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.sub, display: 'block', marginBottom: 4 }}>Nominal (Rp)</label>
              <input
                type="number"
                value={form.nominal}
                onChange={e => setForm(f => ({ ...f, nominal: e.target.value }))}
                placeholder="50000000"
                style={{ width: '100%', fontSize: 13, padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, color: C.text, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
            <button onClick={closeForm} style={btnEdit}>Batal</button>
            <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>
      )}

      {/* budget cards */}
      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: C.sub, fontSize: 13 }}>Memuat data…</div>
      ) : budgets.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: C.sub, fontSize: 13 }}>
          Belum ada budget. Tambah budget pertama sekarang.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {budgets.map(b => {
            const used = usedForBudget(b)
            const pct = b.nominal > 0 ? Math.min(100, Math.round((used / b.nominal) * 100)) : 0
            const over = b.nominal > 0 && used > b.nominal
            const barColor = over ? C.red : pct > 80 ? C.amber : C.green

            return (
              <div key={b.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{b.name}</p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(b)} style={btnEdit}>Edit</button>
                    <button onClick={() => handleDelete(b.id, b.name)} style={btnDanger}>Hapus</button>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: C.sub, marginBottom: 14 }}>Total: {rp(b.nominal)}</p>
                <div style={{ height: 10, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ width: pct + '%', height: '100%', background: barColor, borderRadius: 999, transition: 'width 0.3s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: C.sub }}>
                    Terpakai <b style={{ color: C.text }}>{rp(used)}</b> ({pct}%)
                  </span>
                  <span style={{ color: over ? C.red : C.green, fontWeight: 600 }}>
                    {over ? 'Over budget!' : `Sisa ${rp(b.nominal - used)}`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

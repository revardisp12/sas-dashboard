'use client'
import { useState, useEffect, type CSSProperties } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import type { Brand } from '@/lib/types'
import type { KolCampaign, KolContent, KolInfluencer, KolBudget, Tier } from '@/lib/kol/types'
import {
  getCampaigns, upsertCampaign, deleteCampaign,
  getBudgets, getInfluencers, getContents,
} from '@/lib/kol/db'
import { TIER, awarenessSig, considerationSig, tierTotals } from '@/lib/kol/funnel'
import { btnPrimary, btnOutline } from '@/components/kol/BulkUploadBox'

// ── colour tokens ──
const C = {
  bg: '#F8F9FC', card: '#FFFFFF', border: '#E5E7EB',
  text: '#111827', sub: '#6B7280', cyan: '#0EA5E9', orange: '#F07830',
}

// ── helpers ──
const fmt = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + 'jt' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'rb' : String(n)
const rp = (n: number) => 'Rp' + n.toLocaleString('id-ID')

const btnEdit: CSSProperties = {
  fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 6,
  background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB', cursor: 'pointer',
}
const btnDanger: CSSProperties = {
  fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 6,
  background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', cursor: 'pointer',
}

// ── form shape ──
interface CampaignForm {
  id?: string
  name: string
  budgetId: string
  periodStart: string
  periodEnd: string
  description: string
  status: 'active' | 'ended'
}
const BLANK_FORM: CampaignForm = {
  name: '', budgetId: '', periodStart: '', periodEnd: '', description: '', status: 'active',
}

// ── sub-components ──
function Card({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)', ...style,
    }}>
      {children}
    </div>
  )
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <Card style={{ padding: 16, flex: 1, minWidth: 150 }}>
      <p style={{ fontSize: 12, color: C.sub, marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 800, color }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{sub}</p>}
    </Card>
  )
}

function TierCard({ tier, value, count, soon }: { tier: Tier; value: string; count: number; soon?: boolean }) {
  const m = TIER[tier]
  return (
    <Card style={{ padding: 16, flex: 1, minWidth: 180, borderTop: `3px solid ${m.color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 999, background: m.bg, color: m.fg, fontWeight: 700 }}>
          {m.label}
        </span>
        <span style={{ fontSize: 10, color: C.sub }}>{count} konten objektif ini</span>
      </div>
      <p style={{ fontSize: 24, fontWeight: 800, color: m.color }}>{soon ? '—' : value}</p>
      <p style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{m.desc}{soon ? ' · segera' : ''}</p>
    </Card>
  )
}

function Field({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: C.sub, display: 'block', marginBottom: 4 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', fontSize: 13, padding: '7px 10px', borderRadius: 8,
          border: `1px solid ${C.border}`, color: C.text, outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

// ── trend grouping ──
interface TrendPoint { d: string; awareness: number; consideration: number }

function buildTrend(live: KolContent[]): TrendPoint[] {
  const map = new Map<string, TrendPoint>()
  for (const c of live) {
    if (!c.postedAt) continue
    // normalise to date-only (YYYY-MM-DD or MM-DD both work as string keys)
    const d = c.postedAt.slice(0, 10)
    const prev = map.get(d) ?? { d, awareness: 0, consideration: 0 }
    map.set(d, {
      d,
      awareness: prev.awareness + awarenessSig(c),
      consideration: prev.consideration + considerationSig(c),
    })
  }
  return [...map.values()].sort((a, b) => a.d.localeCompare(b.d))
}

// ── main component ──
export default function CampaignTab({ brand }: { brand: Brand }) {
  const [campaigns, setCampaigns] = useState<KolCampaign[]>([])
  const [budgets, setBudgets] = useState<KolBudget[]>([])
  const [influencers, setInfluencers] = useState<KolInfluencer[]>([])
  const [contents, setContents] = useState<KolContent[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [contentsLoading, setContentsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CampaignForm>(BLANK_FORM)
  const [saving, setSaving] = useState(false)

  // ── load on mount ──
  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [cams, buds, infs] = await Promise.all([
        getCampaigns(brand),
        getBudgets(brand),
        getInfluencers(brand),
      ])
      setCampaigns(cams)
      setBudgets(buds)
      setInfluencers(infs)
      // default selection: first active, otherwise first
      const defaultCam =
        cams.find(c => c.status === 'active') ?? cams[0] ?? null
      setSelectedId(defaultCam?.id ?? null)
    } catch (e) {
      setError(`Gagal load data: ${e instanceof Error ? e.message : String(e)}`)
    }
    setLoading(false)
  }

  // Load campaigns + budgets + influencers on mount (external DB).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAll() }, [brand])

  // load contents whenever selectedId changes
  useEffect(() => {
    if (!selectedId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContents([])
      return
    }
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContentsLoading(true)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null)
    getContents(brand, selectedId)
      .then(data => { if (!cancelled) setContents(data) })
      .catch(e => { if (!cancelled) setError(`Gagal load konten: ${e instanceof Error ? e.message : String(e)}`) })
      .finally(() => { if (!cancelled) setContentsLoading(false) })
    return () => { cancelled = true }
  }, [brand, selectedId])

  // ── helpers ──
  const nameOf = (id: string | null) =>
    id ? (influencers.find(i => i.id === id)?.name ?? '—') : '—'

  const budgetNameOf = (id: string | null) =>
    id ? (budgets.find(b => b.id === id)?.name ?? null) : null

  const selectedCampaign = campaigns.find(c => c.id === selectedId) ?? null

  // ── form handlers ──
  function openAdd() {
    setForm(BLANK_FORM)
    setShowForm(true)
    setError(null)
  }

  function openEdit(cam: KolCampaign) {
    setForm({
      id: cam.id,
      name: cam.name,
      budgetId: cam.budgetId ?? '',
      periodStart: cam.periodStart ?? '',
      periodEnd: cam.periodEnd ?? '',
      description: cam.description,
      status: cam.status,
    })
    setShowForm(true)
    setError(null)
  }

  function closeForm() {
    setShowForm(false)
    setForm(BLANK_FORM)
    setError(null)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Nama campaign wajib diisi'); return }
    setSaving(true)
    setError(null)
    try {
      await upsertCampaign(
        {
          id: form.id,
          name: form.name.trim(),
          budgetId: form.budgetId || null,
          periodStart: form.periodStart || null,
          periodEnd: form.periodEnd || null,
          description: form.description.trim(),
          status: form.status,
        },
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
    if (!confirm(`Hapus campaign "${name}"?`)) return
    setError(null)
    try {
      await deleteCampaign(id)
      if (selectedId === id) setSelectedId(null)
      await loadAll()
    } catch (e) {
      setError(`Gagal hapus: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ── analytics ──
  const live = contents.filter(c => c.status === 'uploaded')
  const totals = tierTotals(live)
  const totViews = live.reduce((s, c) => s + c.views, 0)
  const totFee = live.reduce((s, c) => s + c.fee, 0)
  const cpv = totViews > 0 ? totFee / totViews : 0
  const cntTier = (t: Tier) => live.filter(c => c.objective === t).length
  const board = [...live].sort((a, b) => b.views - a.views)
  const trend = buildTrend(live)

  // ── render ──
  if (loading) {
    return <div style={{ padding: '40px 0', textAlign: 'center', color: C.sub, fontSize: 13 }}>Memuat data…</div>
  }

  return (
    <div>
      {/* ── header row ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Campaign</h2>
        <button onClick={openAdd} style={btnPrimary}>+ Tambah Campaign</button>
      </div>

      {/* ── error banner ── */}
      {error && (
        <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* ── add / edit form ── */}
      {showForm && (
        <Card style={{ padding: 18, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: C.text }}>
            {form.id ? 'Edit Campaign' : 'Tambah Campaign'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Nama Campaign" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Reglow Glow-Up Juni 2026" />
            {/* budget select */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.sub, display: 'block', marginBottom: 4 }}>Budget (opsional)</label>
              <select
                value={form.budgetId}
                onChange={e => setForm(f => ({ ...f, budgetId: e.target.value }))}
                style={{ width: '100%', fontSize: 13, padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, color: C.text, outline: 'none' }}
              >
                <option value="">— Tidak ada —</option>
                {budgets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <Field label="Mulai" value={form.periodStart} onChange={v => setForm(f => ({ ...f, periodStart: v }))} type="date" />
            <Field label="Selesai" value={form.periodEnd} onChange={v => setForm(f => ({ ...f, periodEnd: v }))} type="date" />
            {/* status */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.sub, display: 'block', marginBottom: 4 }}>Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as 'active' | 'ended' }))}
                style={{ width: '100%', fontSize: 13, padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, color: C.text, outline: 'none' }}
              >
                <option value="active">Active</option>
                <option value="ended">Ended</option>
              </select>
            </div>
            {/* description full-width */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.sub, display: 'block', marginBottom: 4 }}>Deskripsi</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Tujuan, target audiens, catatan campaign…"
                rows={2}
                style={{
                  width: '100%', fontSize: 13, padding: '7px 10px', borderRadius: 8,
                  border: `1px solid ${C.border}`, color: C.text, outline: 'none',
                  boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
            <button onClick={closeForm} style={btnEdit}>Batal</button>
            <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </Card>
      )}

      {/* ── no campaigns empty state ── */}
      {campaigns.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: C.sub, fontSize: 13 }}>
          Belum ada campaign, tambah dulu.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* ── campaign selector ── */}
          <div style={{ width: 240, flexShrink: 0 }}>
            <Card style={{ overflow: 'hidden' }}>
              {campaigns.map((cam, i) => {
                const isActive = cam.status === 'active'
                const isSelected = cam.id === selectedId
                return (
                  <div
                    key={cam.id}
                    onClick={() => { setSelectedId(cam.id); setShowForm(false) }}
                    style={{
                      padding: '10px 14px',
                      borderTop: i ? `1px solid ${C.border}` : 'none',
                      cursor: 'pointer',
                      background: isSelected ? '#F0F9FF' : C.card,
                      borderLeft: isSelected ? `3px solid ${C.cyan}` : '3px solid transparent',
                    }}
                  >
                    <p style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>{cam.name}</p>
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 999, fontWeight: 700,
                      background: isActive ? '#DCFCE7' : '#F3F4F6',
                      color: isActive ? '#166534' : C.sub,
                    }}>
                      {isActive ? '● Active' : 'Ended'}
                    </span>
                  </div>
                )
              })}
            </Card>
          </div>

          {/* ── campaign detail ── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {selectedCampaign ? (
              <>
                {/* campaign title row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: C.text }}>
                    {selectedCampaign.name}
                  </h3>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600,
                    background: selectedCampaign.status === 'active' ? '#DCFCE7' : '#F3F4F6',
                    color: selectedCampaign.status === 'active' ? '#166534' : C.sub,
                  }}>
                    {selectedCampaign.status === 'active' ? '● Active' : 'Ended'}
                  </span>
                  {(selectedCampaign.periodStart || selectedCampaign.periodEnd) && (
                    <span style={{ fontSize: 12, color: C.sub }}>
                      {selectedCampaign.periodStart ?? '?'} – {selectedCampaign.periodEnd ?? '?'}
                    </span>
                  )}
                  {budgetNameOf(selectedCampaign.budgetId) && (
                    <span style={{ fontSize: 12, color: C.sub }}>
                      · Budget: {budgetNameOf(selectedCampaign.budgetId)}
                    </span>
                  )}
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(selectedCampaign)} style={btnOutline}>Edit</button>
                    <button onClick={() => handleDelete(selectedCampaign.id, selectedCampaign.name)} style={btnDanger}>Hapus</button>
                  </div>
                </div>

                {contentsLoading ? (
                  <div style={{ padding: '32px 0', textAlign: 'center', color: C.sub, fontSize: 13 }}>Memuat konten…</div>
                ) : (
                  <>
                    {/* funnel explanation */}
                    <p style={{ fontSize: 12, color: C.sub, marginBottom: 8 }}>
                      Sinyal engagement dipecah per <b>funnel tier</b> — tiap konten punya objektif sendiri, jadi bisa cek konten mana yang nampol di tier-nya.
                    </p>

                    {/* ── funnel tier cards ── */}
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                      <TierCard tier="awareness" value={fmt(totals.awareness)} count={cntTier('awareness')} />
                      <TierCard tier="consideration" value={fmt(totals.consideration)} count={cntTier('consideration')} />
                      <TierCard tier="action" value="" count={cntTier('action')} soon />
                    </div>

                    {/* ── efficiency row ── */}
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                      <Kpi label="Total Views / Reach" value={fmt(totViews)} sub={`${live.length} konten tayang`} color={C.cyan} />
                      <Kpi label="Total Fee" value={rp(totFee)} sub="alokasi terpakai" color={C.text} />
                      <Kpi label="CPV" value={rp(Math.round(cpv))} sub="cost per view" color={C.orange} />
                    </div>

                    {/* ── trend + leaderboard ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
                      {/* trend chart */}
                      <Card style={{ padding: 16 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Tren Sinyal per Tier</p>
                        {trend.length === 0 ? (
                          <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.sub, fontSize: 13 }}>
                            Belum ada data (konten belum ada tanggal tayang)
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height={240}>
                            <LineChart data={trend} margin={{ left: -10, right: 8, top: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                              <XAxis dataKey="d" tick={{ fontSize: 11, fill: C.sub }} />
                              <YAxis tick={{ fontSize: 11, fill: C.sub }} tickFormatter={fmt} />
                              <Tooltip
                                contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}` }}
                                formatter={(value) => fmt(Number(value ?? 0))}
                              />
                              <Line
                                type="monotone" dataKey="awareness" stroke={TIER.awareness.color}
                                strokeWidth={2.5} dot={false} name="Awareness"
                              />
                              <Line
                                type="monotone" dataKey="consideration" stroke={TIER.consideration.color}
                                strokeWidth={2.5} dot={false} name="Consideration"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        )}
                      </Card>

                      {/* leaderboard */}
                      <Card style={{ padding: 16 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>🏆 Leaderboard KOL</p>
                        <p style={{ fontSize: 11, color: C.sub, marginBottom: 10 }}>diranking dari total views</p>
                        {board.length === 0 ? (
                          <div style={{ padding: '24px 0', textAlign: 'center', color: C.sub, fontSize: 13 }}>
                            Belum ada konten tayang.
                          </div>
                        ) : board.map((c, i) => {
                          const m = TIER[c.objective]
                          return (
                            <div
                              key={c.id}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '8px 0', borderTop: i ? `1px solid ${C.border}` : 'none',
                              }}
                            >
                              <span style={{
                                width: 22, height: 22, borderRadius: 999, flexShrink: 0,
                                background: i === 0 ? '#FEF3C7' : '#F3F4F6',
                                color: i === 0 ? '#92400E' : C.sub,
                                fontSize: 12, fontWeight: 700, display: 'grid', placeItems: 'center',
                              }}>
                                {i + 1}
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {nameOf(c.influencerId)}
                                </p>
                                <p style={{ fontSize: 11 }}>
                                  <span style={{ color: m.fg, fontWeight: 600 }}>{m.label}</span>
                                  <span style={{ color: C.sub }}> · {c.platform}</span>
                                </p>
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: C.cyan, flexShrink: 0 }}>
                                {fmt(c.views)}
                              </span>
                            </div>
                          )
                        })}
                      </Card>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div style={{ padding: '40px 0', textAlign: 'center', color: C.sub, fontSize: 13 }}>
                Pilih campaign di sebelah kiri untuk melihat detail.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

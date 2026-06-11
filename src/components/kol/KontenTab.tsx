'use client'
import { useState, useEffect, useRef, type CSSProperties, type ChangeEvent } from 'react'
import Papa from 'papaparse'
import type { Brand } from '@/lib/types'
import type { KolContent, KolInfluencer, KolCampaign, Tier } from '@/lib/kol/types'
import {
  getContents,
  getInfluencers,
  getCampaigns,
  upsertContent,
  deleteContent,
  bulkInsertContents,
} from '@/lib/kol/db'
import { TIER } from '@/lib/kol/funnel'
import { BulkUploadBox, btnPrimary, btnOutline } from '@/components/kol/BulkUploadBox'
import { supabase } from '@/lib/supabase'

// ── colour tokens ──
const C = {
  card: '#FFFFFF', border: '#E5E7EB',
  text: '#111827', sub: '#6B7280', cyan: '#0EA5E9', green: '#10B981',
}

// ── platform helpers ──
const PLATFORM_SHORT: Record<string, string> = { Instagram: 'IG', TikTok: 'TT', YouTube: 'YT' }
const PLATFORM_COLOR: Record<string, string> = { Instagram: '#E1306C', TikTok: '#111827', YouTube: '#FF0000' }

// ── number formatters ──
const fmt = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + 'jt' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'rb' : String(n)
const rp = (n: number) => 'Rp' + n.toLocaleString('id-ID')

// ── shared button styles ──
const btnEdit: CSSProperties = {
  fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 6,
  background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB', cursor: 'pointer',
}
const btnDanger: CSSProperties = {
  fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 6,
  background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', cursor: 'pointer',
}

// ── form shape ──
interface ContentForm {
  id?: string
  campaignId: string
  influencerId: string
  platform: string
  objective: Tier
  product: string
  task: string
  contentUrl: string
  fee: string
  status: KolContent['status']
  postedAt: string
  // manual metric fields
  views: string
  likes: string
  comments: string
  saved: string
  shares: string
}

const BLANK_FORM: ContentForm = {
  campaignId: '', influencerId: '', platform: 'Instagram', objective: 'awareness',
  product: '', task: '', contentUrl: '', fee: '', status: 'pending', postedAt: '',
  views: '', likes: '', comments: '', saved: '', shares: '',
}

// ── sub-components ──
function Badge({ text, bg, color }: { text: string; bg: string; color: string }) {
  return (
    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, background: bg, color, fontWeight: 600 }}>
      {text}
    </span>
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

// ── auto-pull helper ──
interface FetchedMetrics { likes: number; comments: number; saved: number; shares: number; views: number }
async function pullMetrics(contentUrl: string, platform: string): Promise<FetchedMetrics | null> {
  const { data: sessionData } = await supabase.auth.getSession()
  const jwt = sessionData?.session?.access_token
  if (!jwt) return null
  try {
    const res = await fetch('/api/kol/pull-metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ url: contentUrl, platform }),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { metrics: FetchedMetrics | null }
    return json.metrics ?? null
  } catch {
    return null
  }
}

// ── status badge ──
function StatusBadge({ status }: { status: KolContent['status'] }) {
  if (status === 'uploaded') return <Badge text="uploaded" bg="#DCFCE7" color="#166534" />
  if (status === 'pending') return <Badge text="pending" bg="#FEF3C7" color="#92400E" />
  return <Badge text="broken" bg="#FEE2E2" color="#991B1B" />
}

// ── main component ──
export default function KontenTab({ brand }: { brand: Brand }) {
  const [contents, setContents] = useState<KolContent[]>([])
  const [influencers, setInfluencers] = useState<KolInfluencer[]>([])
  const [campaigns, setCampaigns] = useState<KolCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ContentForm>(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [bulk, setBulk] = useState(false)

  // bulk link state
  const [bulkLinks, setBulkLinks] = useState('')
  const [bulkCampaignId, setBulkCampaignId] = useState('')
  const [bulkObjective, setBulkObjective] = useState<Tier>('awareness')
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkMsg, setBulkMsg] = useState<string | null>(null)

  // CSV file ref for bulk CSV
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [c, inf, cam] = await Promise.all([
        getContents(brand),
        getInfluencers(brand),
        getCampaigns(brand),
      ])
      setContents(c)
      setInfluencers(inf)
      setCampaigns(cam)
    } catch (e) {
      setError(`Gagal load data: ${e instanceof Error ? e.message : String(e)}`)
    }
    setLoading(false)
  }

  // Load all data on mount — reads from external DB.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAll() }, [brand])

  const nameOf = (id: string | null) =>
    id ? (influencers.find(i => i.id === id)?.name ?? '—') : '—'

  // ── form handlers ──
  function openAdd() {
    setForm(BLANK_FORM)
    setShowForm(true)
    setError(null)
  }

  function openEdit(c: KolContent) {
    setForm({
      id: c.id,
      campaignId: c.campaignId ?? '',
      influencerId: c.influencerId ?? '',
      platform: c.platform || 'Instagram',
      objective: c.objective,
      product: c.product,
      task: c.task,
      contentUrl: c.contentUrl,
      fee: String(c.fee || ''),
      status: c.status,
      postedAt: c.postedAt ?? '',
      views: String(c.views || ''),
      likes: String(c.likes || ''),
      comments: String(c.comments || ''),
      saved: String(c.saved || ''),
      shares: String(c.shares || ''),
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
    setSaving(true)
    setError(null)
    try {
      let metricsSource: 'api' | 'manual' = 'manual'
      let metricsFetchedAt: string | null = null
      let views = Number(form.views) || 0
      let likes = Number(form.likes) || 0
      let comments = Number(form.comments) || 0
      let saved = Number(form.saved) || 0
      let shares = Number(form.shares) || 0

      if (form.contentUrl.trim()) {
        const pulled = await pullMetrics(form.contentUrl.trim(), form.platform)
        if (pulled) {
          views = pulled.views
          likes = pulled.likes
          comments = pulled.comments
          saved = pulled.saved
          shares = pulled.shares
          metricsSource = 'api'
          metricsFetchedAt = new Date().toISOString()
        }
        // else: null → stay manual, keep values as entered
      }

      await upsertContent(
        {
          id: form.id,
          campaignId: form.campaignId || null,
          influencerId: form.influencerId || null,
          platform: form.platform,
          objective: form.objective,
          product: form.product.trim(),
          task: form.task.trim(),
          contentUrl: form.contentUrl.trim(),
          fee: Number(form.fee) || 0,
          status: form.status,
          postedAt: form.postedAt || null,
          views, likes, comments, saved, shares,
          metricsSource,
          metricsFetchedAt,
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

  async function handleDelete(id: string) {
    if (!confirm('Hapus konten ini?')) return
    setError(null)
    try {
      await deleteContent(id)
      await loadAll()
    } catch (e) {
      setError(`Gagal hapus: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ── bulk link submit ──
  async function handleBulkLinks() {
    setBulkSaving(true)
    setBulkMsg(null)
    setError(null)
    try {
      const lines = bulkLinks.split('\n').map(l => l.trim()).filter(Boolean)
      if (!lines.length) { setBulkMsg('Tidak ada link.'); setBulkSaving(false); return }

      const rows: Partial<KolContent>[] = await Promise.all(
        lines.map(async (line) => {
          const pulled = await pullMetrics(line, '')
          return {
            campaignId: bulkCampaignId || null,
            influencerId: null,
            platform: '',
            objective: bulkObjective,
            product: '',
            task: '',
            contentUrl: line,
            fee: 0,
            status: 'pending' as KolContent['status'],
            postedAt: null,
            views: pulled?.views ?? 0,
            likes: pulled?.likes ?? 0,
            comments: pulled?.comments ?? 0,
            saved: pulled?.saved ?? 0,
            shares: pulled?.shares ?? 0,
            metricsSource: pulled ? ('api' as const) : ('manual' as const),
            metricsFetchedAt: pulled ? new Date().toISOString() : null,
          }
        }),
      )

      await bulkInsertContents(rows, brand)
      setBulkMsg(`✓ ${rows.length} konten disimpan.`)
      setBulkLinks('')
      await loadAll()
    } catch (e) {
      setError(`Gagal bulk simpan: ${e instanceof Error ? e.message : String(e)}`)
    }
    setBulkSaving(false)
  }

  // ── bulk CSV ──
  function downloadTemplate() {
    const csv = 'campaign_id,influencer_id,platform,objective,product,task,content_url,fee\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'kol_konten_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        const rows = result.data.map(r => ({
          campaignId: r['campaign_id'] ?? null,
          influencerId: r['influencer_id'] ?? null,
          platform: r['platform'] ?? 'Instagram',
          objective: (r['objective'] ?? 'awareness') as Tier,
          product: r['product'] ?? '',
          task: r['task'] ?? '',
          contentUrl: r['content_url'] ?? '',
          fee: Number(r['fee']) || 0,
          status: 'pending' as KolContent['status'],
          views: 0, likes: 0, comments: 0, saved: 0, shares: 0,
          metricsSource: 'manual' as const,
          metricsFetchedAt: null, postedAt: null,
        } satisfies Partial<KolContent>))

        const clean = rows.filter(r => (r.contentUrl ?? '').trim() !== '')
        if (!clean.length) { setError('CSV kosong atau tidak ada kolom content_url.'); return }
        setError(null)
        try {
          await bulkInsertContents(clean, brand)
          setBulk(false)
          await loadAll()
        } catch (e) {
          setError(`Gagal bulk import CSV: ${e instanceof Error ? e.message : String(e)}`)
        }
      },
      error: (e: Error) => setError(`Gagal parse CSV: ${e.message}`),
    })
  }

  // ── render ──
  return (
    <div>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Konten KOL</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setBulk(v => !v); setBulkMsg(null) }} style={btnOutline}>⬆ Bulk Upload Link</button>
          <button onClick={openAdd} style={btnPrimary}>+ Tambah Konten</button>
        </div>
      </div>

      {/* tip */}
      <p style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>
        💡 Paste <b>link video</b> di kolom URL → metrics auto-pull.
        Badge <b style={{ color: C.cyan }}>API</b> = otomatis, <b>Manual</b> = input tangan.
      </p>

      {/* error banner */}
      {error && (
        <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* bulk panel */}
      {bulk && (
        <div onClick={() => fileInputRef.current?.click()} style={{ cursor: 'pointer' }}>
          <BulkUploadBox
            columns="campaign_id, influencer_id, platform, objective, product, task, content_url, fee"
            onDownloadTemplate={() => downloadTemplate()}
          >
            {/* link paste section — stop click propagation so it doesn't open file dialog */}
            <div
              onClick={e => e.stopPropagation()}
              style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}
            >
              <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>…atau paste banyak link video sekaligus (1 per baris):</p>
              <textarea
                value={bulkLinks}
                onChange={e => setBulkLinks(e.target.value)}
                placeholder={'tiktok.com/@.../video/...\ninstagram.com/reel/...\nyoutube.com/watch?v=...'}
                style={{
                  width: '100%', minHeight: 84, fontSize: 12, padding: 10, borderRadius: 8,
                  border: `1px solid ${C.border}`, fontFamily: 'monospace', resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                {/* campaign select */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.sub, whiteSpace: 'nowrap' }}>Campaign:</label>
                  <select
                    value={bulkCampaignId}
                    onChange={e => setBulkCampaignId(e.target.value)}
                    style={{ fontSize: 12, padding: '5px 8px', borderRadius: 6, border: `1px solid ${C.border}`, color: C.text, outline: 'none' }}
                  >
                    <option value="">— opsional —</option>
                    {campaigns.map(cam => <option key={cam.id} value={cam.id}>{cam.name}</option>)}
                  </select>
                </div>
                {/* objective select */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.sub, whiteSpace: 'nowrap' }}>Objektif:</label>
                  <select
                    value={bulkObjective}
                    onChange={e => setBulkObjective(e.target.value as Tier)}
                    style={{ fontSize: 12, padding: '5px 8px', borderRadius: 6, border: `1px solid ${C.border}`, color: C.text, outline: 'none' }}
                  >
                    <option value="awareness">Awareness</option>
                    <option value="consideration">Consideration</option>
                    <option value="action">Action</option>
                  </select>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                  {bulkMsg && <span style={{ fontSize: 11, color: C.green }}>{bulkMsg}</span>}
                  <button
                    onClick={handleBulkLinks}
                    disabled={bulkSaving}
                    style={{ ...btnPrimary, opacity: bulkSaving ? 0.6 : 1 }}
                  >
                    {bulkSaving ? 'Menarik…' : 'Pull & Simpan'}
                  </button>
                </div>
              </div>
              <p style={{ fontSize: 11, color: C.green, marginTop: 6 }}>
                ✓ Tiap link auto-pull metrics (likes/comments/views) begitu di-submit.
              </p>
            </div>
          </BulkUploadBox>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
            onClick={ev => ev.stopPropagation()}
          />
        </div>
      )}

      {/* add / edit form */}
      {showForm && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: C.text }}>
            {form.id ? 'Edit Konten' : 'Tambah Konten'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* campaign */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.sub, display: 'block', marginBottom: 4 }}>Campaign (opsional)</label>
              <select
                value={form.campaignId}
                onChange={e => setForm(f => ({ ...f, campaignId: e.target.value }))}
                style={{ width: '100%', fontSize: 13, padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, color: C.text, outline: 'none' }}
              >
                <option value="">— Tidak ada —</option>
                {campaigns.map(cam => <option key={cam.id} value={cam.id}>{cam.name}</option>)}
              </select>
            </div>
            {/* influencer */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.sub, display: 'block', marginBottom: 4 }}>Influencer (opsional)</label>
              <select
                value={form.influencerId}
                onChange={e => setForm(f => ({ ...f, influencerId: e.target.value }))}
                style={{ width: '100%', fontSize: 13, padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, color: C.text, outline: 'none' }}
              >
                <option value="">— Tidak ada —</option>
                {influencers.map(inf => <option key={inf.id} value={inf.id}>{inf.name}</option>)}
              </select>
            </div>
            {/* platform */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.sub, display: 'block', marginBottom: 4 }}>Platform</label>
              <select
                value={form.platform}
                onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                style={{ width: '100%', fontSize: 13, padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, color: C.text, outline: 'none' }}
              >
                <option value="Instagram">Instagram</option>
                <option value="TikTok">TikTok</option>
                <option value="YouTube">YouTube</option>
              </select>
            </div>
            {/* objective */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.sub, display: 'block', marginBottom: 4 }}>Objektif</label>
              <select
                value={form.objective}
                onChange={e => setForm(f => ({ ...f, objective: e.target.value as Tier }))}
                style={{ width: '100%', fontSize: 13, padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, color: C.text, outline: 'none' }}
              >
                <option value="awareness">Awareness</option>
                <option value="consideration">Consideration</option>
                <option value="action">Action</option>
              </select>
            </div>
            <Field label="Produk" value={form.product} onChange={v => setForm(f => ({ ...f, product: v }))} placeholder="Brightening Serum" />
            <Field label="Task" value={form.task} onChange={v => setForm(f => ({ ...f, task: v }))} placeholder="Review 30s" />
            {/* content url — full width */}
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="URL Konten" value={form.contentUrl} onChange={v => setForm(f => ({ ...f, contentUrl: v }))} placeholder="tiktok.com/@.../video/..." />
            </div>
            <Field label="Fee (Rp)" value={form.fee} onChange={v => setForm(f => ({ ...f, fee: v }))} placeholder="4500000" type="number" />
            {/* status */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.sub, display: 'block', marginBottom: 4 }}>Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as KolContent['status'] }))}
                style={{ width: '100%', fontSize: 13, padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, color: C.text, outline: 'none' }}
              >
                <option value="pending">Pending</option>
                <option value="uploaded">Uploaded</option>
                <option value="broken">Broken</option>
              </select>
            </div>
            <Field label="Tanggal Tayang" value={form.postedAt} onChange={v => setForm(f => ({ ...f, postedAt: v }))} type="date" />
            {/* manual metrics — hint if URL set they'll be overwritten */}
            <div style={{ gridColumn: '1 / -1' }}>
              <p style={{ fontSize: 11, color: C.sub, marginBottom: 8 }}>
                Metrik manual (akan ditimpa auto-pull jika URL valid &amp; live mode aktif):
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                <Field label="Views" value={form.views} onChange={v => setForm(f => ({ ...f, views: v }))} type="number" />
                <Field label="Likes" value={form.likes} onChange={v => setForm(f => ({ ...f, likes: v }))} type="number" />
                <Field label="Comments" value={form.comments} onChange={v => setForm(f => ({ ...f, comments: v }))} type="number" />
                <Field label="Saved" value={form.saved} onChange={v => setForm(f => ({ ...f, saved: v }))} type="number" />
                <Field label="Shares" value={form.shares} onChange={v => setForm(f => ({ ...f, shares: v }))} type="number" />
              </div>
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

      {/* table */}
      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: C.sub, fontSize: 13 }}>Memuat data…</div>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 960 }}>
              <thead>
                <tr style={{ background: '#F9FAFB', color: C.sub, textAlign: 'left' }}>
                  {['Influencer', 'Plat', 'Objektif', 'Produk', 'URL', 'Status', 'Fee', 'Views', 'Likes', 'Source', 'Aksi'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contents.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ padding: '32px 14px', textAlign: 'center', color: C.sub, fontSize: 13 }}>
                      Belum ada konten. Tambah manual atau bulk upload.
                    </td>
                  </tr>
                ) : contents.map((c, i) => {
                  const tier = TIER[c.objective]
                  return (
                    <tr key={c.id} style={{ borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap', color: C.text }}>
                        {nameOf(c.influencerId)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: PLATFORM_COLOR[c.platform] ?? C.sub }}>
                          {PLATFORM_SHORT[c.platform] ?? c.platform}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <Badge text={tier.label} bg={tier.bg} color={tier.fg} />
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: C.text }}>{c.product || '—'}</td>
                      <td style={{
                        padding: '10px 12px', color: C.cyan, maxWidth: 150,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {c.contentUrl || '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}><StatusBadge status={c.status} /></td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: C.text }}>
                        {c.fee ? rp(c.fee) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: C.text }}>{c.views ? fmt(c.views) : '—'}</td>
                      <td style={{ padding: '10px 12px', color: C.text }}>{c.likes ? fmt(c.likes) : '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {c.metricsSource === 'api'
                          ? <Badge text="API" bg="#DBEAFE" color="#1E40AF" />
                          : <Badge text="Manual" bg="#F3F4F6" color={C.sub} />}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEdit(c)} style={btnEdit}>Edit</button>
                          <button onClick={() => handleDelete(c.id)} style={btnDanger}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

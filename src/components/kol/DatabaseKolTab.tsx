'use client'
import { useState, useEffect, useRef, type CSSProperties, type ChangeEvent } from 'react'
import Papa from 'papaparse'
import type { Brand } from '@/lib/types'
import type { KolInfluencer } from '@/lib/kol/types'
import {
  getInfluencers,
  upsertInfluencer,
  deleteInfluencer,
  bulkInsertInfluencers,
} from '@/lib/kol/db'
import { BulkUploadBox, btnPrimary, btnOutline } from '@/components/kol/BulkUploadBox'

// ── colour tokens (match kol-preview) ──
const C = {
  bg: '#F8F9FC', card: '#FFFFFF', border: '#E5E7EB',
  text: '#111827', sub: '#6B7280', cyan: '#0EA5E9',
}

const PLATFORM_COLORS: Record<string, string> = {
  Instagram: '#E1306C',
  TikTok: '#111827',
  YouTube: '#FF0000',
}

const fmt = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + 'jt' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'rb' : String(n)

const btnDanger: CSSProperties = {
  fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 6,
  background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', cursor: 'pointer',
}
const btnEdit: CSSProperties = {
  fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 6,
  background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB', cursor: 'pointer',
}

// ── blank form ──
interface InfluencerForm {
  id?: string
  name: string
  username: string
  platform: string
  followers: string
  niche: string
  contact: string
}

const BLANK_FORM: InfluencerForm = {
  name: '', username: '', platform: 'Instagram', followers: '', niche: '', contact: '',
}

export default function DatabaseKolTab({ brand }: { brand: Brand }) {
  const [influencers, setInfluencers] = useState<KolInfluencer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bulk, setBulk] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<InfluencerForm>(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadInfluencers() {
    setLoading(true)
    setError(null)
    try {
      const data = await getInfluencers(brand)
      setInfluencers(data)
    } catch (e) {
      setError(`Gagal load influencer: ${e instanceof Error ? e.message : String(e)}`)
    }
    setLoading(false)
  }

  // Load influencers from DB on mount (external data source).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadInfluencers() }, [brand])

  function openAdd() {
    setForm(BLANK_FORM)
    setShowForm(true)
    setError(null)
  }

  function openEdit(inf: KolInfluencer) {
    setForm({
      id: inf.id,
      name: inf.name,
      username: inf.username,
      platform: inf.platform,
      followers: String(inf.followers),
      niche: inf.niche,
      contact: inf.contact,
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
    if (!form.name.trim()) { setError('Nama wajib diisi'); return }
    setSaving(true)
    setError(null)
    try {
      await upsertInfluencer(
        {
          id: form.id,
          name: form.name.trim(),
          username: form.username.trim(),
          platform: form.platform,
          followers: Number(form.followers) || 0,
          niche: form.niche.trim(),
          contact: form.contact.trim(),
        },
        brand,
      )
      closeForm()
      await loadInfluencers()
    } catch (e) {
      setError(`Gagal simpan: ${e instanceof Error ? e.message : String(e)}`)
    }
    setSaving(false)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus influencer "${name}"?`)) return
    setError(null)
    try {
      await deleteInfluencer(id)
      await loadInfluencers()
    } catch (e) {
      setError(`Gagal hapus: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  function downloadTemplate() {
    const csv = 'name,username,platform,followers,niche,contact\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'kol_influencer_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // reset so same file can be re-selected
    e.target.value = ''

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        const rows = result.data.map((r) => ({
          name: r['name'] ?? '',
          username: r['username'] ?? '',
          platform: r['platform'] ?? 'Instagram',
          followers: Number(r['followers']) || 0,
          niche: r['niche'] ?? '',
          contact: r['contact'] ?? '',
        } satisfies Partial<KolInfluencer>))

        if (!rows.length) { setError('File CSV kosong atau tidak ada baris data.'); return }
        const clean = rows.filter(r => (r.name ?? '').trim() !== '')
        if (!clean.length) { setError('CSV kosong atau tidak ada kolom name.'); return }
        setError(null)
        try {
          await bulkInsertInfluencers(clean, brand)
          setBulk(false)
          await loadInfluencers()
        } catch (e) {
          setError(`Gagal bulk import: ${e instanceof Error ? e.message : String(e)}`)
        }
      },
      error: (e: Error) => setError(`Gagal parse CSV: ${e.message}`),
    })
  }

  return (
    <div>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Database KOL</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setBulk(v => !v)} style={btnOutline}>⬆ Bulk Upload</button>
          <button onClick={openAdd} style={btnPrimary}>+ Tambah Influencer</button>
        </div>
      </div>

      {/* error banner */}
      {error && (
        <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* bulk upload box */}
      {bulk && (
        <div onClick={() => fileInputRef.current?.click()} style={{ cursor: 'pointer' }}>
          <BulkUploadBox
            columns="name, username, platform, followers, niche, contact"
            onDownloadTemplate={() => downloadTemplate()}
          >
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12, color: C.sub }}>Klik area ini untuk pilih file CSV</span>
            </div>
          </BulkUploadBox>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
            onClick={(ev) => ev.stopPropagation()}
          />
        </div>
      )}

      {/* add / edit form */}
      {showForm && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: C.text }}>
            {form.id ? 'Edit Influencer' : 'Tambah Influencer'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Nama" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Sarah Azhari" />
            <Field label="Username" value={form.username} onChange={v => setForm(f => ({ ...f, username: v }))} placeholder="@sarahaz" />
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
            <Field label="Followers" value={form.followers} onChange={v => setForm(f => ({ ...f, followers: v }))} placeholder="482000" type="number" />
            <Field label="Niche" value={form.niche} onChange={v => setForm(f => ({ ...f, niche: v }))} placeholder="Beauty" />
            <Field label="Kontak" value={form.contact} onChange={v => setForm(f => ({ ...f, contact: v }))} placeholder="0812-1111-2222" />
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
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F9FAFB', color: C.sub, textAlign: 'left' }}>
                  {['Nama', 'Username', 'Platform', 'Followers', 'Niche', 'Kontak', 'Aksi'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {influencers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px 14px', textAlign: 'center', color: C.sub, fontSize: 13 }}>
                      Belum ada influencer. Tambah manual atau import CSV.
                    </td>
                  </tr>
                ) : influencers.map((inf, i) => (
                  <tr key={inf.id} style={{ borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: C.text }}>{inf.name}</td>
                    <td style={{ padding: '10px 14px', color: C.cyan }}>{inf.username}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: PLATFORM_COLORS[inf.platform] ?? C.text }}>
                        {inf.platform}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: C.text }}>{fmt(inf.followers)}</td>
                    <td style={{ padding: '10px 14px', color: C.text }}>{inf.niche}</td>
                    <td style={{ padding: '10px 14px', color: C.sub }}>{inf.contact}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEdit(inf)} style={btnEdit}>Edit</button>
                        <button onClick={() => handleDelete(inf.id, inf.name)} style={btnDanger}>Hapus</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', fontSize: 13, padding: '7px 10px', borderRadius: 8, border: '1px solid #E5E7EB', color: '#111827', outline: 'none', boxSizing: 'border-box' }}
      />
    </div>
  )
}

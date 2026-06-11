'use client'
/**
 * KOL Management — VISUAL PREVIEW / MOCKUP (throwaway).
 * Self-contained, hardcoded dummy data, no auth/DB/API. Built to visualize the
 * PRD (docs/superpowers/specs/2026-06-09-kol-management-prd.md) in the dev server.
 * Delete this route before/at real implementation.
 */
import { useState, type ReactNode, type CSSProperties } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

// ── tokens (match globals.css) ──
const C = {
  bg: '#F8F9FC', card: '#FFFFFF', border: '#E5E7EB', text: '#111827', sub: '#6B7280',
  cyan: '#0EA5E9', green: '#10B981', orange: '#F07830', purple: '#8B5CF6', red: '#EF4444', amber: '#F59E0B',
}
const PLATFORM = {
  Instagram: { color: '#E1306C', short: 'IG' },
  TikTok: { color: '#111827', short: 'TT' },
  YouTube: { color: '#FF0000', short: 'YT' },
} as const
type Platform = keyof typeof PLATFORM

const fmt = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'jt' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'rb' : String(n)
const rp = (n: number) => 'Rp' + n.toLocaleString('id-ID')

// ── mock data ──
const influencers = [
  { id: 'i1', name: 'Sarah Azhari', username: '@sarahaz', platform: 'Instagram' as Platform, followers: 482000, niche: 'Beauty', contact: '0812-1111-2222' },
  { id: 'i2', name: 'Dinda Permata', username: '@dindap', platform: 'TikTok' as Platform, followers: 1240000, niche: 'Skincare', contact: '0813-3333-4444' },
  { id: 'i3', name: 'Rara Nadhira', username: '@raraglow', platform: 'TikTok' as Platform, followers: 890000, niche: 'Lifestyle', contact: '0815-5555-6666' },
  { id: 'i4', name: 'dr. Maya Sari', username: '@drmayaderma', platform: 'YouTube' as Platform, followers: 215000, niche: 'Derma Review', contact: '0816-7777-8888' },
  { id: 'i5', name: 'Tasya Kamila', username: '@tasyak', platform: 'Instagram' as Platform, followers: 1670000, niche: 'Mom & Beauty', contact: '0817-9999-0000' },
]

// objective = funnel tier tujuan konten (ditandai saat input)
type Tier = 'awareness' | 'consideration' | 'action'
const contents = [
  { id: 'c1', inf: 'i2', platform: 'TikTok' as Platform, product: 'Brightening Serum', task: 'Review 30s', objective: 'awareness' as Tier, url: 'tiktok.com/@dindap/video/733...', status: 'uploaded', fee: 4500000, likes: 84200, comments: 1240, saved: 6700, shares: 3100, views: 1320000, source: 'api', posted: '06-02' },
  { id: 'c2', inf: 'i3', platform: 'TikTok' as Platform, product: 'Acne Spot', task: 'Storytelling', objective: 'consideration' as Tier, url: 'tiktok.com/@raraglow/video/911...', status: 'uploaded', fee: 3800000, likes: 51000, comments: 870, saved: 4200, shares: 1900, views: 760000, source: 'api', posted: '06-03' },
  { id: 'c3', inf: 'i1', platform: 'Instagram' as Platform, product: 'Brightening Serum', task: 'Reels + Story', objective: 'consideration' as Tier, url: 'instagram.com/reel/Cx9...', status: 'uploaded', fee: 5200000, likes: 38900, comments: 540, saved: 8100, shares: 1200, views: 410000, source: 'api', posted: '06-04' },
  { id: 'c4', inf: 'i5', platform: 'Instagram' as Platform, product: 'Sunscreen SPF50', task: 'Reels', objective: 'awareness' as Tier, url: 'instagram.com/reel/Cy2...', status: 'pending', fee: 7500000, likes: 0, comments: 0, saved: 0, shares: 0, views: 0, source: 'manual', posted: '—' },
  { id: 'c5', inf: 'i4', platform: 'YouTube' as Platform, product: 'Full Routine', task: 'Review 8 menit', objective: 'consideration' as Tier, url: 'youtube.com/watch?v=ab12...', status: 'uploaded', fee: 6000000, likes: 12400, comments: 980, saved: 0, shares: 420, views: 187000, source: 'manual', posted: '06-01' },
  { id: 'c6', inf: 'i2', platform: 'TikTok' as Platform, product: 'Acne Spot', task: 'Duet trend', objective: 'awareness' as Tier, url: 'tiktok.com/@dindap/video/744...', status: 'broken', fee: 0, likes: 0, comments: 0, saved: 0, shares: 0, views: 0, source: 'manual', posted: '—' },
]

// ── funnel model (per framework Marcomm) ──
const TIER = {
  awareness:     { label: 'Awareness',     color: '#0EA5E9', bg: '#E0F2FE', fg: '#075985', desc: 'Views + Likes' },
  consideration: { label: 'Consideration', color: '#8B5CF6', bg: '#EDE9FE', fg: '#5B21B6', desc: 'Comments + Saves + Shares' },
  action:        { label: 'Action',        color: '#10B981', bg: '#D1FAE5', fg: '#065F46', desc: 'Clicks + Promo (Phase 3)' },
} as const
// signals per tier
const awarenessSig = (c: typeof contents[number]) => c.views + c.likes
const considerationSig = (c: typeof contents[number]) => c.comments + c.saved + c.shares

const trend = [
  { d: '06-01', awareness: 199400, consideration: 1400 },
  { d: '06-02', awareness: 1404200, consideration: 11040 },
  { d: '06-03', awareness: 811000, consideration: 6970 },
  { d: '06-04', awareness: 448900, consideration: 9840 },
]

const nameOf = (id: string) => influencers.find(i => i.id === id)?.name ?? '—'

export default function KolPreview() {
  const [tab, setTab] = useState<'db' | 'budget' | 'campaign' | 'konten'>('campaign')

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Inter, system-ui, sans-serif', padding: '24px 32px' }}>
      {/* preview banner */}
      <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E', fontSize: 12, padding: '6px 12px', borderRadius: 8, marginBottom: 16 }}>
        🔍 <b>PREVIEW / MOCKUP</b> — visualisasi PRD KOL Management. Data dummy, belum terhubung DB/API. (Hapus route ini saat implementasi.)
      </div>

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>KOL Management</h1>
          <p style={{ color: C.sub, fontSize: 13 }}>Kelola campaign influencer end-to-end · brand: <b style={{ color: '#C9A96E' }}>Reglow</b></p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['Reglow', 'Amura', 'Purela'] as const).map((b, i) => (
            <span key={b} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, fontWeight: 600,
              background: i === 0 ? '#C9A96E' : '#fff', color: i === 0 ? '#fff' : C.sub, border: `1px solid ${i === 0 ? '#C9A96E' : C.border}` }}>{b}</span>
          ))}
        </div>
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${C.border}` }}>
        {([['campaign', 'Campaign'], ['konten', 'Konten KOL'], ['budget', 'Budget'], ['db', 'Database KOL']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '10px 16px', fontSize: 14, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer',
            color: tab === k ? C.cyan : C.sub, borderBottom: `2px solid ${tab === k ? C.cyan : 'transparent'}`, marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'campaign' && <Campaign />}
      {tab === 'konten' && <Konten />}
      {tab === 'budget' && <Budget />}
      {tab === 'db' && <Database />}
    </div>
  )
}

function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', ...style }}>{children}</div>
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
        <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 999, background: m.bg, color: m.fg, fontWeight: 700 }}>{m.label}</span>
        <span style={{ fontSize: 10, color: C.sub }}>{count} konten objektif ini</span>
      </div>
      <p style={{ fontSize: 24, fontWeight: 800, color: m.color }}>{soon ? '—' : value}</p>
      <p style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{m.desc}{soon ? ' · segera' : ''}</p>
    </Card>
  )
}

function Campaign() {
  const live = contents.filter(c => c.status === 'uploaded')
  const totViews = live.reduce((s, c) => s + c.views, 0)
  const totFee = live.reduce((s, c) => s + c.fee, 0)
  const cpv = (totFee / totViews).toFixed(0)
  const awSig = live.reduce((s, c) => s + awarenessSig(c), 0)
  const conSig = live.reduce((s, c) => s + considerationSig(c), 0)
  const cnt = (t: Tier) => live.filter(c => c.objective === t).length
  const board = [...live].sort((a, b) => b.views - a.views)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Campaign: Reglow Glow-Up Juni 2026</h2>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#DCFCE7', color: '#166534', fontWeight: 600 }}>● Active</span>
        <span style={{ fontSize: 12, color: C.sub }}>1–30 Jun · Budget: Reglow Q2</span>
      </div>

      {/* funnel tier — engagement dipecah per tier, bukan 1 total */}
      <p style={{ fontSize: 12, color: C.sub, marginBottom: 8 }}>Sinyal engagement dipecah per <b>funnel tier</b> — tiap konten punya objektif sendiri, jadi bisa cek konten mana yang nampol di tier-nya.</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <TierCard tier="awareness" value={fmt(awSig)} count={cnt('awareness')} />
        <TierCard tier="consideration" value={fmt(conSig)} count={cnt('consideration')} />
        <TierCard tier="action" value="" count={cnt('action')} soon />
      </div>

      {/* efficiency row (sekunder) */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Kpi label="Total Views / Reach" value={fmt(totViews)} sub={`${live.length} konten tayang`} color={C.cyan} />
        <Kpi label="Total Fee" value={rp(totFee)} sub="alokasi terpakai" color={C.text} />
        <Kpi label="CPV" value={rp(+cpv)} sub="cost per view" color={C.orange} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        {/* trend per tier */}
        <Card style={{ padding: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Tren Sinyal per Tier</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend} margin={{ left: -10, right: 8, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
              <XAxis dataKey="d" tick={{ fontSize: 11, fill: C.sub }} />
              <YAxis tick={{ fontSize: 11, fill: C.sub }} tickFormatter={fmt} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}` }} />
              <Line type="monotone" dataKey="awareness" stroke={TIER.awareness.color} strokeWidth={2.5} dot={false} name="Awareness" />
              <Line type="monotone" dataKey="consideration" stroke={TIER.consideration.color} strokeWidth={2.5} dot={false} name="Consideration" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* leaderboard — ranked by total views, badge objektif per baris */}
        <Card style={{ padding: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>🏆 Leaderboard KOL</p>
          <p style={{ fontSize: 11, color: C.sub, marginBottom: 10 }}>diranking dari total views</p>
          {board.map((c, i) => {
            const m = TIER[c.objective]
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                <span style={{ width: 22, height: 22, borderRadius: 999, background: i === 0 ? '#FEF3C7' : '#F3F4F6', color: i === 0 ? '#92400E' : C.sub, fontSize: 12, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{nameOf(c.inf)}</p>
                  <p style={{ fontSize: 11 }}><span style={{ color: m.fg, fontWeight: 600 }}>{m.label}</span> <span style={{ color: C.sub }}>· {c.platform}</span></p>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.cyan }}>{fmt(c.views)}</span>
              </div>
            )
          })}
        </Card>
      </div>
    </div>
  )
}

function Badge({ text, bg, color }: { text: string; bg: string; color: string }) {
  return <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, background: bg, color, fontWeight: 600 }}>{text}</span>
}

const btnPrimary: CSSProperties = { fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 8, background: '#0EA5E9', color: '#fff', border: 'none', cursor: 'pointer' }
const btnOutline: CSSProperties = { fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 8, background: '#fff', color: '#0EA5E9', border: '1px solid #0EA5E9', cursor: 'pointer' }

function BulkBox({ columns, children }: { columns: string; children?: ReactNode }) {
  return (
    <div style={{ border: `2px dashed ${C.border}`, borderRadius: 12, padding: 18, background: '#F8FAFC', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600 }}>⬆ Tarik &amp; lepas file CSV di sini, atau klik untuk pilih</p>
          <p style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>Kolom: {columns}</p>
        </div>
        <button style={{ fontSize: 12, fontWeight: 600, padding: '7px 12px', borderRadius: 8, background: '#fff', color: C.cyan, border: `1px solid ${C.cyan}`, cursor: 'pointer', whiteSpace: 'nowrap' }}>⬇ Download template</button>
      </div>
      {children}
    </div>
  )
}

function Konten() {
  const [bulk, setBulk] = useState(false)
  const statusBadge = (s: string) => s === 'uploaded' ? <Badge text="uploaded" bg="#DCFCE7" color="#166534" />
    : s === 'pending' ? <Badge text="pending" bg="#FEF3C7" color="#92400E" /> : <Badge text="broken" bg="#FEE2E2" color="#991B1B" />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Konten KOL</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setBulk(v => !v)} style={btnOutline}>⬆ Bulk Upload Link</button>
          <button style={btnPrimary}>+ Tambah Konten</button>
        </div>
      </div>
      <p style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>💡 Paste <b>link video</b> di kolom URL → metrics auto-pull. Badge <b style={{ color: C.cyan }}>API</b> = otomatis, <b>Manual</b> = input tangan.</p>
      {bulk && (
        <BulkBox columns="campaign, influencer, platform, objective, product, task, content_url, fee">
          <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>…atau paste banyak link video sekaligus (1 per baris):</p>
            <textarea defaultValue={''} placeholder={'tiktok.com/@.../video/...\ninstagram.com/reel/...\nyoutube.com/watch?v=...'}
              style={{ width: '100%', minHeight: 84, fontSize: 12, padding: 10, borderRadius: 8, border: `1px solid ${C.border}`, fontFamily: 'monospace', resize: 'vertical' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
              <p style={{ fontSize: 11, color: C.green }}>✓ Tiap link auto-pull metrics (likes/comments/views) begitu di-submit.</p>
              <button style={btnPrimary}>Pull &amp; Simpan</button>
            </div>
          </div>
        </BulkBox>
      )}
      <Card style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 960 }}>
            <thead>
              <tr style={{ background: '#F9FAFB', color: C.sub, textAlign: 'left' }}>
                {['Influencer', 'Plat', 'Objektif', 'Produk', 'URL', 'Status', 'Fee', 'Views', 'Likes', 'Source'].map(h =>
                  <th key={h} style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {contents.map((c, i) => {
                const m = TIER[c.objective]
                return (
                <tr key={c.id} style={{ borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{nameOf(c.inf)}</td>
                  <td style={{ padding: '10px 12px' }}><span style={{ fontSize: 10, fontWeight: 700, color: PLATFORM[c.platform].color }}>{PLATFORM[c.platform].short}</span></td>
                  <td style={{ padding: '10px 12px' }}><Badge text={m.label} bg={m.bg} color={m.fg} /></td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{c.product}</td>
                  <td style={{ padding: '10px 12px', color: C.cyan, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.url}</td>
                  <td style={{ padding: '10px 12px' }}>{statusBadge(c.status)}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{c.fee ? rp(c.fee) : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{c.views ? fmt(c.views) : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{c.likes ? fmt(c.likes) : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{c.source === 'api'
                    ? <Badge text="API" bg="#DBEAFE" color="#1E40AF" /> : <Badge text="Manual" bg="#F3F4F6" color={C.sub} />}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Budget() {
  const budgets = [
    { name: 'Reglow Q2 2026', nominal: 50000000, used: contents.reduce((s, c) => s + c.fee, 0) },
    { name: 'Reglow Ramadan', nominal: 30000000, used: 28400000 },
  ]
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Budget</h2>
        <button style={{ fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 8, background: C.cyan, color: '#fff', border: 'none' }}>+ Tambah Budget</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {budgets.map(b => {
          const pct = Math.min(100, Math.round((b.used / b.nominal) * 100))
          const over = b.used > b.nominal
          return (
            <Card key={b.name} style={{ padding: 18 }}>
              <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{b.name}</p>
              <p style={{ fontSize: 12, color: C.sub, marginBottom: 14 }}>Total: {rp(b.nominal)}</p>
              <div style={{ height: 10, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ width: pct + '%', height: '100%', background: over ? C.red : pct > 80 ? C.amber : C.green, borderRadius: 999 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: C.sub }}>Terpakai <b style={{ color: C.text }}>{rp(b.used)}</b> ({pct}%)</span>
                <span style={{ color: over ? C.red : C.green, fontWeight: 600 }}>{over ? 'Over budget!' : `Sisa ${rp(b.nominal - b.used)}`}</span>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function Database() {
  const [bulk, setBulk] = useState(false)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Database KOL</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setBulk(v => !v)} style={btnOutline}>⬆ Bulk Upload</button>
          <button style={btnPrimary}>+ Tambah Influencer</button>
        </div>
      </div>
      {bulk && <BulkBox columns="name, username, platform, followers, niche, contact" />}
      <Card style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F9FAFB', color: C.sub, textAlign: 'left' }}>
              {['Nama', 'Username', 'Platform', 'Followers', 'Niche', 'Kontak'].map(h =>
                <th key={h} style={{ padding: '10px 14px', fontWeight: 600 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {influencers.map((inf, i) => (
              <tr key={inf.id} style={{ borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>{inf.name}</td>
                <td style={{ padding: '10px 14px', color: C.cyan }}>{inf.username}</td>
                <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 11, fontWeight: 700, color: PLATFORM[inf.platform].color }}>{inf.platform}</span></td>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>{fmt(inf.followers)}</td>
                <td style={{ padding: '10px 14px' }}>{inf.niche}</td>
                <td style={{ padding: '10px 14px', color: C.sub }}>{inf.contact}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

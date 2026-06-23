'use client'
import { useState, useEffect } from 'react'
import { supabase, type UserRole, type UserBrand } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Users, Edit2, Check, X, UserPlus, Copy } from 'lucide-react'

interface UserWithEmail {
  id: string
  full_name: string | null
  role: UserRole
  brand: UserBrand
  created_at: string
  email: string
}

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  cs: 'CS',
  crm: 'CRM',
  kol_specialist: 'KOL Specialist',
}

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: '#7C3AED',
  admin: '#DC2626',
  manager: '#D97706',
  cs: '#2563EB',
  crm: '#059669',
  kol_specialist: '#0891B2',
}

type BrandFilter = 'all' | 'reglow' | 'amura' | 'purela'

interface Props { brandColor: string }

export default function UserManagement({ brandColor }: Props) {
  const { profile: myProfile } = useAuth()
  const [users, setUsers] = useState<UserWithEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [brandFilter, setBrandFilter] = useState<BrandFilter>('all')
  const [editId, setEditId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState<UserRole>('cs')
  const [editBrand, setEditBrand] = useState<UserBrand>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Add-user form
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState<UserRole>('cs')
  const [addBrand, setAddBrand] = useState<UserBrand>(null)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const isSuper = myProfile?.role === 'super_admin'
  const canAdd = isSuper || myProfile?.role === 'admin'
  const availableRoles: UserRole[] = isSuper
    ? ['super_admin', 'admin', 'manager', 'cs', 'crm', 'kol_specialist']
    : ['manager', 'cs', 'crm']

  function openAdd() {
    setShowAdd(true)
    setAddName(''); setAddEmail('')
    setAddRole(isSuper ? 'manager' : 'cs')
    setAddBrand(isSuper ? null : (myProfile?.brand ?? null)) // admin: locked to own brand
    setAddError(null); setCreatedCreds(null)
  }

  async function submitAdd() {
    setAdding(true); setAddError(null)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setAddError('Sesi habis — login ulang.'); setAdding(false); return }
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ full_name: addName, email: addEmail, role: addRole, brand: addBrand }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok && res.status !== 207) { setAddError(json.error ?? 'Gagal membuat akun'); setAdding(false); return }
      setCreatedCreds({ email: json.email, password: json.password })
      if (res.status === 207 && json.error) setAddError(json.error)
      setShowAdd(false); setCopied(false)
      await loadUsers()
    } catch {
      setAddError('Gagal terhubung ke server.')
    }
    setAdding(false)
  }

  async function loadUsers() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('user_profiles_with_email')
      .select('*')
      .order('created_at')
    if (error) {
      setError(`Gagal load users: ${error.message}`)
    } else {
      setUsers((data ?? []) as UserWithEmail[])
    }
    setLoading(false)
  }

  // Fetch users from Supabase on mount (external system).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadUsers() }, [])

  const filteredUsers = users.filter(u => {
    if (brandFilter === 'all') return true
    if (brandFilter === 'reglow') return u.brand === 'reglow' || u.role === 'super_admin'
    if (brandFilter === 'amura') return u.brand === 'amura' || u.role === 'super_admin'
    if (brandFilter === 'purela') return u.brand === 'purela' || u.role === 'super_admin'
    return true
  })

  function startEdit(u: UserWithEmail) {
    setEditId(u.id)
    setEditRole(u.role)
    setEditBrand(u.brand)
    setEditName(u.full_name ?? '')
    setError(null)
  }

  function cancelEdit() { setEditId(null); setError(null) }

  async function saveEdit(id: string) {
    setSaving(true)
    setError(null)
    const brandValue = editRole === 'super_admin' ? null : editBrand
    const { error } = await supabase.rpc('admin_update_user_profile', {
      target_id: id,
      new_role: editRole,
      new_brand: brandValue as string,
      new_full_name: editName,
    })
    if (error) setError(error.message)
    else { setEditId(null); await loadUsers() }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: brandColor, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Users size={16} style={{ color: brandColor }} />
        <span className="text-sm font-semibold" style={{ color: '#374151' }}>Kelola Users</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: `${brandColor}15`, color: brandColor }}>
            {filteredUsers.length} users
          </span>
          {canAdd && !showAdd && (
            <button onClick={openAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: brandColor, color: '#fff' }}>
              <UserPlus size={13} /> Tambah User
            </button>
          )}
        </div>
      </div>

      {/* Brand filter pills */}
      <div className="flex gap-2">
        {([
          ['all', 'Semua Brand'],
          ['reglow', 'Reglow'],
          ['amura', 'Amura'],
          ['purela', 'Purela'],
        ] as [BrandFilter, string][]).map(([val, label]) => (
          <button key={val} onClick={() => setBrandFilter(val)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: brandFilter === val ? `${brandColor}18` : '#F9FAFB',
              border: `1px solid ${brandFilter === val ? `${brandColor}40` : '#E5E7EB'}`,
              color: brandFilter === val ? brandColor : '#6B7280',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Generated credentials — shown ONCE */}
      {createdCreds && (
        <div className="rounded-xl p-4 space-y-2" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: '#065F46' }}>✓ Akun berhasil dibuat</p>
            <button onClick={() => setCreatedCreds(null)} className="p-1 rounded" style={{ color: '#065F46' }}><X size={14} /></button>
          </div>
          <p className="text-xs" style={{ color: '#047857' }}>Simpan & kasih ke anggota tim — password ini cuma ditampilin <b>SEKALI</b>:</p>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#fff', border: '1px solid #A7F3D0' }}>
            <div className="flex-1 min-w-0">
              <p className="text-[11px]" style={{ color: '#6B7280' }}>{createdCreds.email}</p>
              <p className="text-sm font-mono font-semibold truncate" style={{ color: '#111827' }}>{createdCreds.password}</p>
            </div>
            <button onClick={() => { navigator.clipboard?.writeText(`Email: ${createdCreds.email}\nPassword: ${createdCreds.password}`); setCopied(true) }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium flex-shrink-0"
              style={{ background: '#10B981', color: '#fff' }}>
              <Copy size={12} /> {copied ? 'Tersalin' : 'Salin'}
            </button>
          </div>
          <p className="text-[11px]" style={{ color: '#047857' }}>Anggota bisa ganti password sendiri di menu profil (sidebar) setelah login.</p>
        </div>
      )}

      {/* Add-user form */}
      {showAdd && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: '#F9FAFB', border: `1px solid ${brandColor}30` }}>
          <p className="text-sm font-semibold" style={{ color: '#374151' }}>Tambah User Baru</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium" style={{ color: '#6B7280' }}>Nama Lengkap</label>
              <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Budi Santoso"
                className="w-full mt-1 text-sm px-3 py-2 rounded-lg border outline-none" style={{ borderColor: '#E5E7EB', color: '#374151' }} />
            </div>
            <div>
              <label className="text-[11px] font-medium" style={{ color: '#6B7280' }}>Email</label>
              <input value={addEmail} onChange={e => setAddEmail(e.target.value)} type="email" placeholder="budi@email.com"
                className="w-full mt-1 text-sm px-3 py-2 rounded-lg border outline-none" style={{ borderColor: '#E5E7EB', color: '#374151' }} />
            </div>
            <div>
              <label className="text-[11px] font-medium" style={{ color: '#6B7280' }}>Role</label>
              <select value={addRole} onChange={e => setAddRole(e.target.value as UserRole)}
                className="w-full mt-1 text-sm px-3 py-2 rounded-lg border outline-none bg-white" style={{ borderColor: '#E5E7EB', color: '#374151' }}>
                {availableRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium" style={{ color: '#6B7280' }}>Brand</label>
              {addRole === 'super_admin' ? (
                <p className="text-sm px-3 py-2 mt-1" style={{ color: '#9CA3AF' }}>Semua brand</p>
              ) : isSuper ? (
                <select value={addBrand ?? ''} onChange={e => setAddBrand((e.target.value as UserBrand) || null)}
                  className="w-full mt-1 text-sm px-3 py-2 rounded-lg border outline-none bg-white" style={{ borderColor: '#E5E7EB', color: '#374151' }}>
                  <option value="">— pilih brand —</option>
                  <option value="reglow">Reglow</option>
                  <option value="amura">Amura</option>
                  <option value="purela">Purela</option>
                </select>
              ) : (
                <p className="text-sm px-3 py-2 mt-1 capitalize" style={{ color: '#374151' }}>
                  {myProfile?.brand ?? '—'} <span className="text-[11px]" style={{ color: '#9CA3AF' }}>(brand kamu)</span>
                </p>
              )}
            </div>
          </div>
          {addError && <p className="text-xs" style={{ color: '#DC2626' }}>{addError}</p>}
          <div className="flex items-center gap-2">
            <button onClick={submitAdd} disabled={adding}
              className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: brandColor, color: '#fff', opacity: adding ? 0.6 : 1 }}>
              {adding ? 'Membuat…' : 'Buat Akun'}
            </button>
            <button onClick={() => { setShowAdd(false); setAddError(null) }}
              className="px-4 py-2 rounded-lg text-xs font-medium" style={{ background: '#F3F4F6', color: '#6B7280' }}>Batal</button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-xs rounded-lg px-3 py-2"
          style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#E5E7EB' }}>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: '#6B7280' }}>Nama</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: '#6B7280' }}>Email</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: '#6B7280' }}>Role</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: '#6B7280' }}>Brand</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-right" style={{ color: '#6B7280' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u, i) => {
              const isMe = u.id === myProfile?.id
              const canEdit = !isMe && (isSuper || (myProfile?.role === 'admin' && u.role !== 'super_admin' && u.role !== 'admin'))
              const isEditing = editId === u.id

              return (
                <tr key={u.id} style={{
                  borderBottom: i < filteredUsers.length - 1 ? '1px solid #F3F4F6' : 'none',
                  background: isEditing ? `${brandColor}05` : '#fff',
                }}>
                  {/* Nama */}
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        placeholder="Nama lengkap"
                        className="text-xs px-2 py-1.5 rounded border outline-none w-32"
                        style={{ borderColor: brandColor, color: '#374151' }}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium" style={{ color: '#111827' }}>
                          {u.full_name || <span style={{ color: '#9CA3AF' }}>(no name)</span>}
                        </span>
                        {isMe && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ background: `${brandColor}20`, color: brandColor }}>Kamu</span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Email */}
                  <td className="px-4 py-3">
                    <span className="text-xs" style={{ color: '#6B7280' }}>{u.email}</span>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <select value={editRole} onChange={e => setEditRole(e.target.value as UserRole)}
                        className="text-xs px-2 py-1 rounded border outline-none"
                        style={{ borderColor: brandColor, color: '#374151' }}>
                        {availableRoles.map(r => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: `${ROLE_COLORS[u.role]}18`, color: ROLE_COLORS[u.role] }}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    )}
                  </td>

                  {/* Brand */}
                  <td className="px-4 py-3">
                    {isEditing ? (
                      editRole === 'super_admin' ? (
                        <span className="text-xs" style={{ color: '#9CA3AF' }}>Semua brand</span>
                      ) : (
                        <select value={editBrand ?? ''} onChange={e => setEditBrand(e.target.value as UserBrand || null)}
                          className="text-xs px-2 py-1 rounded border outline-none"
                          style={{ borderColor: brandColor, color: '#374151' }}>
                          <option value="">— pilih brand —</option>
                          <option value="reglow">Reglow</option>
                          <option value="amura">Amura</option>
                          <option value="purela">Purela</option>
                        </select>
                      )
                    ) : (
                      <span className="text-xs capitalize" style={{ color: u.brand ? '#374151' : '#9CA3AF' }}>
                        {u.role === 'super_admin' ? 'Semua' : u.brand ?? '—'}
                      </span>
                    )}
                  </td>

                  {/* Aksi */}
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => saveEdit(u.id)} disabled={saving}
                          className="p-1.5 rounded-lg"
                          style={{ background: `${brandColor}15`, color: brandColor }}>
                          <Check size={13} />
                        </button>
                        <button onClick={cancelEdit}
                          className="p-1.5 rounded-lg"
                          style={{ background: '#F3F4F6', color: '#6B7280' }}>
                          <X size={13} />
                        </button>
                      </div>
                    ) : canEdit ? (
                      <button onClick={() => startEdit(u)}
                        className="p-1.5 rounded-lg"
                        style={{ background: '#F3F4F6', color: '#6B7280' }}>
                        <Edit2 size={13} />
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}

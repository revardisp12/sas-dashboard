'use client'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import SyncNowButton from '@/components/wms/SyncNowButton'
import SyncHistory from '@/components/wms/SyncHistory'

export default function WmsPage() {
  const { profile, loading } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)
  const mode = process.env.NEXT_PUBLIC_WMS_MODE ?? 'mock'

  if (loading) return <div style={{ padding: 32, fontSize: 13, color: '#6B7280' }}>Memuat…</div>
  if (!profile || !(['super_admin', 'admin'] as string[]).includes(profile.role)) {
    return <div style={{ padding: 32, fontSize: 13, color: '#DC2626' }}>Akses ditolak.</div>
  }

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>WMS Sync</h1>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: mode === 'live' ? '#DCFCE7' : '#FEF9C3', color: mode === 'live' ? '#166534' : '#854D0E' }}>
          MODE: {mode.toUpperCase()}
        </span>
      </div>
      <p style={{ color: '#6B7280', fontSize: 13, margin: '6px 0 20px' }}>
        Tarik data dari Warehouse Management System. {mode === 'mock' ? 'Saat ini memakai data mock.' : 'Terhubung ke WMS live.'}
      </p>
      <SyncNowButton onDone={() => setRefreshKey(k => k + 1)} />
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: '28px 0 10px' }}>Riwayat Sync</h2>
      <SyncHistory refreshKey={refreshKey} />
    </div>
  )
}

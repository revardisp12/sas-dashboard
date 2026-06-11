'use client'
import { useState } from 'react'
import type { Brand } from '@/lib/types'
import DatabaseKolTab from './DatabaseKolTab'
import BudgetTab from './BudgetTab'
import CampaignTab from './CampaignTab'
import KontenTab from './KontenTab'

type Tab = 'campaign' | 'konten' | 'budget' | 'db'

export default function KolView({ brand }: { brand: Brand }) {
  const [tab, setTab] = useState<Tab>('campaign')
  return (
    <div style={{ padding: 4 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #E5E7EB' }}>
        {([['campaign', 'Campaign'], ['konten', 'Konten KOL'], ['budget', 'Budget'], ['db', 'Database KOL']] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              padding: '10px 16px',
              fontSize: 14,
              fontWeight: 600,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: tab === k ? '#0EA5E9' : '#6B7280',
              borderBottom: `2px solid ${tab === k ? '#0EA5E9' : 'transparent'}`,
              marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'campaign' && <CampaignTab brand={brand} />}
      {tab === 'konten' && <KontenTab brand={brand} />}
      {tab === 'budget' && <BudgetTab brand={brand} />}
      {tab === 'db' && <DatabaseKolTab brand={brand} />}
    </div>
  )
}

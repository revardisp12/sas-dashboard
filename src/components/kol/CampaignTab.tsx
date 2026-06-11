import type { Brand } from '@/lib/types'

export default function CampaignTab({ brand }: { brand: Brand }) {
  return <p style={{ color: '#6B7280', fontSize: 13 }}>Campaign — coming soon ({brand})</p>
}

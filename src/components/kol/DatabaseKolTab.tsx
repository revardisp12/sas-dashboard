import type { Brand } from '@/lib/types'

export default function DatabaseKolTab({ brand }: { brand: Brand }) {
  return <p style={{ color: '#6B7280', fontSize: 13 }}>Database KOL — coming soon ({brand})</p>
}

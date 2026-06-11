import type { Brand } from '@/lib/types'

export default function BudgetTab({ brand }: { brand: Brand }) {
  return <p style={{ color: '#6B7280', fontSize: 13 }}>Budget — coming soon ({brand})</p>
}

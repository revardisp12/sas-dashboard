import type { Brand } from '@/lib/types'

export type KPIDirection = 'up' | 'down' | 'flat'

export interface KPIDelta {
  current: number
  previous: number
  diff: number
  percent: number | null  // null when previous is 0 (avoid /0)
  direction: KPIDirection
}

export interface DigestKPIs {
  revenue: KPIDelta
  orders: KPIDelta
  blendedRoas: KPIDelta
  newCustomers: KPIDelta
  champions: KPIDelta
}

export interface TopMover {
  channel: string
  direction: 'positive' | 'negative'
  revenueChange: number
  caption: string
}

export interface DigestPayload {
  brand: Brand
  weekStart: string  // 'YYYY-MM-DD'
  weekEnd: string    // 'YYYY-MM-DD'
  weekNumber: number // ISO week number
  generatedAt: string  // ISO timestamp
  kpis: DigestKPIs
  topMover: TopMover | null  // null if no notable mover
}

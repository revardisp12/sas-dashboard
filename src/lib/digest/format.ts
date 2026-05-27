import type { Brand } from '@/lib/types'
import type { DigestPayload, KPIDelta } from './types'

const BRAND_LABEL: Record<Brand, string> = {
  reglow: 'Reglow',
  amura: 'Amura',
  purela: 'Purela',
}

export function formatDigestText(payload: DigestPayload, dashboardOrigin: string): string {
  const lines: string[] = []
  const label = BRAND_LABEL[payload.brand]

  lines.push(`📊 ${label} Weekly Digest — Week ${payload.weekNumber} (${payload.weekStart} to ${payload.weekEnd})`)
  lines.push('')
  lines.push(`Revenue: ${formatRupiah(payload.kpis.revenue.current)} ${suffix(payload.kpis.revenue)}`)
  lines.push(`Orders: ${payload.kpis.orders.current.toLocaleString('id-ID')} ${suffix(payload.kpis.orders)}`)
  lines.push(`ROAS: ${payload.kpis.blendedRoas.current.toFixed(1)}x ${suffix(payload.kpis.blendedRoas)}`)
  lines.push(`New Customers: ${payload.kpis.newCustomers.current.toLocaleString('id-ID')} ${suffix(payload.kpis.newCustomers)}`)
  lines.push(`Champions: ${payload.kpis.champions.current.toLocaleString('id-ID')} ${suffix(payload.kpis.champions)}`)

  if (payload.topMover) {
    lines.push('')
    if (payload.topMover.direction === 'positive') {
      lines.push(`🚀 TOP MOVER: ${payload.topMover.caption}`)
    } else {
      lines.push(`⚠️ WATCH OUT: ${payload.topMover.caption}`)
    }
  }

  lines.push('')
  lines.push(`Full detail: ${dashboardOrigin}/digest/${payload.brand}`)

  return lines.join('\n')
}

function formatRupiah(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID')
}

function suffix(d: KPIDelta): string {
  const emoji = d.direction === 'up' ? '✅' : d.direction === 'down' ? '⚠️' : '➖'
  if (d.percent === null) {
    return `(new) ${emoji}`
  }
  const sign = d.percent >= 0 ? '+' : ''
  return `(${sign}${d.percent.toFixed(1)}% WoW) ${emoji}`
}

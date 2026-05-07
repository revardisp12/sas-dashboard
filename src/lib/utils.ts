export function filterByRange<T extends { date: string }>(data: T[], from: string, to: string): T[] {
  return data.filter(r => r.date >= from && r.date <= to)
}

export function filterByDays<T extends { date: string }>(data: T[], days: number): T[] {
  if (days === 0 || data.length === 0) return data
  const timestamps = data.map(r => new Date(r.date).getTime()).filter(t => !isNaN(t))
  if (timestamps.length === 0) return data
  const maxDate = new Date(Math.max(...timestamps))
  const cutoff = new Date(maxDate)
  cutoff.setDate(cutoff.getDate() - days + 1)
  return data.filter(r => {
    const d = new Date(r.date)
    return !isNaN(d.getTime()) && d >= cutoff
  })
}

export function fmtCurrency(n: number): string {
  if (n >= 1_000_000_000) return 'Rp ' + (n / 1_000_000_000).toFixed(1) + 'M'
  if (n >= 1_000_000) return 'Rp ' + (n / 1_000_000).toFixed(1) + 'jt'
  return 'Rp ' + n.toLocaleString('id-ID')
}

export function fmtNum(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'M'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'jt'
  if (n >= 10_000) return Math.round(n / 1_000) + 'rb'
  return n.toLocaleString('id-ID')
}

export function pct(part: number, total: number): string {
  if (total === 0) return '0%'
  return ((part / total) * 100).toFixed(1) + '%'
}

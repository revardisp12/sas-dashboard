export default function OriginBadge({ origin }: { origin?: 'wms' | 'manual' | 'csv' }) {
  const o = origin ?? 'manual'
  const style = o === 'wms'
    ? { background: '#DBEAFE', color: '#1E40AF' }
    : { background: '#F3F4F6', color: '#6B7280' }
  return <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, ...style }}>{o === 'wms' ? 'WMS' : 'Manual'}</span>
}

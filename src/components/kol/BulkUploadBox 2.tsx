import type { ReactNode, CSSProperties } from 'react'

export const btnPrimary: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  padding: '8px 14px',
  borderRadius: 8,
  background: '#0EA5E9',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
}

export const btnOutline: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  padding: '8px 14px',
  borderRadius: 8,
  background: '#fff',
  color: '#0EA5E9',
  border: '1px solid #0EA5E9',
  cursor: 'pointer',
}

export function BulkUploadBox({ columns, onDownloadTemplate, children }: { columns: string; onDownloadTemplate?: () => void; children?: ReactNode }) {
  return (
    <div style={{ border: '2px dashed #E5E7EB', borderRadius: 12, padding: 18, background: '#F8FAFC', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600 }}>⬆ Tarik &amp; lepas file CSV di sini, atau klik untuk pilih</p>
          <p style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }}>Kolom: {columns}</p>
        </div>
        {onDownloadTemplate && (
          <button
            onClick={(ev) => { ev.stopPropagation(); onDownloadTemplate() }}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 12px', borderRadius: 8, background: '#fff', color: '#0EA5E9', border: '1px solid #0EA5E9', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            ⬇ Download template
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

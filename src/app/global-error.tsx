'use client'
import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[global error]', error)
  }, [error])

  return (
    <html lang="id">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#F8F9FC' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: 400, padding: 24, borderRadius: 16, border: '1px solid #FECACA', background: '#FFFFFF', textAlign: 'center' }}>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: '#991B1B', margin: '0 0 8px' }}>Critical error</h1>
            <p style={{ fontSize: 14, color: '#4B5563', margin: '0 0 4px', wordBreak: 'break-word' }}>{error.message || 'Unknown error'}</p>
            {error.digest && <p style={{ fontSize: 10, color: '#9CA3AF', margin: '0 0 16px' }}>Ref: {error.digest}</p>}
            <button
              onClick={reset}
              style={{ padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500, background: '#DC2626', color: '#FFFFFF', border: 'none', cursor: 'pointer' }}
            >
              Coba lagi
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}

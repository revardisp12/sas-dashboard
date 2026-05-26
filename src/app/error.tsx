'use client'
import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[route error]', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8F9FC' }}>
      <div className="max-w-md p-6 rounded-2xl border bg-white text-center" style={{ borderColor: '#FECACA' }}>
        <h1 className="text-base font-bold mb-2" style={{ color: '#991B1B' }}>Ada error</h1>
        <p className="text-sm mb-1 break-words" style={{ color: '#4B5563' }}>{error.message || 'Unknown error'}</p>
        {error.digest && (
          <p className="text-[10px] mb-4" style={{ color: '#9CA3AF' }}>Ref: {error.digest}</p>
        )}
        <div className="flex gap-2 justify-center mt-4">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: '#DC2626', color: '#FFFFFF' }}
          >
            Coba lagi
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: '#F3F4F6', color: '#374151' }}
          >
            Ke beranda
          </button>
        </div>
      </div>
    </div>
  )
}

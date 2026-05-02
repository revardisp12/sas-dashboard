'use client'
import { useState, FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const err = await signIn(email, password)
    if (err) setError(err)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8F9FC' }}>
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #C9A96E, #8FB050)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 3h18v18H3z" fill="white" fillOpacity=".15" />
              <path d="M7 17l3-4 2 2 3-5 2 7H7z" fill="white" />
            </svg>
          </div>
          <h1 className="text-xl font-bold" style={{ color: '#111827' }}>SAS Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>PT Sinergi Ayu Semesta</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl shadow-sm border px-8 py-8" style={{ background: '#fff', borderColor: '#E5E7EB' }}>
          <h2 className="text-base font-semibold mb-6" style={{ color: '#374151' }}>Masuk ke akun kamu</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="kamu@company.com"
                className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none transition-all"
                style={{ borderColor: '#D1D5DB', background: '#F9FAFB', color: '#111827' }}
                onFocus={e => (e.target.style.borderColor = '#C9A96E')}
                onBlur={e => (e.target.style.borderColor = '#D1D5DB')}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none transition-all"
                style={{ borderColor: '#D1D5DB', background: '#F9FAFB', color: '#111827' }}
                onFocus={e => (e.target.style.borderColor = '#C9A96E')}
                onBlur={e => (e.target.style.borderColor = '#D1D5DB')}
              />
            </div>

            {error && (
              <div className="rounded-lg px-3 py-2.5 text-xs" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity"
              style={{ background: 'linear-gradient(135deg, #C9A96E, #B8924A)', color: '#fff', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Masuk...' : 'Masuk'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#9CA3AF' }}>
          Belum punya akun? Hubungi admin.
        </p>
      </div>
    </div>
  )
}

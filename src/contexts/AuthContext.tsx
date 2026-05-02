'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, type UserProfile, type UserRole } from '@/lib/supabase'
import type { Brand, ActiveView } from '@/lib/types'

interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  profileLoading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  canAccess: (view: ActiveView) => boolean
  accessibleBrands: Brand[]
}

const AuthContext = createContext<AuthContextValue | null>(null)

const ROLE_VIEWS: Record<UserRole, ActiveView[]> = {
  super_admin: ['overview','funnel','sales','crm','product-analysis','google-ads','meta-ads','tiktok-shop','shopee','instagram','tiktok-organic','settings'],
  admin:       ['overview','funnel','sales','crm','product-analysis','google-ads','meta-ads','tiktok-shop','shopee','instagram','tiktok-organic','settings'],
  manager:     ['overview','funnel','sales','crm','product-analysis','google-ads','meta-ads','tiktok-shop','shopee','instagram','tiktok-organic','settings'],
  cs:          ['sales'],
  crm:         ['crm'],
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  async function fetchProfile(userId: string) {
    setProfileLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) console.error('fetchProfile error:', error)
      setProfile(data ?? null)
    } finally {
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id).finally(() => setLoading(false))
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  function canAccess(view: ActiveView): boolean {
    if (!profile) return false
    return ROLE_VIEWS[profile.role]?.includes(view) ?? false
  }

  const accessibleBrands: Brand[] = profile?.role === 'super_admin'
    ? ['reglow', 'amura']
    : profile?.brand
      ? [profile.brand as Brand]
      : []

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileLoading, signIn, signOut, canAccess, accessibleBrands }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, key)

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'cs' | 'crm'
export type UserBrand = 'reglow' | 'amura' | 'purela' | null

export interface UserProfile {
  id: string
  full_name: string | null
  role: UserRole
  brand: UserBrand
  created_at: string
}

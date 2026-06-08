'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Brand } from '@/lib/types'

/** Re-runs `onChange` when WMS sync writes rows for the active brand. */
export function useRealtimeSync(brand: Brand, onChange: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel(`wms-sync-${brand}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales', filter: `brand=eq.${brand}` },
        onChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm', filter: `brand=eq.${brand}` },
        onChange
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [brand, onChange])
}

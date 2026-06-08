'use client'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Brand } from '@/lib/types'

/**
 * Re-runs `onChange` when WMS sync writes rows for the active brand.
 * Events are debounced (800ms) so a burst of row upserts during a sync
 * collapses into a single refresh instead of one per row.
 */
export function useRealtimeSync(brand: Brand, onChange: () => void) {
  const onChangeRef = useRef(onChange)
  // Keep the ref in sync with the latest callback without re-running the
  // subscription effect. useLayoutEffect runs synchronously after DOM paint
  // so the ref is always fresh before any async event fires.
  useLayoutEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const fire = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { onChangeRef.current() }, 800)
    }
    const channel = supabase
      .channel(`wms-sync-${brand}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `brand=eq.${brand}` }, fire)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm', filter: `brand=eq.${brand}` }, fire)
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [brand])
}

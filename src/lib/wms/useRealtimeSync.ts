'use client'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Brand } from '@/lib/types'

/**
 * Re-runs `onChange` when WMS sync writes rows for the active brand.
 * Events are debounced (800ms) so a burst of row upserts during a sync
 * collapses into a single refresh instead of one per row. If `onChange`
 * returns a promise and is still in flight when the debounce fires again,
 * no new call is started until it settles; instead exactly one more call
 * runs afterward to catch up on the coalesced trailing event.
 */
export function useRealtimeSync(brand: Brand, onChange: () => void | Promise<void>) {
  const onChangeRef = useRef(onChange)
  // Keep the ref in sync with the latest callback without re-running the
  // subscription effect. useLayoutEffect runs synchronously after DOM paint
  // so the ref is always fresh before any async event fires.
  useLayoutEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let inFlight = false
    let pending = false
    const run = () => {
      if (inFlight) {
        pending = true
        return
      }
      inFlight = true
      Promise.resolve(onChangeRef.current()).finally(() => {
        inFlight = false
        if (pending) {
          pending = false
          run()
        }
      })
    }
    const fire = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { run() }, 800)
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

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import type { DbPort, LogPort } from './sync'

type Client = ReturnType<typeof createClient<Database>>

const UPSERT_BATCH = 1000 // high-volume brands (e.g. Purela ~5.8k orders/day) exceed PostgREST's single-payload limits

export function dbPort(supabase: Client): DbPort {
  return {
    async upsert(table, rows, onConflict) {
      for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
        const chunk = rows.slice(i, i + UPSERT_BATCH)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is a runtime string; Supabase's .from() overloads require a literal type union, so a narrow cast on the table arg is unavoidable
        const { error } = await supabase.from(table as any).upsert(chunk, { onConflict })
        if (error) return { error: { message: error.message } }
      }
      return { error: null }
    },
    async deleteWmsInRange(table, brand, start, end) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime table string; .from() needs a literal union
      const { error } = await (supabase.from(table as any) as any)
        .delete()
        .eq('origin', 'wms')
        .eq('brand', brand)
        .gte('date', start)
        .lte('date', end)
      return error ? { error: { message: error.message } } : { error: null }
    },
  }
}

export function logPort(supabase: Client): LogPort {
  return {
    async start(meta) {
      const { data, error } = await supabase.from('sync_log')
        .insert({ trigger: meta.trigger, triggered_by: meta.triggeredBy ?? null, brand: meta.brand ?? null, status: 'running' })
        .select('id').single()
      if (error) throw new Error(error.message)
      return data.id
    },
    async finish(id, patch) {
      await supabase.from('sync_log')
        .update({ status: patch.status, tables: patch.tables, error: patch.error ?? null, finished_at: new Date().toISOString() })
        .eq('id', id)
    },
  }
}

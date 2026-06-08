import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import type { DbPort, LogPort } from './sync'

type Client = ReturnType<typeof createClient<Database>>

export function dbPort(supabase: Client): DbPort {
  return {
    async upsert(table, rows, onConflict) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is a runtime string; Supabase's .from() overloads require a literal type union, so a narrow cast on the table arg is unavoidable
      const { error } = await supabase.from(table as any).upsert(rows, { onConflict })
      return { error: error ? { message: error.message } : null }
    },
  }
}

export function logPort(supabase: Client): LogPort {
  return {
    async start(meta) {
      const { data, error } = await supabase.from('sync_log')
        .insert({ trigger: meta.trigger, triggered_by: meta.triggeredBy ?? null, status: 'running' })
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

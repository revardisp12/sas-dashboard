import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import type { DbPort, LogPort } from './sync'

type Client = ReturnType<typeof createClient<Database>>

export function dbPort(supabase: Client): DbPort {
  return {
    async upsert(table, rows, onConflict) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table name + new columns not yet in generated Database types (added in a later task)
      const { error } = await (supabase.from(table as any) as any).upsert(rows, { onConflict })
      return { error: error ? { message: error.message } : null }
    },
  }
}

export function logPort(supabase: Client): LogPort {
  return {
    async start(meta) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- sync_log not yet in generated Database types (added in a later task)
      const { data, error } = await (supabase.from('sync_log' as any) as any)
        .insert({ trigger: meta.trigger, triggered_by: meta.triggeredBy ?? null, status: 'running' })
        .select('id').single()
      if (error) throw new Error(error.message)
      return data.id as string
    },
    async finish(id, patch) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- sync_log not yet in generated Database types (added in a later task)
      await (supabase.from('sync_log' as any) as any)
        .update({ status: patch.status, tables: patch.tables, error: patch.error ?? null, finished_at: new Date().toISOString() })
        .eq('id', id)
    },
  }
}

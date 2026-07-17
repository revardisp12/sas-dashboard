import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import type { DbPort, LogPort } from './sync'
import { SyncAlreadyRunningError } from './sync'

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
    async deleteStaleWmsInRange(table, brand, start, end, syncStartedAt) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime table string; .from() needs a literal union
      const { error } = await (supabase.from(table as any) as any)
        .delete()
        .eq('origin', 'wms')
        .eq('brand', brand)
        .gte('date', start)
        .lte('date', end)
        .or(`synced_at.is.null,synced_at.lt.${syncStartedAt}`)
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
      if (error) {
        // 23505 = unique_violation. The sync_log_one_running partial unique index (see
        // wms_sync_log_concurrency_guard.sql) rejects this insert when another run is already
        // 'running' — hasRunningSync()'s SELECT check above is a separate round-trip, not
        // atomic with this insert, so this is the guard's actual race-closing enforcement.
        if (error.code === '23505') throw new SyncAlreadyRunningError(error.message)
        throw new Error(error.message)
      }
      return data.id
    },
    async finish(id, patch) {
      const { error } = await supabase.from('sync_log')
        .update({ status: patch.status, tables: patch.tables, error: patch.error ?? null, finished_at: new Date().toISOString() })
        .eq('id', id)
      // If this update fails, the sync_log row is stuck showing 'running' forever with no
      // error message recorded — log it so the failure is at least visible server-side,
      // even though there's nothing further to retry (the sync itself already finished).
      if (error) console.error(`[logPort.finish] failed to update sync_log ${id}:`, error.message)
    },
    async hasRunningSync(brands) {
      // The manual/cron routes cap at maxDuration=300s (webhook has no explicit cap, but
      // finishes well under that); past that, a 'running' row can only mean the run crashed
      // or timed out without ever calling finish(). 10 minutes gives a deliberately generous
      // margin above that 300s ceiling.
      const staleCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString()

      // Self-heal stale rows BEFORE checking. The sync_log_one_running unique index (see
      // wms_sync_log_concurrency_guard.sql) is the guard's actual race-closing enforcement,
      // and it has no time dimension of its own — without this reap, a single crashed run
      // that never called finish() would leave a 'running' row that permanently blocks every
      // future start() (the insert keeps hitting the unique-violation forever, silently
      // surfacing as 'skipped' on every subsequent sync attempt). Running this on every
      // hasRunningSync() call — i.e. every sync attempt: hourly cron, every webhook delivery,
      // every manual click — means a stuck row self-heals on the very next attempt after the
      // cutoff, not just once at migration time. A failed reap fails open (logged, not thrown)
      // so a transient error here can't block a legitimate sync either.
      const { error: reapError } = await supabase.from('sync_log')
        .update({ status: 'failed', error: 'auto-reaped: stuck in running past staleness cutoff (run crashed or timed out without calling finish)', finished_at: new Date().toISOString() })
        .eq('status', 'running')
        .lt('started_at', staleCutoff)
      if (reapError) console.error('[logPort.hasRunningSync] reap of stale running rows failed:', reapError.message)

      const { data, error } = await supabase.from('sync_log')
        .select('id')
        .eq('status', 'running')
        .gte('started_at', staleCutoff)
        .or(`brand.is.null,brand.in.(${brands.join(',')})`)
        .limit(1)
      if (error) {
        // Fail OPEN, not closed — a query failure here must not silently block every
        // legitimate sync from ever running again.
        console.error('[logPort.hasRunningSync] query failed:', error.message)
        return false
      }
      return (data?.length ?? 0) > 0
    },
  }
}

// Minimal in-memory Supabase stand-in for unit tests. Honors upsert onConflict so
// idempotency is actually exercised. NOT for production use.
type Row = Record<string, unknown>

export class FakeSupabase {
  store: Record<string, Row[]> = {}
  failTable: string | null = null            // force an error on a given table to test isolation

  from(table: string) {
    const self = this
    return {
      async insert(rows: Row[]) {
        if (self.failTable === table) return { error: { message: `forced fail on ${table}` } }
        self.store[table] = (self.store[table] ?? []).concat(rows)
        return { error: null }
      },
      async upsert(rows: Row[], opts: { onConflict: string }) {
        if (self.failTable === table) return { error: { message: `forced fail on ${table}` } }
        const keys = opts.onConflict.split(',').map(s => s.trim())
        const existing = self.store[table] ?? (self.store[table] = [])
        for (const r of rows) {
          const idx = existing.findIndex(e => keys.every(k => e[k] === r[k]))
          if (idx >= 0) existing[idx] = r
          else existing.push(r)
        }
        return { error: null }
      },
    }
  }
}

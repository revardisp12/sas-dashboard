// Minimal in-memory Supabase stand-in for unit tests. Honors upsert onConflict so
// idempotency is actually exercised, and a small subset of the select/filter chain used by
// logPort.hasRunningSync so that the REAL query (not just a hand-written test double standing
// in for it) gets exercised. NOT for production use.
type Row = Record<string, unknown>
type PgError = { message: string; code?: string }

// Split a PostgREST or() expression on top-level commas only — "brand.in.(a,b)" must not be
// split on the comma inside the parens the way expr.split(',') would.
function splitTopLevel(expr: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < expr.length; i++) {
    if (expr[i] === '(') depth++
    else if (expr[i] === ')') depth--
    else if (expr[i] === ',' && depth === 0) { parts.push(expr.slice(start, i)); start = i + 1 }
  }
  parts.push(expr.slice(start))
  return parts
}

function orClauseFilter(clause: string): (row: Row) => boolean {
  const [col, op, ...rest] = clause.split('.')
  const val = rest.join('.')
  if (op === 'is' && val === 'null') return row => row[col] == null
  if (op === 'in') {
    const list = val.replace(/^\(|\)$/g, '').split(',').filter(Boolean)
    return row => list.includes(String(row[col]))
  }
  if (op === 'eq') return row => String(row[col]) === val
  throw new Error(`FakeSupabase: unsupported or() operator "${op}" in "${clause}"`)
}

// Thenable so it works whether the real call chain ends after one filter (.eq(...), as
// logPort.finish does) or two (.eq(...).lt(...), as the hasRunningSync reap does) — each
// filter method returns `this`, and `await`-ing at any point resolves via `then`.
class FakeUpdateQuery implements PromiseLike<{ error: PgError | null }> {
  private filters: Array<(row: Row) => boolean> = []
  constructor(private fake: FakeSupabase, private table: string, private patch: Row) {}

  eq(col: string, val: unknown) { this.filters.push(row => row[col] === val); return this }
  lt(col: string, val: string) { this.filters.push(row => String(row[col] ?? '') < val); return this }

  private exec(): { error: PgError | null } {
    if (this.fake.failTable === this.table) return { error: { message: `forced fail on ${this.table}` } }
    const rows = this.fake.store[this.table] ?? []
    for (const r of rows) if (this.filters.every(f => f(r))) Object.assign(r, this.patch)
    return { error: null }
  }
  then<TResult1 = { error: PgError | null }, TResult2 = never>(
    onfulfilled?: ((value: { error: PgError | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.exec()).then(onfulfilled, onrejected)
  }
}

class FakeSelectQuery {
  private filters: Array<(row: Row) => boolean> = []
  constructor(private rows: Row[], private forcedError: PgError | null) {}

  eq(col: string, val: unknown) { this.filters.push(row => row[col] === val); return this }
  gte(col: string, val: string) { this.filters.push(row => String(row[col] ?? '') >= val); return this }
  or(expr: string) {
    const clauses = splitTopLevel(expr).map(orClauseFilter)
    this.filters.push(row => clauses.some(f => f(row)))
    return this
  }
  async limit(n: number) {
    if (this.forcedError) return { data: null, error: this.forcedError }
    const out = this.rows.filter(r => this.filters.every(f => f(r))).slice(0, n)
    return { data: out, error: null }
  }
}

export class FakeSupabase {
  store: Record<string, Row[]> = {}
  failTable: string | null = null             // force an error on a given table to test isolation
  forcedInsertError: PgError | null = null    // simulate e.g. a unique-violation (code '23505') on the next insert().select().single()

  from(table: string) {
    return {
      insert: (row: Row) => ({
        select: (_cols: string) => ({
          single: async () => {
            if (this.forcedInsertError) return { data: null, error: this.forcedInsertError }
            if (this.failTable === table) return { data: null, error: { message: `forced fail on ${table}` } }
            const saved = { id: `fake-${(this.store[table]?.length ?? 0) + 1}`, ...row }
            this.store[table] = (this.store[table] ?? []).concat([saved])
            return { data: saved, error: null }
          },
        }),
      }),
      upsert: async (rows: Row[], opts: { onConflict: string }) => {
        if (this.failTable === table) return { error: { message: `forced fail on ${table}` } }
        const keys = opts.onConflict.split(',').map(s => s.trim())
        const existing = this.store[table] ?? (this.store[table] = [])
        for (const r of rows) {
          const idx = existing.findIndex(e => keys.every(k => e[k] === r[k]))
          if (idx >= 0) existing[idx] = r
          else existing.push(r)
        }
        return { error: null }
      },
      select: (_cols: string) => new FakeSelectQuery(
        this.store[table] ?? [],
        this.failTable === table ? { message: `forced fail on ${table}` } : null,
      ),
      update: (patch: Row) => new FakeUpdateQuery(this, table, patch),
    }
  }
}

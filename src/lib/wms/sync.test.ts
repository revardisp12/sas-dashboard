import { describe, it, expect } from 'vitest'
import { runWmsSync, dedupeByKeys, type DbPort, type LogPort } from './sync'
import { MockWmsAdapter } from './mockAdapter'
import { FakeSupabase } from './fakeSupabase'
import type { Brand } from '@/lib/types'

function makePorts(fake: FakeSupabase): { db: DbPort; log: LogPort } {
  const db: DbPort = {
    async upsert(table, rows, onConflict) {
      return fake.from(table).upsert(rows as Record<string, unknown>[], { onConflict })
    },
    async deleteStaleWmsInRange(table, brand, start, end, syncStartedAt) {
      const ex = fake.store[table] ?? []
      fake.store[table] = ex.filter(r => !(
        r.origin === 'wms' && r.brand === brand && String(r.date) >= start && String(r.date) <= end
        && (r.synced_at == null || String(r.synced_at) < syncStartedAt)
      ))
      return { error: null }
    },
  }
  const log: LogPort = {
    async start() { return 'log-1' },
    async finish() { /* no-op */ },
  }
  return { db, log }
}

const opts = (over: Partial<Parameters<typeof runWmsSync>[0]['opts']> = {}) => ({
  brands: ['reglow', 'amura'] as Brand[],
  tables: ['sales', 'crm'] as const,
  range: { start: '2026-06-01', end: '2026-06-02' },
  trigger: 'manual' as const,
  ...over,
})

describe('runWmsSync', () => {
  it('upserts WMS rows with origin=wms and is idempotent across two runs', async () => {
    const fake = new FakeSupabase()
    const { db, log } = makePorts(fake)
    const adapter = new MockWmsAdapter()

    const r1 = await runWmsSync({ adapter, db, log, opts: opts() })
    const salesAfter1 = fake.store['sales'].length
    expect(r1.status).toBe('success')
    expect(fake.store['sales'].every(r => r.origin === 'wms')).toBe(true)

    const r2 = await runWmsSync({ adapter, db, log, opts: opts() })
    const salesAfter2 = fake.store['sales'].length
    expect(salesAfter2).toBe(salesAfter1)
    expect(r2.status).toBe('success')
  })

  it('isolates per-brand failure -> status partial, other brand still written', async () => {
    const fake = new FakeSupabase()
    const { db, log } = makePorts(fake)
    const adapter = new MockWmsAdapter()
    const orig = adapter.fetchSales.bind(adapter)
    adapter.fetchSales = async (brand, range) => {
      if (brand === 'amura') throw new Error('boom')
      return orig(brand, range)
    }
    const res = await runWmsSync({ adapter, db, log, opts: opts({ tables: ['sales'] }) })
    expect(res.status).toBe('partial')
    expect(res.perBrand.find(b => b.brand === 'amura')!.ok).toBe(false)
    expect(res.perBrand.find(b => b.brand === 'reglow')!.ok).toBe(true)
    expect(fake.store['sales'].some(r => r.brand === 'reglow')).toBe(true)
  })

  it('skips tables the adapter does not expose', async () => {
    const fake = new FakeSupabase()
    const { db, log } = makePorts(fake)
    const adapter = new MockWmsAdapter()
    // @ts-expect-error intentionally deleting optional method
    delete adapter.fetchProducts
    const res = await runWmsSync({ adapter, db, log, opts: opts({ tables: ['products'] }) })
    expect(res.tables['products'] ?? 0).toBe(0)
    expect(res.status).toBe('success')
  })

  it('dedupes duplicate wms_ids before upsert (a paginated read over live data can surface an id twice)', async () => {
    // A DbPort that mimics Postgres exactly: a single payload repeating a conflict key errors.
    const captured: Record<string, unknown[]> = {}
    const db: DbPort = {
      async upsert(table, rows, onConflict) {
        const keys = onConflict.split(',')
        const seen = new Set<string>()
        for (const r of rows as Record<string, unknown>[]) {
          const k = keys.map(c => String(r[c])).join('|')
          if (seen.has(k)) return { error: { message: 'ON CONFLICT DO UPDATE command cannot affect row a second time' } }
          seen.add(k)
        }
        captured[table] = (captured[table] ?? []).concat(rows)
        return { error: null }
      },
      async deleteStaleWmsInRange() { return { error: null } },
    }
    const log: LogPort = { async start() { return 'l' }, async finish() { /* no-op */ } }
    // Adapter returns the SAME wms_id twice for sales (simulating the pagination race).
    const adapter = new MockWmsAdapter()
    const dupRow = { wmsId: 'ord-1', date: '2026-06-01', product: 'A', qty: 1, revenue: 100, channel: 'shopee', cogs: 0, grossProfit: 100, source: 'organic', origin: 'wms' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapter.fetchSales = async () => [dupRow, { ...dupRow }] as any

    const res = await runWmsSync({ adapter, db, log, opts: opts({ brands: ['reglow'] as Brand[], tables: ['sales'] }) })
    expect(res.status).toBe('success')           // dedup prevented the ON CONFLICT crash
    expect(captured['sales']).toHaveLength(1)     // the duplicate was collapsed
    expect(res.tables['sales']).toBe(1)
  })

  it('scope-replaces ranged tables: wipes stale WMS rows in range, keeps manual + out-of-range', async () => {
    const fake = new FakeSupabase()
    // Pre-seed rows that the fresh pull would NOT re-create (old channel mapping, etc.).
    fake.store['sales'] = [
      { brand: 'reglow', wms_id: 'ord-STALE', origin: 'wms', date: '2026-06-10', channel: 'cs', revenue: 999 }, // stale, in range -> DELETE
      { brand: 'reglow', wms_id: null, origin: 'manual', date: '2026-06-10', channel: 'cs', revenue: 111 },     // manual -> KEEP
      { brand: 'reglow', wms_id: 'ord-FAR', origin: 'wms', date: '2026-01-01', channel: 'cs', revenue: 222 },   // out of range -> KEEP
    ]
    const { db, log } = makePorts(fake)
    const adapter = new MockWmsAdapter()
    const res = await runWmsSync({ adapter, db, log, opts: opts({ brands: ['reglow'] as Brand[], tables: ['sales'], range: { start: '2026-06-01', end: '2026-06-30' } }) })

    expect(res.status).toBe('success')
    const sales = fake.store['sales']
    expect(sales.some(r => r.wms_id === 'ord-STALE')).toBe(false)                 // stale in-range removed
    expect(sales.some(r => r.origin === 'manual' && r.revenue === 111)).toBe(true) // manual untouched
    expect(sales.some(r => r.wms_id === 'ord-FAR')).toBe(true)                     // out-of-range untouched
    expect(sales.some(r => r.origin === 'wms' && String(r.date) >= '2026-06-01')).toBe(true) // fresh pull inserted
  })

  it('an empty fresh pull still clears existing rows in range (previously the rows.length===0 guard skipped cleanup too)', async () => {
    const fake = new FakeSupabase()
    fake.store['sales'] = [
      { brand: 'reglow', wms_id: 'ord-GONE', origin: 'wms', date: '2026-06-10', channel: 'cs', revenue: 500 }, // no longer in the fresh pull -> must be cleared
    ]
    const { db, log } = makePorts(fake)
    const adapter = new MockWmsAdapter()
    adapter.fetchSales = async () => [] // upstream: this range now has zero orders (all cancelled)
    const res = await runWmsSync({ adapter, db, log, opts: opts({ brands: ['reglow'] as Brand[], tables: ['sales'], range: { start: '2026-06-01', end: '2026-06-30' } }) })
    expect(res.status).toBe('success')
    expect(fake.store['sales'].some(r => r.wms_id === 'ord-GONE')).toBe(false)
  })

  it('a failed upsert leaves prior data fully intact (delete only runs after upsert succeeds)', async () => {
    const fake = new FakeSupabase()
    fake.store['sales'] = [
      { brand: 'reglow', wms_id: 'ord-OLD', origin: 'wms', date: '2026-06-10', channel: 'cs', revenue: 777, synced_at: '2020-01-01T00:00:00.000Z' },
    ]
    let deleteWasCalled = false
    const db: DbPort = {
      async upsert() { return { error: { message: 'simulated network failure' } } },
      async deleteStaleWmsInRange(table, brand, start, end, syncStartedAt) {
        deleteWasCalled = true
        const ex = fake.store[table] ?? []
        fake.store[table] = ex.filter(r => !(
          r.origin === 'wms' && r.brand === brand && String(r.date) >= start && String(r.date) <= end
          && (r.synced_at == null || String(r.synced_at) < syncStartedAt)
        ))
        return { error: null }
      },
    }
    const log: LogPort = { async start() { return 'l' }, async finish() { /* no-op */ } }
    const adapter = new MockWmsAdapter() // returns non-empty fresh rows for reglow/sales over a 30-day range

    const res = await runWmsSync({ adapter, db, log, opts: opts({ brands: ['reglow'] as Brand[], tables: ['sales'], range: { start: '2026-06-01', end: '2026-06-30' } }) })

    expect(res.status).toBe('failed')
    expect(deleteWasCalled).toBe(false)                                  // the throw from upsert happens BEFORE delete is ever attempted
    expect(fake.store['sales'].some(r => r.wms_id === 'ord-OLD')).toBe(true) // old data survives a failed sync intact
  })

  it('does NOT scope-delete non-ranged tables (products keyed by sku/wms_id, upsert handles them)', async () => {
    const fake = new FakeSupabase()
    fake.store['products'] = [
      { brand: 'reglow', wms_id: 'prod-KEEP', origin: 'wms', sku: 'OLD', name: 'old' }, // no date; must survive a products sync
    ]
    const { db, log } = makePorts(fake)
    const adapter = new MockWmsAdapter()
    const res = await runWmsSync({ adapter, db, log, opts: opts({ brands: ['reglow'] as Brand[], tables: ['products'] }) })
    expect(res.status).toBe('success')
    expect(fake.store['products'].some(r => r.wms_id === 'prod-KEEP')).toBe(true) // not wiped (non-ranged)
  })

  it('skips remaining tables of a brand after its first table fails', async () => {
    const fake = new FakeSupabase()
    const { db, log } = makePorts(fake)
    const adapter = new MockWmsAdapter()
    // amura's sales (first table) throws; its crm (second table) must be skipped.
    const origSales = adapter.fetchSales.bind(adapter)
    adapter.fetchSales = async (brand, range) => {
      if (brand === 'amura') throw new Error('sales boom')
      return origSales(brand, range)
    }
    const res = await runWmsSync({ adapter, db, log, opts: opts({ brands: ['reglow', 'amura'] as Brand[], tables: ['sales', 'crm'] }) })
    expect(res.status).toBe('partial')
    // amura wrote nothing (sales threw, crm skipped due to break)
    expect((fake.store['sales'] ?? []).some(r => r.brand === 'amura')).toBe(false)
    expect((fake.store['crm'] ?? []).some(r => r.brand === 'amura')).toBe(false)
    // reglow wrote both tables
    expect((fake.store['sales'] ?? []).some(r => r.brand === 'reglow')).toBe(true)
    expect((fake.store['crm'] ?? []).some(r => r.brand === 'reglow')).toBe(true)
  })
})

describe('dedupeByKeys', () => {
  it('keeps one row per composite key (last occurrence wins)', () => {
    const rows = [
      { brand: 'reglow', wms_id: 'sc-1', revenue: 100 },
      { brand: 'reglow', wms_id: 'sc-2', revenue: 200 },
      { brand: 'reglow', wms_id: 'sc-1', revenue: 150 }, // dup key -> last wins
      { brand: 'amura', wms_id: 'sc-1', revenue: 300 },  // different brand -> kept
    ]
    const out = dedupeByKeys(rows, ['brand', 'wms_id'])
    expect(out).toHaveLength(3)
    expect(out.find(r => r.brand === 'reglow' && r.wms_id === 'sc-1')!.revenue).toBe(150)
    expect(out.some(r => r.brand === 'amura' && r.wms_id === 'sc-1')).toBe(true)
  })

  it('treats null/undefined key parts as empty (no collisions across distinct ids)', () => {
    const rows = [
      { brand: 'reglow', wms_id: null },
      { brand: 'reglow', wms_id: undefined },
    ]
    // both collapse to the same empty key — manual rows (wms_id null) are never upserted via WMS
    expect(dedupeByKeys(rows, ['brand', 'wms_id'])).toHaveLength(1)
  })
})

describe('runWmsSync log.start brand scoping (sync_log RLS relies on this)', () => {
  it('passes the single brand to log.start for a single-brand run', async () => {
    const fake = new FakeSupabase()
    const { db } = makePorts(fake)
    let startedWith: Parameters<LogPort['start']>[0] | undefined
    const log: LogPort = {
      async start(meta) { startedWith = meta; return 'log-1' },
      async finish() { /* no-op */ },
    }
    await runWmsSync({ adapter: new MockWmsAdapter(), db, log, opts: opts({ brands: ['reglow'] as Brand[] }) })
    expect(startedWith?.brand).toBe('reglow')
  })

  it('omits brand (undefined) for a multi-brand run — sync_log row stays a blended cross-brand entry', async () => {
    const fake = new FakeSupabase()
    const { db } = makePorts(fake)
    let startedWith: Parameters<LogPort['start']>[0] | undefined
    const log: LogPort = {
      async start(meta) { startedWith = meta; return 'log-1' },
      async finish() { /* no-op */ },
    }
    await runWmsSync({ adapter: new MockWmsAdapter(), db, log, opts: opts({ brands: ['reglow', 'amura'] as Brand[] }) })
    expect(startedWith?.brand).toBeUndefined()
  })
})

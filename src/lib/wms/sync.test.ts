import { describe, it, expect } from 'vitest'
import { runWmsSync, type DbPort, type LogPort } from './sync'
import { MockWmsAdapter } from './mockAdapter'
import { FakeSupabase } from './fakeSupabase'
import type { Brand } from '@/lib/types'

function makePorts(fake: FakeSupabase): { db: DbPort; log: LogPort } {
  const db: DbPort = {
    async upsert(table, rows, onConflict) {
      return fake.from(table).upsert(rows as Record<string, unknown>[], { onConflict })
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

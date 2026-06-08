import { describe, it, expect } from 'vitest'
import { salesToDb, crmToDb, productToDb, googleAdsToDb, metaAdsToDb } from './mappers'
import type { WithWmsId } from './types'
import type { SalesRow } from '@/lib/types'

describe('salesToDb', () => {
  it('maps camelCase row to snake_case DB record with origin=wms and wms_id', () => {
    const row: WithWmsId<SalesRow> = {
      wmsId: 'ord_1', date: '2026-06-01', product: 'SKU1', qty: 2, revenue: 100000,
      channel: 'cs', cogs: 40000, grossProfit: 60000, customerName: 'Budi',
      phone: '0812', address: 'Jl', source: 'meta-ads',
    }
    expect(salesToDb(row, 'reglow')).toEqual({
      brand: 'reglow', wms_id: 'ord_1', origin: 'wms',
      date: '2026-06-01', product: 'SKU1', qty: 2, revenue: 100000,
      channel: 'cs', cogs: 40000, gross_profit: 60000,
      customer_name: 'Budi', phone: '0812', address: 'Jl', source: 'meta-ads',
    })
  })
})

describe('productToDb', () => {
  it('maps product with margin computed and origin=wms', () => {
    const rec = productToDb({ wmsId: 'p_1', id: 'p_1', sku: 'SKU1', name: 'Serum', price: 100, cogs: 40, margin: 0, brand: 'amura' }, 'amura')
    expect(rec.wms_id).toBe('p_1')
    expect(rec.origin).toBe('wms')
    expect(rec.brand).toBe('amura')
    expect(rec.sku).toBe('SKU1')
    expect(rec.margin).toBe(60)
  })

  it('returns margin 0 when price is 0', () => {
    const rec = productToDb({ wmsId: 'p_2', id: 'p_2', sku: 'SKU2', name: 'Free', price: 0, cogs: 0, margin: 0, brand: 'reglow' }, 'reglow')
    expect(rec.margin).toBe(0)
  })
})

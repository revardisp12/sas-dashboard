import { describe, it, expect } from 'vitest'
import { salesToDb, crmToDb, productToDb, googleAdsToDb, metaAdsToDb } from './mappers'
import type { WithWmsId } from './types'
import type { SalesRow, CRMRow, GoogleAdsRow, MetaAdsRow } from '@/lib/types'

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
    expect('id' in rec).toBe(false)
  })

  it('returns margin 0 when price is 0', () => {
    const rec = productToDb({ wmsId: 'p_2', id: 'p_2', sku: 'SKU2', name: 'Free', price: 0, cogs: 0, margin: 0, brand: 'reglow' }, 'reglow')
    expect(rec.margin).toBe(0)
  })
})

describe('crmToDb', () => {
  it('maps CRM row with origin=wms and snake_case customer_name', () => {
    const row: WithWmsId<CRMRow> = {
      wmsId: 'c_1', date: '2026-06-01', customerName: 'Sina', phone: '0813',
      product: 'SKU1', qty: 1, revenue: 50000,
    }
    expect(crmToDb(row, 'amura')).toMatchObject({
      brand: 'amura', wms_id: 'c_1', origin: 'wms',
      customer_name: 'Sina', product: 'SKU1', qty: 1, revenue: 50000,
    })
  })
})

describe('googleAdsToDb', () => {
  it('maps Google Ads row with origin=wms and conv_rate snake_case', () => {
    const row: WithWmsId<GoogleAdsRow> = {
      wmsId: 'g_1', date: '2026-06-01', campaign: 'C',
      impressions: 100, clicks: 10, ctr: 10, cpc: 500,
      spend: 5000, conversions: 1, convRate: 10, roas: 2,
    }
    expect(googleAdsToDb(row, 'reglow')).toMatchObject({
      brand: 'reglow', wms_id: 'g_1', origin: 'wms',
      conv_rate: 10, campaign: 'C',
    })
  })
})

describe('metaAdsToDb', () => {
  it('maps Meta Ads row with origin=wms and flat fields', () => {
    const row: WithWmsId<MetaAdsRow> = {
      wmsId: 'm_1', date: '2026-06-01', campaign: 'M',
      reach: 200, impressions: 150, clicks: 12, ctr: 8,
      spend: 6000, purchases: 1, roas: 3, cpm: 2000, results: 1,
    }
    expect(metaAdsToDb(row, 'purela')).toMatchObject({
      brand: 'purela', wms_id: 'm_1', origin: 'wms',
      cpm: 2000, results: 1,
    })
  })
})

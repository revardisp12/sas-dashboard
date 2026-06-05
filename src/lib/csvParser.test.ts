import { describe, it, expect } from 'vitest'
import { toNum, parseProductItems, salesRowsFromRecord } from './csvParser'

describe('toNum', () => {
  it('parses plain integers and empty values', () => {
    expect(toNum('450000')).toBe(450000)
    expect(toNum('3')).toBe(3)
    expect(toNum('')).toBe(0)
    expect(toNum(null)).toBe(0)
    expect(toNum(undefined)).toBe(0)
  })

  it('parses Indonesian thousand+decimal format (1.234.567,89)', () => {
    expect(toNum('1.234.567,89')).toBeCloseTo(1234567.89)
    expect(toNum('Rp 1.234.567,89')).toBeCloseTo(1234567.89)
  })

  it('distinguishes decimal comma (1,72) from thousands comma (1,000)', () => {
    expect(toNum('1,72')).toBeCloseTo(1.72)
    expect(toNum('1,000')).toBe(1000)
  })

  it('treats a dot followed by exactly 3 digits as thousands (332.455)', () => {
    expect(toNum('332.455')).toBe(332455)
    expect(toNum('1.000.000')).toBe(1000000)
  })

  it('keeps a dot followed by 1-2 digits as a decimal (3.50)', () => {
    expect(toNum('3.50')).toBeCloseTo(3.5)
    expect(toNum('1.72')).toBeCloseTo(1.72)
  })

  it('strips Rp / % / whitespace', () => {
    expect(toNum('12%')).toBe(12)
    expect(toNum('  500  ')).toBe(500)
  })
})

describe('parseProductItems', () => {
  it('returns a single blank item for empty input', () => {
    expect(parseProductItems('')).toEqual([{ product: '', qty: 1 }])
  })

  it('parses a single "qty SKU" item', () => {
    expect(parseProductItems('2 AM-SS50')).toEqual([{ qty: 2, product: 'AM-SS50' }])
  })

  it('splits semicolon-separated items', () => {
    expect(parseProductItems('1 AM-RT-15;1 AM-RNP-30')).toEqual([
      { qty: 1, product: 'AM-RT-15' },
      { qty: 1, product: 'AM-RNP-30' },
    ])
  })

  it('falls back to comma separator when no semicolon present', () => {
    expect(parseProductItems('1 AM-RT-15,1 AM-RNP-30')).toEqual([
      { qty: 1, product: 'AM-RT-15' },
      { qty: 1, product: 'AM-RNP-30' },
    ])
  })

  it('expands space-separated SKUs without a qty prefix into qty-1 rows', () => {
    expect(parseProductItems('AMPDRNS AMPDRNC')).toEqual([
      { qty: 1, product: 'AMPDRNS' },
      { qty: 1, product: 'AMPDRNC' },
    ])
  })

  it('keeps a plain product name (with spaces) as one item', () => {
    expect(parseProductItems('Serum Vitamin C')).toEqual([{ qty: 1, product: 'Serum Vitamin C' }])
  })
})

describe('salesRowsFromRecord', () => {
  it('uses the Qty column for a single product', () => {
    const rows = salesRowsFromRecord({ Product: 'AM-SS50', Qty: '3', Revenue: '450000' })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ product: 'AM-SS50', qty: 3, revenue: 450000 })
  })

  it('preserves an explicit Qty of 0 (does not mask it as 1)', () => {
    const rows = salesRowsFromRecord({ Product: 'AM-SS50', Qty: '0', Revenue: '0' })
    expect(rows).toHaveLength(1)
    expect(rows[0].qty).toBe(0)
  })

  it('falls back to the product-prefix qty when the Qty column is absent/blank', () => {
    const rows = salesRowsFromRecord({ Product: '2 AM-SS50', Revenue: '100000' })
    expect(rows[0].qty).toBe(2)
  })

  it('splits multi-product revenue while conserving the total', () => {
    const rows = salesRowsFromRecord({ Product: '1 A-1;1 B-2;1 C-3', Revenue: '100' })
    expect(rows).toHaveLength(3)
    const sum = rows.reduce((s, r) => s + r.revenue, 0)
    expect(sum).toBe(100)
  })
})

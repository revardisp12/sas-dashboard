// src/lib/channels.test.ts
import { describe, it, expect } from 'vitest'
import { channelForId, isRevenueStatus, CHANNELS, channelLabel } from './channels'

describe('channels', () => {
  it('maps tracked WMS channel_id to canonical key', () => {
    expect(channelForId(4)).toBe('shopee')
    expect(channelForId(6)).toBe('tiktok')
    expect(channelForId(7)).toBe('tokopedia')
    expect(channelForId(5)).toBe('lazada')
    expect(channelForId(-3)).toBe('cs')
  })
  it('returns null for untracked channels (manual, distributor, etc.)', () => {
    expect(channelForId(1)).toBeNull()   // Manual
    expect(channelForId(-4)).toBeNull()  // Distributor
    expect(channelForId(2)).toBeNull()   // Open API
  })
  it('counts every status except cancelled / returned', () => {
    expect(isRevenueStatus('completed')).toBe(true)
    expect(isRevenueStatus('paid')).toBe(true)
    expect(isRevenueStatus('sent')).toBe(true)
    expect(isRevenueStatus('pending')).toBe(true)        // kept (matches finance)
    expect(isRevenueStatus('request_return')).toBe(true) // kept
    expect(isRevenueStatus('cancelled')).toBe(false)
    expect(isRevenueStatus('returned')).toBe(false)
    expect(isRevenueStatus('cancelled_return')).toBe(false)
  })
  it('exposes the 5 channels with labels', () => {
    expect(CHANNELS.map(c => c.key)).toEqual(['shopee', 'tiktok', 'tokopedia', 'lazada', 'cs'])
    expect(channelLabel('cs')).toBe('Customer Services')
  })
})

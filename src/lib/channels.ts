// src/lib/channels.ts

/** Canonical channel keys stored in sales.channel. */
export type ChannelKey = 'shopee' | 'tiktok' | 'tokopedia' | 'lazada' | 'cs'

export const CHANNELS: { key: ChannelKey; label: string }[] = [
  { key: 'shopee', label: 'Shopee' },
  { key: 'tiktok', label: 'TikTok Shop' },
  { key: 'tokopedia', label: 'Tokopedia' },
  { key: 'lazada', label: 'Lazada' },
  { key: 'cs', label: 'Customer Services' },
]

/** WMS channel_id -> canonical key. Anything not listed is dropped (Manual, Distributor, etc.). */
const ID_TO_CHANNEL: Record<number, ChannelKey> = {
  4: 'shopee',
  6: 'tiktok',
  7: 'tokopedia',
  5: 'lazada',
  // CS (channel -3) is intentionally absent — CS orders are pulled from /social-commerce
  // (split by customer_type), not /orders/list, to match the finance report.
}

export function channelForId(id: number): ChannelKey | null {
  return ID_TO_CHANNEL[id] ?? null
}

export function channelLabel(key: ChannelKey): string {
  return CHANNELS.find(c => c.key === key)?.label ?? key
}

/**
 * Statuses that are NOT revenue (cancelled / returned). Everything else counts — matching the
 * partner finance report: gross-of-discount, excluding only cancellations and returns.
 */
const NON_REVENUE_STATUSES = new Set(['cancelled', 'cancelled_return', 'returned'])

export function isRevenueStatus(status: string): boolean {
  return !NON_REVENUE_STATUSES.has(status)
}

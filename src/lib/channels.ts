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
  [-3]: 'cs',
}

export function channelForId(id: number): ChannelKey | null {
  return ID_TO_CHANNEL[id] ?? null
}

export function channelLabel(key: ChannelKey): string {
  return CHANNELS.find(c => c.key === key)?.label ?? key
}

/** Order statuses that count as revenue. Everything else (pending/cancelled/returned/…) is excluded. */
const REVENUE_STATUSES = new Set(['paid', 'packing', 'packed', 'pick', 'process', 'sent', 'completed'])

export function isRevenueStatus(status: string): boolean {
  return REVENUE_STATUSES.has(status)
}

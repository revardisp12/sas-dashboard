import type { Brand } from './types'

export const BRAND_COLORS: Record<Brand, string> = {
  reglow: '#C9A96E',
  amura: '#8FB050',
  purela: '#9B7FD4',
}

// Decimal RGB triplets matching BRAND_COLORS, for `rgba(${BRAND_RGB[b]}, a)`.
// Single source of truth — previously copy-pasted across 6+ components.
export const BRAND_RGB: Record<Brand, string> = {
  reglow: '201,169,110',
  amura: '143,176,80',
  purela: '155,127,212',
}

// Display names per brand. purela was previously rendered as "Amura" by
// hardcoded `brand === 'reglow' ? ... : 'Amura'` fallbacks.
export const BRAND_LABELS: Record<Brand, string> = {
  reglow: 'Reglow Skincare',
  amura: 'Amura',
  purela: 'Purela',
}

export function computeMargin(price: number, cogs: number): number {
  return price > 0 ? Math.round(((price - cogs) / price) * 100) : 0
}

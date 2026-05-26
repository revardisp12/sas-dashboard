import type { Brand } from './types'

export const BRAND_COLORS: Record<Brand, string> = {
  reglow: '#C9A96E',
  amura: '#8FB050',
  purela: '#9B7FD4',
}

export function computeMargin(price: number, cogs: number): number {
  return price > 0 ? Math.round(((price - cogs) / price) * 100) : 0
}

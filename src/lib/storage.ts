import { Brand, BrandData, emptyBrandData } from './types'

const KEY = 'sas-dashboard-data'

export function loadData(): Record<Brand, BrandData> {
  if (typeof window === 'undefined') return { reglow: emptyBrandData(), amura: emptyBrandData() }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { reglow: emptyBrandData(), amura: emptyBrandData() }
    return JSON.parse(raw)
  } catch {
    return { reglow: emptyBrandData(), amura: emptyBrandData() }
  }
}

export function saveData(data: Record<Brand, BrandData>) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(data))
}

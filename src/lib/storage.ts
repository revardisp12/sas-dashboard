import { Brand, BrandData, emptyBrandData, FollowUpTask, ProductMaster, BundleMaster } from './types'

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

export function resetData(): Record<Brand, BrandData> {
  const empty = { reglow: emptyBrandData(), amura: emptyBrandData() }
  if (typeof window !== 'undefined') localStorage.removeItem(KEY)
  return empty
}

const TASKS_KEY = 'sas-tasks'

export function loadTasks(): FollowUpTask[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(TASKS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveTasks(tasks: FollowUpTask[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks))
}

const PRODUCTS_KEY = 'sas-products'

export function loadProducts(): ProductMaster[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(PRODUCTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveProducts(products: ProductMaster[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products))
}

const BUNDLES_KEY = 'sas-bundles'

export function loadBundles(): BundleMaster[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(BUNDLES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveBundles(bundles: BundleMaster[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(BUNDLES_KEY, JSON.stringify(bundles))
}

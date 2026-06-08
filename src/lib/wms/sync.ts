import type { Brand } from '@/lib/types'
import type { WmsAdapter, SyncOptions, SyncResult, WmsTable, WmsDateRange } from './types'
import { salesToDb, crmToDb, productToDb, googleAdsToDb, metaAdsToDb } from './mappers'

export interface DbPort {
  upsert(table: string, rows: unknown[], onConflict: string): Promise<{ error: { message: string } | null }>
}
export interface LogPort {
  start(meta: { trigger: string; triggeredBy?: string }): Promise<string>
  finish(id: string, patch: { status: string; tables: Record<string, number>; error?: string }): Promise<void>
}

interface RunArgs { adapter: WmsAdapter; db: DbPort; log: LogPort; opts: SyncOptions }

const ON_CONFLICT = 'brand,wms_id'

// table -> { adapter method name, mapper, needsRange }
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mapper inputs are per-table row unions resolved at call site
const TABLE_PLAN: Record<WmsTable, { method: keyof WmsAdapter; map: (r: any, b: Brand) => unknown; ranged: boolean }> = {
  sales:      { method: 'fetchSales',     map: salesToDb,     ranged: true },
  crm:        { method: 'fetchCRM',       map: crmToDb,       ranged: true },
  products:   { method: 'fetchProducts',  map: productToDb,   ranged: false },
  google_ads: { method: 'fetchGoogleAds', map: googleAdsToDb, ranged: true },
  meta_ads:   { method: 'fetchMetaAds',   map: metaAdsToDb,   ranged: true },
}

export async function runWmsSync({ adapter, db, log, opts }: RunArgs): Promise<SyncResult> {
  const logId = await log.start({ trigger: opts.trigger, triggeredBy: opts.triggeredBy })
  const counts: Record<string, number> = {}
  const perBrand: SyncResult['perBrand'] = []

  for (const brand of opts.brands) {
    let brandOk = true
    let brandErr: string | undefined
    for (const table of opts.tables) {
      const plan = TABLE_PLAN[table]
      const fn = adapter[plan.method] as undefined | ((b: Brand, r?: WmsDateRange) => Promise<unknown[]>)
      if (typeof fn !== 'function') continue
      try {
        const rows = await fn.call(adapter, brand, plan.ranged ? opts.range : undefined)
        if (!rows.length) continue
        const records = rows.map(r => plan.map(r, brand))
        const { error } = await db.upsert(table, records, ON_CONFLICT)
        if (error) throw new Error(error.message)
        counts[table] = (counts[table] ?? 0) + records.length
      } catch (e) {
        brandOk = false
        brandErr = e instanceof Error ? e.message : String(e)
        break
      }
    }
    perBrand.push({ brand, ok: brandOk, error: brandErr })
  }

  const okCount = perBrand.filter(b => b.ok).length
  const status: SyncResult['status'] =
    okCount === opts.brands.length ? 'success' : okCount === 0 ? 'failed' : 'partial'
  const error = status === 'success' ? undefined : perBrand.find(b => !b.ok)?.error
  await log.finish(logId, { status, tables: counts, error })
  return { status, tables: counts, perBrand, error }
}

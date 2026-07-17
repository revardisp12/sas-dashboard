import { describe, it, expect, vi } from 'vitest'
import { logPort } from './serverPorts'
import { SyncAlreadyRunningError } from './sync'
import { FakeSupabase } from './fakeSupabase'
import type { Brand } from '@/lib/types'

// logPort() is typed against the real Supabase client; a FakeSupabase only needs to be
// structurally close enough to satisfy the handful of chained calls it actually makes.
type Client = Parameters<typeof logPort>[0]
const asClient = (fake: FakeSupabase) => fake as unknown as Client

function seedSyncLog(fake: FakeSupabase, rows: Array<{ id: string; status: string; started_at: string; brand: string | null }>) {
  fake.store['sync_log'] = rows
}

describe('logPort.hasRunningSync — the real Supabase-backed query, not a hand-written mock', () => {
  it('returns true when a recent running row exists for the requested brand', async () => {
    const fake = new FakeSupabase()
    seedSyncLog(fake, [{ id: '1', status: 'running', started_at: new Date().toISOString(), brand: 'reglow' }])
    expect(await logPort(asClient(fake)).hasRunningSync(['reglow'] as Brand[])).toBe(true)
  })

  it('returns false when the only running row is for a different brand', async () => {
    const fake = new FakeSupabase()
    seedSyncLog(fake, [{ id: '1', status: 'running', started_at: new Date().toISOString(), brand: 'amura' }])
    expect(await logPort(asClient(fake)).hasRunningSync(['reglow'] as Brand[])).toBe(false)
  })

  it('returns true for ANY requested brand when a running row has brand=null (multi-brand cron/webhook run)', async () => {
    const fake = new FakeSupabase()
    seedSyncLog(fake, [{ id: '1', status: 'running', started_at: new Date().toISOString(), brand: null }])
    expect(await logPort(asClient(fake)).hasRunningSync(['purela'] as Brand[])).toBe(true)
  })

  it('ignores a running row older than the staleness cutoff (crashed run that never called finish)', async () => {
    const fake = new FakeSupabase()
    const staleAt = new Date(Date.now() - 15 * 60 * 1000).toISOString() // 15 min ago, past the 10-min cutoff
    seedSyncLog(fake, [{ id: '1', status: 'running', started_at: staleAt, brand: 'reglow' }])
    expect(await logPort(asClient(fake)).hasRunningSync(['reglow'] as Brand[])).toBe(false)
  })

  it('ignores a row that already reached a terminal status', async () => {
    const fake = new FakeSupabase()
    seedSyncLog(fake, [{ id: '1', status: 'success', started_at: new Date().toISOString(), brand: 'reglow' }])
    expect(await logPort(asClient(fake)).hasRunningSync(['reglow'] as Brand[])).toBe(false)
  })

  it('checks a multi-brand request correctly — true only if one of the requested brands matches', async () => {
    const fake = new FakeSupabase()
    seedSyncLog(fake, [{ id: '1', status: 'running', started_at: new Date().toISOString(), brand: 'purela' }])
    const log = logPort(asClient(fake))
    expect(await log.hasRunningSync(['reglow', 'amura'] as Brand[])).toBe(false)
    expect(await log.hasRunningSync(['reglow', 'purela'] as Brand[])).toBe(true)
  })

  it('handles the cron\'s real 3-brand request shape correctly', async () => {
    const fake = new FakeSupabase()
    seedSyncLog(fake, [{ id: '1', status: 'running', started_at: new Date().toISOString(), brand: 'purela' }])
    const log = logPort(asClient(fake))
    expect(await log.hasRunningSync(['reglow', 'amura', 'purela'] as Brand[])).toBe(true)
  })

  it('fails open (returns false) when the query itself errors, and logs it rather than failing silently', async () => {
    const fake = new FakeSupabase()
    fake.failTable = 'sync_log'
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(await logPort(asClient(fake)).hasRunningSync(['reglow'] as Brand[])).toBe(false)
      // Distinguishes an explicit fail-open branch from mere absence of error handling: without
      // the console.error call, this would silently degenerate to the same `false` result.
      expect(errSpy).toHaveBeenCalled()
    } finally {
      errSpy.mockRestore()
    }
  })

  it('self-heals a stale running row (marks it failed) so the DB-level unique index can never permanently brick future syncs', async () => {
    // This is the fix for a real gap: sync_log_one_running (see wms_sync_log_concurrency_guard.sql)
    // has no time dimension, so if hasRunningSync only IGNORED old rows instead of actively
    // reaping them, a single crashed run would permanently fail every future log.start() insert.
    const fake = new FakeSupabase()
    const staleAt = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    seedSyncLog(fake, [{ id: 'stuck-1', status: 'running', started_at: staleAt, brand: 'reglow' }])

    await logPort(asClient(fake)).hasRunningSync(['reglow'] as Brand[])

    const row = fake.store['sync_log'].find(r => r.id === 'stuck-1')
    expect(row?.status).toBe('failed')
    expect(row?.finished_at).toBeTruthy()
  })

  it('does not touch a recent running row while reaping stale ones', async () => {
    const fake = new FakeSupabase()
    const staleAt = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const freshAt = new Date().toISOString()
    seedSyncLog(fake, [
      { id: 'stuck-1', status: 'running', started_at: staleAt, brand: 'amura' },
      { id: 'fresh-1', status: 'running', started_at: freshAt, brand: 'reglow' },
    ])

    expect(await logPort(asClient(fake)).hasRunningSync(['reglow'] as Brand[])).toBe(true)
    expect(fake.store['sync_log'].find(r => r.id === 'fresh-1')?.status).toBe('running')
    expect(fake.store['sync_log'].find(r => r.id === 'stuck-1')?.status).toBe('failed')
  })
})

describe('logPort.start — DB-level concurrency enforcement (sync_log_one_running)', () => {
  it('throws SyncAlreadyRunningError specifically on a 23505 unique-violation', async () => {
    const fake = new FakeSupabase()
    fake.forcedInsertError = { message: 'duplicate key value violates unique constraint "sync_log_one_running"', code: '23505' }
    let caught: unknown
    try { await logPort(asClient(fake)).start({ trigger: 'manual' }) } catch (e) { caught = e }
    expect(caught).toBeInstanceOf(SyncAlreadyRunningError)
  })

  it('throws a plain Error (not SyncAlreadyRunningError) for any other insert failure', async () => {
    const fake = new FakeSupabase()
    fake.forcedInsertError = { message: 'connection reset', code: '08006' }
    let caught: unknown
    try { await logPort(asClient(fake)).start({ trigger: 'manual' }) } catch (e) { caught = e }
    expect(caught).toBeInstanceOf(Error)
    expect(caught).not.toBeInstanceOf(SyncAlreadyRunningError)
  })

  // The two tests above alone don't pin down that the check is on error.code specifically —
  // in both fixtures "code is 23505" and "message contains 'duplicate'" happen to covary, so
  // a regression to checking error.message.includes('duplicate') would pass both unchanged.
  // These two pin the code as the ONLY signal that matters, independent of message wording.
  it('throws SyncAlreadyRunningError on code 23505 even when the message text does not mention "duplicate"', async () => {
    const fake = new FakeSupabase()
    fake.forcedInsertError = { message: 'conflicting row already present', code: '23505' }
    let caught: unknown
    try { await logPort(asClient(fake)).start({ trigger: 'manual' }) } catch (e) { caught = e }
    expect(caught).toBeInstanceOf(SyncAlreadyRunningError)
  })

  it('throws a plain Error for a non-23505 failure even when the message mentions "duplicate"', async () => {
    const fake = new FakeSupabase()
    fake.forcedInsertError = { message: 'duplicate row detected by an unrelated trigger', code: '55000' }
    let caught: unknown
    try { await logPort(asClient(fake)).start({ trigger: 'manual' }) } catch (e) { caught = e }
    expect(caught).toBeInstanceOf(Error)
    expect(caught).not.toBeInstanceOf(SyncAlreadyRunningError)
  })

  it('returns the new row id and persists the row on success', async () => {
    const fake = new FakeSupabase()
    const id = await logPort(asClient(fake)).start({ trigger: 'manual', brand: 'reglow' })
    expect(fake.store['sync_log']).toHaveLength(1)
    expect(fake.store['sync_log'][0].id).toBe(id)
    expect(fake.store['sync_log'][0].brand).toBe('reglow')
  })
})

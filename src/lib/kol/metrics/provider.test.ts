import { describe, it, expect } from 'vitest'
import { ManualProvider } from './manualProvider'
describe('ManualProvider', () => {
  it('is manual mode and returns null (keep manual entry)', async () => {
    const p = new ManualProvider()
    expect(p.mode).toBe('manual')
    expect(await p.fetch('https://x', 'TikTok')).toBeNull()
  })
})

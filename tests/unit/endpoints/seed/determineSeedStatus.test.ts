import { describe, it, expect } from 'vitest'
import { determineSeedStatus } from '@/endpoints/seed/seedEndpoint'

describe('determineSeedStatus', () => {
  it('returns ok when there are no failures', () => {
    expect(determineSeedStatus([], [])).toBe('ok')
    expect(determineSeedStatus([{ created: 1, updated: 0 }], [])).toBe('ok')
  })

  it('returns partial when there are failures and units processed', () => {
    expect(determineSeedStatus([{ created: 1, updated: 0 }], ['err'])).toBe('partial')
    expect(determineSeedStatus([{ created: 0, updated: 2 }], ['err1', 'err2'])).toBe('partial')
  })

  it('returns failed when there are failures but no units were processed', () => {
    expect(determineSeedStatus([], ['err'])).toBe('failed')
  })
})

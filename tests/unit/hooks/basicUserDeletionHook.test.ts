/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deleteSupabaseUserHook } from '@/collections/BasicUsers/hooks/deleteSupabaseUser'

// Mock supabase provision utilities used by the hook
vi.mock('../../../src/auth/utilities/supabaseProvision', () => ({
  deleteSupabaseAccount: vi.fn(async () => true),
}))

const makePayload = (overrides: Partial<any> = {}) => ({
  findByID: vi.fn(),
  find: vi.fn(),
  delete: vi.fn(),
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  ...overrides,
})

const makeReq = (payload: any) => ({ payload }) as any

describe('deleteSupabaseUserHook (beforeDelete)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does nothing when user not found', async () => {
    const payload = makePayload({ findByID: vi.fn().mockResolvedValue(null) })
    const req = makeReq(payload)

    await deleteSupabaseUserHook({ req, id: 'user-1' } as any)

    expect(payload.logger.warn).toHaveBeenCalled()
  })

  it('deletes related profile records first and then supabase user', async () => {
    const provision = await import('../../../src/auth/utilities/supabaseProvision')
    const payload = makePayload({
      findByID: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', email: 'u@e.com', userType: 'platform', supabaseUserId: 'sb-1' }),
      find: vi.fn().mockResolvedValue({ docs: [{ id: 'p1' }, { id: 'p2' }] }),
      delete: vi.fn().mockResolvedValue({}),
    })

    const req = makeReq(payload)

    await deleteSupabaseUserHook({ req, id: 'user-1' } as any)

    // profiles deleted
    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'platformStaff' }))
    expect(payload.delete).toHaveBeenCalledTimes(2)
    expect(payload.delete).toHaveBeenCalledWith(expect.objectContaining({ collection: 'platformStaff', id: 'p1' }))
    expect(payload.delete).toHaveBeenCalledWith(expect.objectContaining({ collection: 'platformStaff', id: 'p2' }))

    // external deletion attempted via provision util
    expect((provision as any).deleteSupabaseAccount).toHaveBeenCalledWith('sb-1')
  })

  it('handles supabase deletion error without throwing', async () => {
    // Override provision util to simulate failure
    const provision = await import('../../../src/auth/utilities/supabaseProvision')
    ;(provision as any).deleteSupabaseAccount.mockResolvedValueOnce(false)

    const payload = makePayload({
      findByID: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', email: 'u@e.com', userType: 'platform', supabaseUserId: 'sb-1' }),
      find: vi.fn().mockResolvedValue({ docs: [] }),
    })
    const req = makeReq(payload)

    await deleteSupabaseUserHook({ req, id: 'user-1' } as any)

    expect(payload.logger.error).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('Failed to delete Supabase user: sb-1'),
    )
  })
})

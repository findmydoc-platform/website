import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deleteSupabaseUserHook } from '../../../src/hooks/userLifecycle/basicUserDeletionHook'

// Mock Supabase admin client
vi.mock('../../../src/auth/utilities/supaBaseServer', () => ({
  createAdminClient: vi.fn(async () => ({
    auth: {
      admin: {
        deleteUser: vi.fn(async () => ({ error: null })),
      },
    },
  })),
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
  })

  it('handles supabase deletion error without throwing', async () => {
    // Override admin client mock to return an error
    const supa = await import('../../../src/auth/utilities/supaBaseServer')
    ;(supa.createAdminClient as any).mockResolvedValueOnce({
      auth: { admin: { deleteUser: vi.fn(async () => ({ error: { message: 'nope' } })) } },
    })

    const payload = makePayload({
      findByID: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', email: 'u@e.com', userType: 'platform', supabaseUserId: 'sb-1' }),
      find: vi.fn().mockResolvedValue({ docs: [] }),
    })
    const req = makeReq(payload)

    await deleteSupabaseUserHook({ req, id: 'user-1' } as any)

    expect(payload.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to delete Supabase user: sb-1'),
      expect.any(Object),
    )
  })
})

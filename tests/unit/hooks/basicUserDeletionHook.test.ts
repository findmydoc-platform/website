import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deleteSupabaseUserHook } from '@/collections/BasicUsers/hooks/deleteSupabaseUser'
import type { Payload, PayloadRequest, RequestContext, SanitizedCollectionConfig } from 'payload'

// Mock supabase provision utilities used by the hook
vi.mock('../../../src/auth/utilities/supabaseProvision', () => ({
  deleteSupabaseAccount: vi.fn(async () => true),
}))

const makePayload = (overrides: Partial<Payload> = {}) =>
  ({
    findByID: vi.fn(),
    find: vi.fn(),
    delete: vi.fn(),
    logger: {
      level: 'info',
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      fatal: vi.fn(),
      trace: vi.fn(),
    },
    ...overrides,
  }) as unknown as Payload

const makeReq = (payload: Payload) => ({ payload }) as unknown as PayloadRequest
const mockCollection = { slug: 'basicUsers' } as unknown as SanitizedCollectionConfig
const emptyContext = {} as unknown as RequestContext

describe('deleteSupabaseUserHook (beforeDelete)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does nothing when user not found', async () => {
    const payload = makePayload({ findByID: vi.fn().mockResolvedValue(null) })
    const req = makeReq(payload)

    await deleteSupabaseUserHook({ req, id: 'user-1', collection: mockCollection, context: emptyContext })

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

    await deleteSupabaseUserHook({ req, id: 'user-1', collection: mockCollection, context: emptyContext })

    // profiles deleted
    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'platformStaff' }))
    expect(payload.delete).toHaveBeenCalledTimes(2)
    expect(payload.delete).toHaveBeenCalledWith(expect.objectContaining({ collection: 'platformStaff', id: 'p1' }))
    expect(payload.delete).toHaveBeenCalledWith(expect.objectContaining({ collection: 'platformStaff', id: 'p2' }))

    // external deletion attempted via provision util
    expect(vi.mocked(provision.deleteSupabaseAccount)).toHaveBeenCalledWith('sb-1')
  })

  it('handles supabase deletion error without throwing', async () => {
    // Override provision util to simulate failure
    const provision = await import('../../../src/auth/utilities/supabaseProvision')
    vi.mocked(provision.deleteSupabaseAccount).mockResolvedValueOnce(false)

    const payload = makePayload({
      findByID: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', email: 'u@e.com', userType: 'platform', supabaseUserId: 'sb-1' }),
      find: vi.fn().mockResolvedValue({ docs: [] }),
    })
    const req = makeReq(payload)

    await deleteSupabaseUserHook({ req, id: 'user-1', collection: mockCollection, context: emptyContext })

    expect(payload.logger.error).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('Failed to delete Supabase user: sb-1'),
    )
  })
})

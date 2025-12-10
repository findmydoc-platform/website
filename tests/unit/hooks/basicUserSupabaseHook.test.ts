import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseUserHook } from '@/collections/BasicUsers/hooks/createSupabaseUser'
import { inviteSupabaseAccount } from '@/auth/utilities/supabaseProvision'
import type { PayloadRequest, RequestContext, SanitizedCollectionConfig } from 'payload'
import type { BasicUser } from '@/payload-types'

const makeReq = (context: Record<string, unknown> = {}) =>
  ({
    context,
    payload: {
      logger: {
        level: 'info',
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        fatal: vi.fn(),
        trace: vi.fn(),
      },
    },
  }) as unknown as PayloadRequest

describe('createSupabaseUserHook (beforeChange)', () => {
  const mockCollection = { slug: 'basicUsers' } as unknown as SanitizedCollectionConfig
  const emptyContext = {} as unknown as RequestContext

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips when operation is not create', async () => {
    const req = makeReq()
    const data: Partial<BasicUser> = { email: 'x@example.com', userType: 'platform' }

    const result = await createSupabaseUserHook({
      data,
      operation: 'update',
      req,
      collection: mockCollection,
      context: emptyContext,
      originalDoc: undefined,
    })
    expect(result).toBe(data)
  })

  it('skips when supabaseUserId already exists', async () => {
    const req = makeReq()
    const data: Partial<BasicUser> = { email: 'x@example.com', userType: 'platform', supabaseUserId: 'existing' }

    const result = await createSupabaseUserHook({
      data,
      operation: 'create',
      req,
      collection: mockCollection,
      context: emptyContext,
      originalDoc: undefined,
    })
    expect(result).toBe(data)
  })

  it('invites Supabase user with metadata from context when provided', async () => {
    const req = makeReq({ userMetadata: { firstName: 'Ctx', lastName: 'User' } })
    const data: Partial<BasicUser> = {
      email: 'staff@example.com',
      userType: 'clinic',
      firstName: 'Platform',
      lastName: 'Staff',
    }

    const result = await createSupabaseUserHook({
      data,
      operation: 'create',
      req,
      collection: mockCollection,
      context: emptyContext,
      originalDoc: undefined,
    })

    expect(inviteSupabaseAccount).toHaveBeenCalledWith({
      email: 'staff@example.com',
      userType: 'clinic',
      userMetadata: { firstName: 'Ctx', lastName: 'User' },
    })
    expect((result as { supabaseUserId?: string }).supabaseUserId).toBe('sb-unit-1')
  })

  it('falls back to document metadata when context is missing', async () => {
    const req = makeReq()
    const data: Partial<BasicUser> = {
      email: 'staff@example.com',
      userType: 'clinic',
      firstName: 'Platform',
      lastName: 'Staff',
    }

    const result = await createSupabaseUserHook({
      data,
      operation: 'create',
      req,
      collection: mockCollection,
      context: emptyContext,
      originalDoc: undefined,
    })

    expect(inviteSupabaseAccount).toHaveBeenCalledWith({
      email: 'staff@example.com',
      userType: 'clinic',
      userMetadata: { firstName: 'Platform', lastName: 'Staff' },
    })
    expect((result as { supabaseUserId?: string }).supabaseUserId).toBe('sb-unit-1')
  })

  it('propagates Supabase errors', async () => {
    vi.mocked(inviteSupabaseAccount).mockRejectedValueOnce(new Error('boom'))

    const req = makeReq()
    const data: Partial<BasicUser> = { email: 'err@example.com', userType: 'platform' }

    await expect(
      createSupabaseUserHook({
        data,
        operation: 'create',
        req,
        collection: mockCollection,
        context: emptyContext,
        originalDoc: undefined,
      }),
    ).rejects.toThrow('Supabase user creation failed: boom')
  })
})

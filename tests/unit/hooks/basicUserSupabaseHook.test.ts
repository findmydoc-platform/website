import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseUserHook } from '@/collections/BasicUsers/hooks/createSupabaseUser'
import { inviteSupabaseAccount } from '@/auth/utilities/supabaseProvision'

const makeReq = (context: Record<string, any> = {}) =>
  ({
    context,
    payload: {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      },
    },
  }) as any

describe('createSupabaseUserHook (beforeChange)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips when operation is not create', async () => {
    const req = makeReq()
    const data: any = { email: 'x@example.com', userType: 'platform' }

    const result = await createSupabaseUserHook({ data, operation: 'update', req } as any)
    expect(result).toBe(data)
  })

  it('skips when supabaseUserId already exists', async () => {
    const req = makeReq()
    const data: any = { email: 'x@example.com', userType: 'platform', supabaseUserId: 'existing' }

    const result = await createSupabaseUserHook({ data, operation: 'create', req } as any)
    expect(result).toBe(data)
  })

  it('invites Supabase user with metadata from context when provided', async () => {
    const req = makeReq({ userMetadata: { firstName: 'Ctx', lastName: 'User' } })
    const data: any = {
      email: 'staff@example.com',
      userType: 'clinic',
      firstName: 'Platform',
      lastName: 'Staff',
    }

    const result = await createSupabaseUserHook({ data, operation: 'create', req } as any)

    expect(inviteSupabaseAccount).toHaveBeenCalledWith({
      email: 'staff@example.com',
      userType: 'clinic',
      userMetadata: { firstName: 'Ctx', lastName: 'User' },
    })
    expect(result.supabaseUserId).toBe('sb-unit-1')
  })

  it('falls back to document metadata when context is missing', async () => {
    const req = makeReq()
    const data: any = {
      email: 'staff@example.com',
      userType: 'clinic',
      firstName: 'Platform',
      lastName: 'Staff',
    }

    const result = await createSupabaseUserHook({ data, operation: 'create', req } as any)

    expect(inviteSupabaseAccount).toHaveBeenCalledWith({
      email: 'staff@example.com',
      userType: 'clinic',
      userMetadata: { firstName: 'Platform', lastName: 'Staff' },
    })
    expect(result.supabaseUserId).toBe('sb-unit-1')
  })

  it('propagates Supabase errors', async () => {
    ;(inviteSupabaseAccount as any).mockRejectedValueOnce(new Error('boom'))

    const req = makeReq()
    const data: any = { email: 'err@example.com', userType: 'platform' }

    await expect(createSupabaseUserHook({ data, operation: 'create', req } as any)).rejects.toThrow(
      'Supabase user creation failed: boom',
    )
  })
})

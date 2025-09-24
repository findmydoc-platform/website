import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseUserHook } from '@/collections/BasicUsers/hooks/createSupabaseUser'

// Mocks
vi.mock('../../../src/auth/utilities/registration', async (orig) => {
  const actual = await (orig as any)()
  return {
    ...actual,
    createSupabaseUser: vi.fn(async () => ({ id: 'supabase-user-123' })),
    createSupabaseUserConfig: actual.createSupabaseUserConfig,
  }
})

// Local helpers
const makeReq = () =>
  ({
    context: {},
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

  it('creates supabase user with provided password (password retained by current implementation)', async () => {
    const req = makeReq()
    const data: any = { email: 'staff@example.com', userType: 'platform', password: 'Strong#12345' }

    const result = await createSupabaseUserHook({ data, operation: 'create', req } as any)

    // Global supabaseProvision mock returns 'sb-unit-1'
    expect(result.supabaseUserId).toBe('sb-unit-1')
    expect((result as any).password).toBe('Strong#12345')
  })

  it('throws if password missing', async () => {
    const req = makeReq()
    const data: any = { email: 'no-pass@example.com', userType: 'platform' }
    await expect(createSupabaseUserHook({ data, operation: 'create', req } as any)).rejects.toThrow(
      'Password is required to create a BasicUser',
    )
  })

  it('throws when Supabase creation fails', async () => {
    // Override global supabaseProvision mock for this test
    const provision = await import('@/auth/utilities/supabaseProvision')
    ;(provision.createSupabaseAccount as any).mockRejectedValueOnce(new Error('boom'))

    const req = makeReq()
    const data: any = { email: 'err@example.com', userType: 'platform', password: 'Strong#12345' }

    await expect(createSupabaseUserHook({ data, operation: 'create', req } as any)).rejects.toThrow(
      'Supabase user creation failed: boom',
    )
  })
})

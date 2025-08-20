import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseUserHook } from '../../../src/hooks/userLifecycle/basicUserSupabaseHook'

// Mocks
vi.mock('../../../src/auth/utilities/registration', async (orig) => {
  const actual = await (orig as any)()
  return {
    ...actual,
    createSupabaseUser: vi.fn(async () => ({ id: 'supabase-user-123' })),
    createSupabaseUserConfig: actual.createSupabaseUserConfig,
  }
})

vi.mock('../../../src/auth/utilities/passwordGeneration', () => ({
  generateSecurePassword: () => 'Temp#Password123',
}))

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

  it('skips when context.skipSupabaseCreation is set', async () => {
    const req = makeReq()
    req.context.skipSupabaseCreation = true
    const data: any = { email: 'x@example.com', userType: 'platform' }

    const result = await createSupabaseUserHook({ data, operation: 'create', req } as any)
    expect(result).toBe(data)
  })

  it('creates supabase user, sets supabaseUserId and temporaryPassword (auto generated)', async () => {
    const req = makeReq()
    const data: any = { email: 'staff@example.com', userType: 'platform' }

    const result = await createSupabaseUserHook({ data, operation: 'create', req } as any)

    expect(result.supabaseUserId).toBe('supabase-user-123')
    // since no custom password was given, temporaryPassword should be stored
    expect(result.temporaryPassword).toBe('Temp#Password123')
    // also present in req.context for afterChange consumers
    expect(req.context.temporaryPassword).toBe('Temp#Password123')
  })

  it('uses custom password from context and does not persist temporaryPassword', async () => {
    const req = makeReq()
    req.context.userProvidedPassword = 'Custom!Passw0rd'
    const data: any = { email: 'firstadmin@example.com', userType: 'platform' }

    const result = await createSupabaseUserHook({ data, operation: 'create', req } as any)

    expect(result.supabaseUserId).toBe('supabase-user-123')
    // should not store temp password when custom is provided
    expect(result.temporaryPassword).toBeUndefined()
    expect(req.context.temporaryPassword).toBeUndefined()
  })

  it('throws when Supabase creation fails', async () => {
    // Reconfigure mock to throw for this test
    const registration = await import('../../../src/auth/utilities/registration')
    ;(registration.createSupabaseUser as any).mockRejectedValueOnce(new Error('boom'))

    const req = makeReq()
    const data: any = { email: 'err@example.com', userType: 'platform' }

    await expect(createSupabaseUserHook({ data, operation: 'create', req } as any)).rejects.toThrow(
      'Supabase user creation failed: boom',
    )
  })
})

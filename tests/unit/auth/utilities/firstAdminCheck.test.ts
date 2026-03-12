import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { hasAdminUsers, hasLocalAdminUsers } from '@/auth/utilities/firstAdminCheck'
import { createAdminClient } from '@/auth/utilities/supaBaseServer'
import { getServerLogger } from '@/utilities/logging/serverLogger'
import type { Payload } from 'payload'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('@/auth/utilities/supaBaseServer', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/utilities/logging/serverLogger', () => ({
  getServerLogger: vi.fn(),
}))

const mockedCreateAdminClient = vi.mocked(createAdminClient)
const mockedGetServerLogger = vi.mocked(getServerLogger)
const logger = {
  debug: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  info: vi.fn(),
  level: 'info',
  trace: vi.fn(),
  warn: vi.fn(),
}

const buildSupabaseMock = ({
  getUserByIdImpl,
  listUsersImpl,
}: {
  getUserByIdImpl?: (userId: string) => Promise<unknown>
  listUsersImpl?: () => Promise<unknown>
} = {}) =>
  ({
    auth: {
      admin: {
        getUserById: vi.fn(
          getUserByIdImpl ??
            (() =>
              Promise.resolve({
                data: { user: null },
                error: null,
              })),
        ),
        listUsers: vi.fn(
          listUsersImpl ??
            (() =>
              Promise.resolve({
                data: { users: [] },
                error: null,
              })),
        ),
      },
    },
  }) as unknown as SupabaseClient

const buildPayloadMock = (docs: Array<{ email?: string; id: number | string; supabaseUserId?: string | null }>) =>
  ({
    find: vi.fn().mockResolvedValue({
      docs,
    }),
  }) as unknown as Pick<Payload, 'find'>

describe('hasAdminUsers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockedCreateAdminClient.mockReset()
    mockedGetServerLogger.mockResolvedValue(logger)
    vi.stubEnv('AUTH_ADMIN_RECOVERY_ENABLED', 'false')
    vi.stubEnv('DEPLOYMENT_ENV', 'preview')
    vi.stubEnv('VERCEL_ENV', '')
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('returns true when at least one Supabase platform user exists and no payload is provided', async () => {
    mockedCreateAdminClient.mockResolvedValue(
      buildSupabaseMock({
        listUsersImpl: () =>
          Promise.resolve({
            data: { users: [{ app_metadata: { user_type: 'platform' } }] },
            error: null,
          }),
      }),
    )

    const result = await hasAdminUsers()

    expect(result).toBe(true)
    expect(mockedCreateAdminClient).toHaveBeenCalledOnce()
  })

  it('returns true in non-recovery mode when a Payload platform user exists', async () => {
    const payload = buildPayloadMock([{ id: 1, supabaseUserId: null }])

    const result = await hasAdminUsers(payload)

    expect(result).toBe(true)
    expect(payload.find).toHaveBeenCalledOnce()
    expect(mockedCreateAdminClient).not.toHaveBeenCalled()
  })

  it('returns false in recovery mode when Payload admin exists but Supabase user is missing', async () => {
    vi.stubEnv('AUTH_ADMIN_RECOVERY_ENABLED', 'true')
    vi.stubEnv('DEPLOYMENT_ENV', 'preview')
    const payload = buildPayloadMock([{ id: 1, supabaseUserId: 'sb-platform-missing' }])

    mockedCreateAdminClient.mockResolvedValue(
      buildSupabaseMock({
        getUserByIdImpl: () =>
          Promise.resolve({
            data: { user: null },
            error: { message: 'User not found', status: 404 },
          }),
      }),
    )

    const result = await hasAdminUsers(payload)

    expect(result).toBe(false)
    expect(payload.find).toHaveBeenCalledOnce()
    expect(mockedCreateAdminClient).toHaveBeenCalledOnce()
  })

  it('returns true in recovery mode when Payload and Supabase platform user both exist', async () => {
    vi.stubEnv('AUTH_ADMIN_RECOVERY_ENABLED', 'true')
    vi.stubEnv('DEPLOYMENT_ENV', 'development')
    const payload = buildPayloadMock([{ id: 1, supabaseUserId: 'sb-platform-1' }])

    mockedCreateAdminClient.mockResolvedValue(
      buildSupabaseMock({
        getUserByIdImpl: () =>
          Promise.resolve({
            data: {
              user: {
                app_metadata: { user_type: 'platform' },
                id: 'sb-platform-1',
              },
            },
            error: null,
          }),
      }),
    )

    await expect(hasAdminUsers(payload)).resolves.toBe(true)
  })

  it('returns true in production even when recovery flag is enabled and Supabase user is missing', async () => {
    vi.stubEnv('AUTH_ADMIN_RECOVERY_ENABLED', 'true')
    vi.stubEnv('DEPLOYMENT_ENV', 'production')
    const payload = buildPayloadMock([{ id: 1, supabaseUserId: 'sb-platform-missing' }])

    await expect(hasAdminUsers(payload)).resolves.toBe(true)
    expect(mockedCreateAdminClient).not.toHaveBeenCalled()
  })

  it('returns false when no platform users are present in payload', async () => {
    const payload = buildPayloadMock([])

    await expect(hasAdminUsers(payload)).resolves.toBe(false)
  })

  it('returns false and logs when Supabase listUsers returns an error without payload fallback', async () => {
    mockedCreateAdminClient.mockResolvedValue(
      buildSupabaseMock({
        listUsersImpl: () =>
          Promise.resolve({
            data: { users: [] },
            error: { message: 'failure' },
          }),
      }),
    )

    await expect(hasAdminUsers()).resolves.toBe(false)
    expect(logger.error).toHaveBeenCalled()
  })

  it('returns false when creating the admin client fails without payload fallback', async () => {
    mockedCreateAdminClient.mockRejectedValue(new Error('init failed'))

    await expect(hasAdminUsers()).resolves.toBe(false)
    expect(logger.error).toHaveBeenCalled()
  })

  it('returns true in recovery mode when Supabase validation fails unexpectedly (fail-closed)', async () => {
    vi.stubEnv('AUTH_ADMIN_RECOVERY_ENABLED', 'true')
    vi.stubEnv('DEPLOYMENT_ENV', 'preview')
    const payload = buildPayloadMock([{ id: 1, supabaseUserId: 'sb-platform-1' }])

    mockedCreateAdminClient.mockResolvedValue(
      buildSupabaseMock({
        getUserByIdImpl: () =>
          Promise.resolve({
            data: { user: null },
            error: { message: 'network failure', status: 500 },
          }),
      }),
    )

    await expect(hasAdminUsers(payload)).resolves.toBe(true)
    expect(logger.error).toHaveBeenCalled()
  })
})

describe('hasLocalAdminUsers', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when at least one local payload platform admin exists', async () => {
    const payload = buildPayloadMock([{ id: 1, supabaseUserId: null }])

    await expect(hasLocalAdminUsers(payload)).resolves.toBe(true)
  })

  it('returns false when local payload platform admin lookup fails', async () => {
    const payload = {
      find: vi.fn().mockRejectedValue(new Error('payload find failed')),
    } as unknown as Pick<Payload, 'find'>

    await expect(hasLocalAdminUsers(payload)).resolves.toBe(false)
    expect(logger.error).toHaveBeenCalled()
  })
})

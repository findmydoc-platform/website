import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { hasAdminUsers } from '@/auth/utilities/firstAdminCheck'
import { createAdminClient } from '@/auth/utilities/supaBaseServer'
import { getServerLogger } from '@/utilities/logging/serverLogger'
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

const buildSupabaseMock = (listUsersImpl: () => Promise<unknown>) =>
  ({
    auth: {
      admin: {
        listUsers: vi.fn(listUsersImpl),
      },
    },
  }) as unknown as SupabaseClient

describe('hasAdminUsers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockedCreateAdminClient.mockReset()
    mockedGetServerLogger.mockResolvedValue(logger)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('returns true when at least one platform user exists', async () => {
    mockedCreateAdminClient.mockResolvedValue(
      buildSupabaseMock(() =>
        Promise.resolve({
          data: { users: [{ app_metadata: { user_type: 'platform' } }] },
          error: null,
        }),
      ),
    )

    const result = await hasAdminUsers()

    expect(result).toBe(true)
    expect(mockedCreateAdminClient).toHaveBeenCalledOnce()
  })

  it('returns false when no platform users are present', async () => {
    mockedCreateAdminClient.mockResolvedValue(
      buildSupabaseMock(() =>
        Promise.resolve({
          data: { users: [{ app_metadata: { user_type: 'clinic' } }] },
          error: null,
        }),
      ),
    )

    await expect(hasAdminUsers()).resolves.toBe(false)
  })

  it('returns false and logs when Supabase returns an error', async () => {
    mockedCreateAdminClient.mockResolvedValue(
      buildSupabaseMock(() =>
        Promise.resolve({
          data: { users: [] },
          error: { message: 'failure' },
        }),
      ),
    )

    await expect(hasAdminUsers()).resolves.toBe(false)
    expect(logger.error).toHaveBeenCalled()
  })

  it('returns false when creating the admin client fails', async () => {
    mockedCreateAdminClient.mockRejectedValue(new Error('init failed'))

    await expect(hasAdminUsers()).resolves.toBe(false)
    expect(logger.error).toHaveBeenCalled()
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { hasAdminUsers } from '@/auth/utilities/firstAdminCheck'
import { createAdminClient } from '@/auth/utilities/supaBaseServer'

vi.mock('@/auth/utilities/supaBaseServer', () => ({
  createAdminClient: vi.fn(),
}))

const mockedCreateAdminClient = vi.mocked(createAdminClient)

const buildSupabaseMock = (listUsersImpl: () => any) =>
  ({
    auth: {
      admin: {
        listUsers: vi.fn(listUsersImpl),
      },
    },
  }) as any

describe('hasAdminUsers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockedCreateAdminClient.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
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
    expect(console.error).toHaveBeenCalled()
  })

  it('returns false when creating the admin client fails', async () => {
    mockedCreateAdminClient.mockRejectedValue(new Error('init failed'))

    await expect(hasAdminUsers()).resolves.toBe(false)
    expect(console.error).toHaveBeenCalled()
  })
})

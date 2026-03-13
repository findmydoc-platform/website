import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { hasLocalAdminUsers } from '@/auth/utilities/firstAdminCheck'
import type { Payload } from 'payload'

const { logger, getSupabaseLoggerMock, getLoggedSupabaseAdminClientMock, getUserByIdMock } = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    info: vi.fn(),
    level: 'info',
    trace: vi.fn(),
    warn: vi.fn(),
  },
  getSupabaseLoggerMock: vi.fn(),
  getLoggedSupabaseAdminClientMock: vi.fn(),
  getUserByIdMock: vi.fn(),
}))

vi.mock('@/auth/utilities/supabaseLogger', () => ({
  getSupabaseLogger: getSupabaseLoggerMock,
  getLoggedSupabaseAdminClient: getLoggedSupabaseAdminClientMock,
}))

const buildPayloadMock = (docs: Array<{ id: number | string; supabaseUserId?: string | null }>) =>
  ({
    find: vi.fn().mockResolvedValue({
      docs,
    }),
  }) as unknown as Pick<Payload, 'find'>

describe('hasLocalAdminUsers', () => {
  const originalEnv = process.env

  beforeEach(() => {
    getSupabaseLoggerMock.mockResolvedValue(logger)
    getLoggedSupabaseAdminClientMock.mockResolvedValue({
      activeLogger: logger,
      supabase: {
        auth: {
          admin: {
            getUserById: getUserByIdMock,
          },
        },
      },
    })
    process.env = {
      ...originalEnv,
      DEPLOYMENT_ENV: undefined,
      VERCEL_ENV: undefined,
      NODE_ENV: 'test',
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
    process.env = originalEnv
  })

  it('returns true when local payload platform admin exists outside preview runtime', async () => {
    const payload = buildPayloadMock([{ id: 1 }])

    await expect(hasLocalAdminUsers(payload)).resolves.toBe(true)
    expect(getLoggedSupabaseAdminClientMock).not.toHaveBeenCalled()
  })

  it('returns false in preview runtime when local admins have no supabase user id', async () => {
    process.env = {
      ...process.env,
      DEPLOYMENT_ENV: 'preview',
    }
    const payload = buildPayloadMock([{ id: 1, supabaseUserId: null }])

    await expect(hasLocalAdminUsers(payload)).resolves.toBe(false)
    expect(getLoggedSupabaseAdminClientMock).not.toHaveBeenCalled()
  })

  it('returns false in preview runtime when linked supabase users are missing', async () => {
    process.env = {
      ...process.env,
      DEPLOYMENT_ENV: 'preview',
    }
    getUserByIdMock.mockResolvedValue({
      error: { code: 'user_not_found' },
    })

    const payload = buildPayloadMock([{ id: 1, supabaseUserId: 'missing-user' }])

    await expect(hasLocalAdminUsers(payload)).resolves.toBe(false)
  })

  it('returns true in preview runtime when linked supabase platform user exists', async () => {
    process.env = {
      ...process.env,
      DEPLOYMENT_ENV: 'preview',
    }
    getUserByIdMock.mockResolvedValue({
      data: {
        user: {
          app_metadata: { user_type: 'platform' },
        },
      },
    })

    const payload = buildPayloadMock([{ id: 1, supabaseUserId: 'platform-user' }])

    await expect(hasLocalAdminUsers(payload)).resolves.toBe(true)
  })

  it('returns false when no local payload platform admin exists', async () => {
    const payload = buildPayloadMock([])

    await expect(hasLocalAdminUsers(payload)).resolves.toBe(false)
  })

  it('returns false when local payload platform admin lookup fails', async () => {
    const payload = {
      find: vi.fn().mockRejectedValue(new Error('payload find failed')),
    } as unknown as Pick<Payload, 'find'>

    await expect(hasLocalAdminUsers(payload)).resolves.toBe(false)
    expect(logger.error).toHaveBeenCalled()
  })
})

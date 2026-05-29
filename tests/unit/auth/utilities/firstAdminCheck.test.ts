import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { getLocalPlatformStaffUserState } from '@/auth/utilities/firstAdminCheck'
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

const buildPayloadMock = ({
  basicUsers = [],
  platformStaff = [],
}: {
  basicUsers?: Array<{ id: number | string; supabaseUserId?: string | null; userType?: string }>
  platformStaff?: Array<{ user?: number | string | { id?: number | string | null } | null; role?: string }>
}) =>
  ({
    find: vi.fn().mockImplementation(({ collection }) => {
      if (collection === 'platformStaff') {
        return Promise.resolve({ docs: platformStaff })
      }

      if (collection === 'basicUsers') {
        return Promise.resolve({ docs: basicUsers })
      }

      return Promise.resolve({ docs: [] })
    }),
  }) as unknown as Pick<Payload, 'find'>

describe('getLocalPlatformStaffUserState', () => {
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

  it('returns platform staff state when local payload platform staff admin exists outside preview runtime', async () => {
    const payload = buildPayloadMock({
      platformStaff: [{ user: 1, role: 'admin' }],
      basicUsers: [{ id: 1, supabaseUserId: 'platform-admin', userType: 'platform' }],
    })

    await expect(getLocalPlatformStaffUserState(payload)).resolves.toEqual({
      hasPlatformAdmin: true,
      status: 'has_platform_staff',
    })
    expect(getLoggedSupabaseAdminClientMock).not.toHaveBeenCalled()
  })

  it('returns platform staff state without admin role when only non-admin platform staff users exist', async () => {
    const payload = buildPayloadMock({
      platformStaff: [{ user: 1, role: 'support' }],
      basicUsers: [{ id: 1, supabaseUserId: 'platform-support', userType: 'platform' }],
    })

    await expect(getLocalPlatformStaffUserState(payload)).resolves.toEqual({
      hasPlatformAdmin: false,
      status: 'has_platform_staff',
    })
  })

  it('returns false when an admin profile is not linked to a platform basic user', async () => {
    const payload = buildPayloadMock({
      platformStaff: [{ user: 1, role: 'admin' }],
      basicUsers: [],
    })

    await expect(getLocalPlatformStaffUserState(payload)).resolves.toEqual({ status: 'no_platform_staff' })
  })

  it('returns no login-capable state in preview runtime when local staff has no supabase user id', async () => {
    process.env = {
      ...process.env,
      DEPLOYMENT_ENV: 'preview',
    }
    const payload = buildPayloadMock({
      platformStaff: [{ user: 1, role: 'admin' }],
      basicUsers: [{ id: 1, supabaseUserId: null, userType: 'platform' }],
    })

    await expect(getLocalPlatformStaffUserState(payload)).resolves.toEqual({
      hasPlatformAdmin: true,
      status: 'no_login_capable_platform_staff',
    })
    expect(getLoggedSupabaseAdminClientMock).not.toHaveBeenCalled()
  })

  it('returns no login-capable state in preview runtime when linked supabase users are missing', async () => {
    process.env = {
      ...process.env,
      DEPLOYMENT_ENV: 'preview',
    }
    getUserByIdMock.mockResolvedValue({
      error: { code: 'user_not_found' },
    })

    const payload = buildPayloadMock({
      platformStaff: [{ user: 1, role: 'admin' }],
      basicUsers: [{ id: 1, supabaseUserId: 'missing-user', userType: 'platform' }],
    })

    await expect(getLocalPlatformStaffUserState(payload, { validateSupabaseUsers: true })).resolves.toEqual({
      hasPlatformAdmin: true,
      status: 'no_login_capable_platform_staff',
    })
  })

  it('does not validate linked supabase users by default in preview runtime', async () => {
    process.env = {
      ...process.env,
      DEPLOYMENT_ENV: 'preview',
    }

    const payload = buildPayloadMock({
      platformStaff: [
        { user: 1, role: 'admin' },
        { user: 2, role: 'support' },
      ],
      basicUsers: [
        { id: 1, supabaseUserId: 'platform-user-1', userType: 'platform' },
        { id: 2, supabaseUserId: 'platform-user-2', userType: 'platform' },
      ],
    })

    await expect(getLocalPlatformStaffUserState(payload)).resolves.toEqual({
      hasPlatformAdmin: true,
      status: 'has_platform_staff',
    })
    expect(getLoggedSupabaseAdminClientMock).not.toHaveBeenCalled()
    expect(getUserByIdMock).not.toHaveBeenCalled()
  })

  it('returns platform staff state in preview runtime when explicit validation finds linked supabase platform user', async () => {
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

    const payload = buildPayloadMock({
      platformStaff: [{ user: 1, role: 'admin' }],
      basicUsers: [{ id: 1, supabaseUserId: 'platform-user', userType: 'platform' }],
    })

    await expect(getLocalPlatformStaffUserState(payload, { validateSupabaseUsers: true })).resolves.toEqual({
      hasPlatformAdmin: true,
      status: 'has_platform_staff',
    })
  })

  it('returns false when no local payload platform staff exists', async () => {
    const payload = buildPayloadMock({})

    await expect(getLocalPlatformStaffUserState(payload)).resolves.toEqual({ status: 'no_platform_staff' })
  })

  it('returns check_failed when local payload platform staff lookup fails', async () => {
    const payload = {
      find: vi.fn().mockRejectedValue(new Error('payload find failed')),
    } as unknown as Pick<Payload, 'find'>

    await expect(getLocalPlatformStaffUserState(payload)).resolves.toEqual({
      reason: 'payload_check_failed',
      status: 'check_failed',
    })
    expect(logger.error).toHaveBeenCalled()
  })

  it('returns check_failed when preview supabase validation fails unexpectedly', async () => {
    process.env = {
      ...process.env,
      DEPLOYMENT_ENV: 'preview',
    }
    getUserByIdMock.mockResolvedValue({
      error: { code: 'internal_error' },
    })

    const payload = buildPayloadMock({
      platformStaff: [{ user: 1, role: 'admin' }],
      basicUsers: [{ id: 1, supabaseUserId: 'platform-user', userType: 'platform' }],
    })

    await expect(getLocalPlatformStaffUserState(payload, { validateSupabaseUsers: true })).resolves.toEqual({
      reason: 'supabase_user_validation_failed',
      status: 'check_failed',
    })
    expect(logger.error).toHaveBeenCalled()
  })
})

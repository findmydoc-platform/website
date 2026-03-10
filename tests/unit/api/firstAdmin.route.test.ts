import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { POST } from '@/app/api/auth/register/first-admin/route'

const findMock = vi.fn()
const createMock = vi.fn()
const updateMock = vi.fn()

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()

  return {
    ...actual,
    buildConfig: (cfg: unknown) => cfg,
    getPayload: async () => ({
      find: findMock,
      create: createMock,
      update: updateMock,
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    }),
  }
})

const supabaseProvisionMock = vi.hoisted(() => ({
  createSupabaseAccountWithPassword: vi.fn(async () => 'supabase-user-id'),
  deleteSupabaseAccount: vi.fn(async () => true),
  inviteSupabaseAccount: vi.fn(),
}))
const firstAdminCheckMock = vi.hoisted(() => ({
  hasAdminUsers: vi.fn(),
}))

vi.mock('@/auth/utilities/firstAdminCheck', () => {
  return firstAdminCheckMock
})

vi.mock('@/auth/utilities/supabaseProvision', () => supabaseProvisionMock)

const createSupabaseAccountWithPassword = supabaseProvisionMock.createSupabaseAccountWithPassword
const deleteSupabaseAccount = supabaseProvisionMock.deleteSupabaseAccount
const hasAdminUsers = firstAdminCheckMock.hasAdminUsers

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/auth/register/first-admin', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/auth/register/first-admin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findMock.mockResolvedValue({ docs: [] })
    createMock.mockResolvedValue({ id: 'basic-user-id' })
    updateMock.mockResolvedValue({ id: 'basic-user-id' })
    hasAdminUsers.mockResolvedValue(false)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('creates the first admin user with direct password provisioning', async () => {
    const res = await POST(
      makeRequest({
        email: 'admin@example.com',
        password: 'Strong#12345',
        firstName: 'Admin',
        lastName: 'User',
      }),
    )

    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.userId).toBe('basic-user-id')

    expect(hasAdminUsers).toHaveBeenCalledWith(expect.any(Object))
    expect(findMock).toHaveBeenCalledTimes(1)
    expect(createSupabaseAccountWithPassword).toHaveBeenCalledWith(
      {
        email: 'admin@example.com',
        password: 'Strong#12345',
        userType: 'platform',
        userMetadata: { firstName: 'Admin', lastName: 'User' },
      },
      expect.any(Object),
    )

    expect(createMock).toHaveBeenCalledWith({
      collection: 'basicUsers',
      data: {
        email: 'admin@example.com',
        userType: 'platform',
        firstName: 'Admin',
        lastName: 'User',
        supabaseUserId: 'supabase-user-id',
      },
      overrideAccess: true,
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  test('blocks first-admin creation when a login-capable admin already exists', async () => {
    hasAdminUsers.mockResolvedValueOnce(true)

    const res = await POST(
      makeRequest({
        email: 'admin@example.com',
        password: 'Strong#12345',
        firstName: 'Admin',
        lastName: 'User',
      }),
    )

    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('At least one Admin user already exists')
    expect(createSupabaseAccountWithPassword).not.toHaveBeenCalled()
    expect(createMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  test('recovers an existing platform user with the same email when recovery mode is enabled', async () => {
    vi.stubEnv('AUTH_ADMIN_RECOVERY_ENABLED', 'true')
    vi.stubEnv('DEPLOYMENT_ENV', 'development')

    findMock.mockResolvedValueOnce({
      docs: [{ id: 'existing-basic-user-id', userType: 'platform', supabaseUserId: 'stale-supabase-id' }],
    })

    const res = await POST(
      makeRequest({
        email: 'admin@example.com',
        password: 'Strong#12345',
        firstName: 'Admin',
        lastName: 'User',
      }),
    )

    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.userId).toBe('basic-user-id')
    expect(json.message).toBe('First admin user recovered successfully')

    expect(createSupabaseAccountWithPassword).toHaveBeenCalledWith(
      {
        email: 'admin@example.com',
        password: 'Strong#12345',
        userType: 'platform',
        userMetadata: { firstName: 'Admin', lastName: 'User' },
      },
      expect.any(Object),
    )
    expect(updateMock).toHaveBeenCalledWith({
      collection: 'basicUsers',
      id: 'existing-basic-user-id',
      data: {
        email: 'admin@example.com',
        userType: 'platform',
        firstName: 'Admin',
        lastName: 'User',
        supabaseUserId: 'supabase-user-id',
      },
      overrideAccess: true,
    })
    expect(createMock).not.toHaveBeenCalled()
  })

  test('keeps email conflict for non-platform users even in recovery mode', async () => {
    vi.stubEnv('AUTH_ADMIN_RECOVERY_ENABLED', 'true')
    vi.stubEnv('DEPLOYMENT_ENV', 'development')

    findMock.mockResolvedValueOnce({
      docs: [{ id: 'existing-clinic-user-id', userType: 'clinic', supabaseUserId: null }],
    })

    const res = await POST(
      makeRequest({
        email: 'admin@example.com',
        password: 'Strong#12345',
        firstName: 'Admin',
        lastName: 'User',
      }),
    )

    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error).toBe('User with this email already exists')
    expect(createSupabaseAccountWithPassword).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
    expect(createMock).not.toHaveBeenCalled()
  })

  test('keeps email conflict in production even when recovery flag is enabled', async () => {
    vi.stubEnv('AUTH_ADMIN_RECOVERY_ENABLED', 'true')
    vi.stubEnv('DEPLOYMENT_ENV', 'production')

    findMock.mockResolvedValueOnce({
      docs: [{ id: 'existing-platform-user-id', userType: 'platform', supabaseUserId: 'stale-supabase-id' }],
    })

    const res = await POST(
      makeRequest({
        email: 'admin@example.com',
        password: 'Strong#12345',
        firstName: 'Admin',
        lastName: 'User',
      }),
    )

    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error).toBe('User with this email already exists')
    expect(createSupabaseAccountWithPassword).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
    expect(createMock).not.toHaveBeenCalled()
  })

  test('cleans up created Supabase user when recovery update fails', async () => {
    vi.stubEnv('AUTH_ADMIN_RECOVERY_ENABLED', 'true')
    vi.stubEnv('DEPLOYMENT_ENV', 'development')

    findMock.mockResolvedValueOnce({
      docs: [{ id: 'existing-basic-user-id', userType: 'platform', supabaseUserId: 'stale-supabase-id' }],
    })
    updateMock.mockRejectedValueOnce(new Error('update failed'))

    const res = await POST(
      makeRequest({
        email: 'admin@example.com',
        password: 'Strong#12345',
        firstName: 'Admin',
        lastName: 'User',
      }),
    )

    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Failed to create admin user')
    expect(createSupabaseAccountWithPassword).toHaveBeenCalledOnce()
    expect(deleteSupabaseAccount).toHaveBeenCalledWith('supabase-user-id')
    expect(createMock).not.toHaveBeenCalled()
  })
})

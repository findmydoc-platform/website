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
  hasLocalAdminUsers: vi.fn(),
}))

vi.mock('@/auth/utilities/firstAdminCheck', () => {
  return firstAdminCheckMock
})

vi.mock('@/auth/utilities/supabaseProvision', () => supabaseProvisionMock)

const createSupabaseAccountWithPassword = supabaseProvisionMock.createSupabaseAccountWithPassword
const deleteSupabaseAccount = supabaseProvisionMock.deleteSupabaseAccount
const hasLocalAdminUsers = firstAdminCheckMock.hasLocalAdminUsers

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
    hasLocalAdminUsers.mockResolvedValue(false)
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

    expect(hasLocalAdminUsers).toHaveBeenCalledWith(expect.any(Object))
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

  test('blocks first-admin creation when a local admin already exists', async () => {
    hasLocalAdminUsers.mockResolvedValueOnce(true)

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

  test('keeps email conflict when the email already exists in payload', async () => {
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

  test('cleans up created Supabase user when payload user creation fails', async () => {
    createMock.mockRejectedValueOnce(new Error('create failed'))

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
    expect(createMock).toHaveBeenCalledOnce()
  })
})

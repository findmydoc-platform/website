import { describe, test, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/auth/register/first-admin/route'

const findMock = vi.fn()
const createMock = vi.fn()

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<any>()

  return {
    ...actual,
    buildConfig: (cfg: any) => cfg,
    getPayload: async () => ({
      find: findMock,
      create: createMock,
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    }),
  }
})

const supabaseProvisionMock = vi.hoisted(() => ({
  createSupabaseAccountWithPassword: vi.fn(async () => 'supabase-user-id'),
  inviteSupabaseAccount: vi.fn(),
}))
const registrationMock = vi.hoisted(() => ({
  validateFirstAdminCreation: vi.fn(),
}))

vi.mock('@/auth/utilities/registration', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    validateFirstAdminCreation: registrationMock.validateFirstAdminCreation,
  }
})

vi.mock('@/auth/utilities/supabaseProvision', () => supabaseProvisionMock)

const createSupabaseAccountWithPassword = supabaseProvisionMock.createSupabaseAccountWithPassword
const validateFirstAdminCreation = registrationMock.validateFirstAdminCreation

function makeRequest(body: any) {
  return new Request('http://localhost/api/auth/register/first-admin', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as any
}

describe('POST /api/auth/register/first-admin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findMock.mockResolvedValue({ docs: [] })
    createMock.mockResolvedValue({ id: 'basic-user-id' })
    validateFirstAdminCreation.mockResolvedValue(null)
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

    expect(validateFirstAdminCreation).toHaveBeenCalled()
    expect(findMock).toHaveBeenCalledTimes(2)
    expect(createSupabaseAccountWithPassword).toHaveBeenCalledWith({
      email: 'admin@example.com',
      password: 'Strong#12345',
      userType: 'platform',
      userMetadata: { firstName: 'Admin', lastName: 'User' },
    })

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
  })
})

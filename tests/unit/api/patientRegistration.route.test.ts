import { describe, test, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/auth/register/patient/route'

const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() }

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    buildConfig: (cfg: unknown) => cfg,
    getPayload: async () => ({ logger }),
  }
})

const signupClient = vi.hoisted(() => ({
  auth: {
    signUp: vi.fn(),
  },
}))

const adminClient = vi.hoisted(() => ({
  auth: {
    admin: {
      updateUserById: vi.fn(),
      deleteUser: vi.fn(),
    },
  },
}))

const createClientMock = vi.hoisted(() => vi.fn(async () => signupClient))
const createAdminClientMock = vi.hoisted(() => vi.fn(async () => adminClient))

vi.mock('@/auth/utilities/supaBaseServer', () => ({
  createAdminClient: createAdminClientMock,
  createClient: createClientMock,
}))

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/auth/register/patient', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const validBody = {
  email: 'PATIENT@example.com',
  firstName: 'John',
  lastName: 'Doe',
  password: 'PatientPass123', // pragma: allowlist secret
}

describe('POST /api/auth/register/patient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signupClient.auth.signUp.mockResolvedValue({
      data: {
        user: {
          id: 'supabase-user-id',
          app_metadata: { provider: 'email' },
          email: 'patient@example.com',
          identities: [{ provider: 'email' }],
        },
      },
      error: null,
    })
    adminClient.auth.admin.updateUserById.mockResolvedValue({ data: {}, error: null })
  })

  test('creates a patient signup and sets app metadata server-side', async () => {
    const response = await POST(makeRequest(validBody))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(signupClient.auth.signUp).toHaveBeenCalledWith({
      email: 'patient@example.com',
      password: 'PatientPass123', // pragma: allowlist secret
      options: {
        data: {
          first_name: 'John',
          last_name: 'Doe',
        },
      },
    })
    expect(adminClient.auth.admin.updateUserById).toHaveBeenCalledWith('supabase-user-id', {
      app_metadata: {
        provider: 'email',
        user_type: 'patient',
      },
    })
  })

  test('rejects invalid payloads before calling Supabase', async () => {
    const response = await POST(makeRequest({ email: 'patient@example.com' }))

    expect(response.status).toBe(400)
    expect(signupClient.auth.signUp).not.toHaveBeenCalled()
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  test('returns a generic signup error without admin mutation', async () => {
    signupClient.auth.signUp.mockResolvedValueOnce({
      data: { user: null },
      error: new Error('User already registered'),
    })

    const response = await POST(makeRequest(validBody))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Registration failed' })
    expect(createAdminClientMock).not.toHaveBeenCalled()
    expect(adminClient.auth.admin.updateUserById).not.toHaveBeenCalled()
  })

  test('logs metadata failures without deleting the Supabase user', async () => {
    adminClient.auth.admin.updateUserById.mockResolvedValueOnce({
      data: null,
      error: new Error('metadata failed'),
    })

    const response = await POST(makeRequest(validBody))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'We could not finish setting up your account. Please try again in a few minutes.',
    })
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        emailHash: expect.any(String),
        event: 'auth.supabase.patient_registration.metadata_update_failed',
        supabaseUserId: 'supabase-user-id',
      }),
      'Patient Supabase metadata update failed',
    )
  })

  test('does not repair obfuscated existing-user signup responses by email', async () => {
    signupClient.auth.signUp.mockResolvedValueOnce({
      data: {
        user: {
          id: 'fake-user-id',
          app_metadata: {},
          email: 'patient@example.com',
          identities: [],
        },
      },
      error: null,
    })

    const response = await POST(makeRequest(validBody))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(createAdminClientMock).not.toHaveBeenCalled()
    expect(adminClient.auth.admin.updateUserById).not.toHaveBeenCalled()
  })
})

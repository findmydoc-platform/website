import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/auth/register/patient/route'

const createMock = vi.fn()
const updateUserByIdMock = vi.fn()

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    buildConfig: (cfg: any) => cfg,
    getPayload: async () => ({
      create: createMock,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }),
  }
})

vi.mock('@/auth/utilities/supaBaseServer', () => ({
  createAdminClient: vi.fn(async () => ({
    auth: {
      admin: {
        updateUserById: updateUserByIdMock,
      },
    },
  })),
}))

function makeRequest(body: any) {
  return new Request('http://localhost/api/auth/register/patient', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as any
}

describe('POST /api/auth/register/patient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateUserByIdMock.mockResolvedValue({ data: {}, error: null })
    createMock.mockResolvedValue({ id: 'patient-id' })
  })

  it('finalizes registration with Supabase metadata update', async () => {
    const res = await POST(
      makeRequest({
        email: 'patient@example.com',
        supabaseUserId: 'user-123',
        firstName: 'Patient',
        lastName: 'Example',
        dateOfBirth: '1990-01-01',
        phoneNumber: '+1 555-1234',
      }),
    )

    expect(res.status).toBe(200)
    expect(updateUserByIdMock).toHaveBeenCalledWith('user-123', {
      app_metadata: { user_type: 'patient' },
      user_metadata: { first_name: 'Patient', last_name: 'Example' },
    })
    expect(createMock).toHaveBeenCalledWith({
      collection: 'patients',
      data: {
        email: 'patient@example.com',
        firstName: 'Patient',
        lastName: 'Example',
        dateOfBirth: '1990-01-01',
        phoneNumber: '+1 555-1234',
        supabaseUserId: 'user-123',
      },
      overrideAccess: true,
    })
  })

  it('rejects when Supabase user id is missing', async () => {
    const res = await POST(
      makeRequest({ email: 'patient@example.com', firstName: 'A', lastName: 'B' }),
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Supabase user id is required')
  })

  it('returns failure when Supabase metadata update fails', async () => {
    updateUserByIdMock.mockResolvedValueOnce({ error: { message: 'boom' } })

    const res = await POST(
      makeRequest({
        email: 'patient@example.com',
        supabaseUserId: 'user-123',
        firstName: 'Patient',
        lastName: 'Example',
      }),
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('boom')
  })
})

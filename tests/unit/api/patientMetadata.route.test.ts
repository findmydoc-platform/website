/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/auth/register/patient/metadata/route'

const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() }

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    buildConfig: (cfg: any) => cfg,
    getPayload: async () => ({ logger }),
  }
})

const adminClient = vi.hoisted(() => ({
  auth: {
    admin: {
      getUserById: vi.fn(),
      updateUserById: vi.fn(),
    },
  },
}))

const createAdminClientMock = vi.hoisted(() => vi.fn(async () => adminClient))

vi.mock('@/auth/utilities/supaBaseServer', () => ({
  createAdminClient: createAdminClientMock,
}))

function makeRequest(body: any) {
  return new Request('http://localhost/api/auth/register/patient/metadata', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as any
}

describe('POST /api/auth/register/patient/metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminClient.auth.admin.getUserById.mockResolvedValue({
      data: {
        user: {
          id: 'supabase-user-id',
          email: 'patient@example.com',
          app_metadata: {},
        },
      },
      error: null,
    })
    adminClient.auth.admin.updateUserById.mockResolvedValue({ data: {}, error: null })
  })

  test('sets user_type to patient when metadata missing', async () => {
    const response = await POST(makeRequest({ userId: 'supabase-user-id', email: 'patient@example.com' }))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toEqual({ success: true })
    expect(adminClient.auth.admin.updateUserById).toHaveBeenCalledWith('supabase-user-id', {
      app_metadata: { user_type: 'patient' },
    })
  })

  test('returns success without updating when already patient', async () => {
    adminClient.auth.admin.getUserById.mockResolvedValueOnce({
      data: {
        user: {
          id: 'supabase-user-id',
          email: 'patient@example.com',
          app_metadata: { user_type: 'patient' },
        },
      },
      error: null,
    })

    const response = await POST(makeRequest({ userId: 'supabase-user-id', email: 'patient@example.com' }))

    expect(response.status).toBe(200)
    expect(adminClient.auth.admin.updateUserById).not.toHaveBeenCalled()
  })

  test('rejects when email mismatch occurs', async () => {
    adminClient.auth.admin.getUserById.mockResolvedValueOnce({
      data: {
        user: {
          id: 'supabase-user-id',
          email: 'different@example.com',
          app_metadata: {},
        },
      },
      error: null,
    })

    const response = await POST(makeRequest({ userId: 'supabase-user-id', email: 'patient@example.com' }))

    expect(response.status).toBe(403)
    expect(adminClient.auth.admin.updateUserById).not.toHaveBeenCalled()
  })

  test('bubbles up Supabase errors when user is missing', async () => {
    adminClient.auth.admin.getUserById.mockResolvedValueOnce({ data: { user: null }, error: null })

    const response = await POST(makeRequest({ userId: 'missing-user', email: 'patient@example.com' }))

    expect(response.status).toBe(404)
  })

  test('returns 500 when update fails', async () => {
    adminClient.auth.admin.updateUserById.mockResolvedValueOnce({
      data: null,
      error: { message: 'bad update' },
    })

    const response = await POST(makeRequest({ userId: 'supabase-user-id', email: 'patient@example.com' }))

    expect(response.status).toBe(500)
  })

  test('validates payload shape', async () => {
    const response = await POST(makeRequest({ userId: '' }))
    expect(response.status).toBe(400)
    expect(adminClient.auth.admin.getUserById).not.toHaveBeenCalled()
  })
})

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/auth/register/patient/cleanup/route'

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
      deleteUser: vi.fn(),
    },
  },
}))

const createAdminClientMock = vi.hoisted(() => vi.fn(async () => adminClient))

vi.mock('@/auth/utilities/supaBaseServer', () => ({
  createAdminClient: createAdminClientMock,
}))

function makeRequest(body: any) {
  return new Request('http://localhost/api/auth/register/patient/cleanup', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as any
}

describe('POST /api/auth/register/patient/cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminClient.auth.admin.getUserById.mockResolvedValue({
      data: {
        user: {
          id: 'supabase-user-id',
          email: 'patient@example.com',
        },
      },
      error: null,
    })
    adminClient.auth.admin.deleteUser.mockResolvedValue({ data: {}, error: null })
  })

  test('deletes Supabase user when email matches', async () => {
    const response = await POST(makeRequest({ userId: 'supabase-user-id', email: 'patient@example.com' }))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toEqual({ success: true })
    expect(adminClient.auth.admin.deleteUser).toHaveBeenCalledWith('supabase-user-id')
  })

  test('returns success when user already missing', async () => {
    adminClient.auth.admin.getUserById.mockResolvedValueOnce({ data: { user: null }, error: null })

    const response = await POST(makeRequest({ userId: 'supabase-user-id', email: 'patient@example.com' }))

    expect(response.status).toBe(200)
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled()
  })

  test('rejects when email mismatch occurs', async () => {
    adminClient.auth.admin.getUserById.mockResolvedValueOnce({
      data: {
        user: {
          id: 'supabase-user-id',
          email: 'different@example.com',
        },
      },
      error: null,
    })

    const response = await POST(makeRequest({ userId: 'supabase-user-id', email: 'patient@example.com' }))

    expect(response.status).toBe(403)
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled()
  })

  test('propagates delete errors', async () => {
    adminClient.auth.admin.deleteUser.mockResolvedValueOnce({ error: { message: 'boom' } })

    const response = await POST(makeRequest({ userId: 'supabase-user-id', email: 'patient@example.com' }))

    expect(response.status).toBe(500)
  })

  test('validates payload shape', async () => {
    const response = await POST(makeRequest({ email: 'patient@example.com' }))
    expect(response.status).toBe(400)
    expect(adminClient.auth.admin.getUserById).not.toHaveBeenCalled()
  })

  test('returns 500 when Supabase lookup errors', async () => {
    adminClient.auth.admin.getUserById.mockResolvedValueOnce({ data: null, error: { message: 'nope' } })

    const response = await POST(makeRequest({ userId: 'supabase-user-id', email: 'patient@example.com' }))

    expect(response.status).toBe(500)
  })
})

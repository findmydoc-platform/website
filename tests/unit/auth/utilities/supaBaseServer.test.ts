import { beforeEach, describe, expect, it, vi } from 'vitest'

const createServerClientMock = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: createServerClientMock,
}))

describe('createAdminClient', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  })

  it('throws a clear error when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    const { createAdminClient } = await import('@/auth/utilities/supaBaseServer')

    await expect(createAdminClient()).rejects.toThrow('SUPABASE_SERVICE_ROLE_KEY is not defined')
    expect(createServerClientMock).not.toHaveBeenCalled()
  })

  it('creates the client with SUPABASE_SERVICE_ROLE_KEY when present', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    createServerClientMock.mockReturnValueOnce({ ok: true })

    const { createAdminClient } = await import('@/auth/utilities/supaBaseServer')
    const client = await createAdminClient()

    expect(client).toEqual({ ok: true })
    expect(createServerClientMock).toHaveBeenCalledTimes(1)
    expect(createServerClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-key',
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      }),
    )
  })
})

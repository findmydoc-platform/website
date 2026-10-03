import { beforeEach, describe, expect, it, vi } from 'vitest'

const createServerClientMock = vi.fn()
const cookieSet = vi.hoisted(() => vi.fn())
const cookieGetAll = vi.hoisted(() => vi.fn(() => [] as { name: string; value: string }[]))
vi.mock('next/headers.js', () => ({ cookies: async () => ({ set: cookieSet, getAll: cookieGetAll }) }))

vi.mock('@supabase/ssr', async (load) => ({
  ...(await load<typeof import('@supabase/ssr')>()),
  createServerClient: createServerClientMock,
}))

describe('createAdminClient', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    cookieGetAll.mockReturnValue([])
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
  it('buffers token-verification cookies until the authorized subject is committed', async () => {
    createServerClientMock.mockReturnValueOnce({ auth: {} })
    const { createVerificationClient } = await import('@/auth/utilities/supaBaseServer')
    const client = createVerificationClient()
    const options = createServerClientMock.mock.calls[0]![2] as {
      cookies: { setAll(values: { name: string; value: string; options: object }[]): void }
    }
    options.cookies.setAll([{ name: 'sb-offline-auth-token', value: 'offline-session', options: { httpOnly: true } }])
    expect(cookieSet).not.toHaveBeenCalled()
    await client.commitSession()
    expect(cookieSet).toHaveBeenCalledWith('sb-offline-auth-token', 'offline-session', { httpOnly: true })
    await client.commitSession()
    expect(cookieSet).toHaveBeenCalledOnce()
  })
  it('replaces the old session cookie family before installing chunked verification cookies', async () => {
    createServerClientMock.mockReturnValueOnce({ auth: {} })
    cookieGetAll.mockReturnValue([
      { name: 'sb-example-auth-token', value: 'old-identity' },
      { name: 'sb-example-auth-token.0', value: 'old-chunk' },
      { name: 'sb-example-auth-token.3', value: 'stale-chunk' },
      { name: 'unrelated', value: 'keep' },
    ])
    const { createVerificationClient } = await import('@/auth/utilities/supaBaseServer')
    const client = createVerificationClient()
    const options = createServerClientMock.mock.calls[0]![2] as {
      cookies: { setAll(values: { name: string; value: string; options: object }[]): void }
    }
    options.cookies.setAll([
      { name: 'sb-example-auth-token.0', value: 'new-0', options: { path: '/' } },
      { name: 'sb-example-auth-token.1', value: 'new-1', options: { path: '/' } },
    ])
    await client.commitSession()
    expect(cookieSet.mock.calls.slice(0, 3)).toEqual([
      ['sb-example-auth-token', '', expect.objectContaining({ maxAge: 0, path: '/' })],
      ['sb-example-auth-token.0', '', expect.objectContaining({ maxAge: 0, path: '/' })],
      ['sb-example-auth-token.3', '', expect.objectContaining({ maxAge: 0, path: '/' })],
    ])
    expect(cookieSet.mock.calls.slice(3).map(([name, value]) => [name, value])).toEqual([
      ['sb-example-auth-token.0', 'new-0'],
      ['sb-example-auth-token.1', 'new-1'],
    ])
  })
  it('aborts a scoped admin request when the recovery scheduler deadline expires', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    const controller = new AbortController()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
            once: true,
          })
        }),
    )
    try {
      const { createAdminClient } = await import('@/auth/utilities/supaBaseServer')
      await createAdminClient(controller.signal)
      const options = createServerClientMock.mock.calls[0]![2] as { global: { fetch: typeof fetch } }
      const pending = options.global.fetch('https://example.supabase.co/auth/v1/admin/users', { method: 'GET' })
      controller.abort()
      await expect(pending).rejects.toThrow('Aborted')
      expect(fetchSpy).toHaveBeenCalledWith('https://example.supabase.co/auth/v1/admin/users', {
        method: 'GET',
        signal: controller.signal,
      })
    } finally {
      fetchSpy.mockRestore()
    }
  })
  it('clears the base local auth cookie and all chunks while preserving foreign cookies', async () => {
    cookieGetAll.mockReturnValue([
      { name: 'sb-example-auth-token', value: 'offline-session' },
      { name: 'sb-example-auth-token.0', value: 'offline-first-chunk' },
      { name: 'sb-example-auth-token.3', value: 'offline-stale-chunk' },
      { name: 'sb-other-auth-token', value: 'foreign-session' },
      { name: 'unrelated', value: 'keep' },
    ])
    const { clearLocalAuthSession } = await import('@/auth/utilities/supaBaseServer')
    await clearLocalAuthSession()
    expect(cookieSet.mock.calls).toEqual([
      ['sb-example-auth-token', '', expect.objectContaining({ maxAge: 0, path: '/' })],
      ['sb-example-auth-token.0', '', expect.objectContaining({ maxAge: 0, path: '/' })],
      ['sb-example-auth-token.3', '', expect.objectContaining({ maxAge: 0, path: '/' })],
    ])
  })
})

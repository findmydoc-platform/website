import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { PREVIEW_GUARD_LOCK_REQUEST_HEADER, PREVIEW_GUARD_LOGIN_REQUIRED_MESSAGE_KEY } from '@/features/previewGuard'

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getUser: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: mocks.createServerClient,
}))

import { config, proxy } from '@/proxy'

describe('preview lock proxy', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DEPLOYMENT_ENV: undefined,
      VERCEL_ENV: undefined,
      PREVIEW_GUARD_ENABLED: 'false',
      NODE_ENV: 'development',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon-key',
    }

    vi.clearAllMocks()

    mocks.createServerClient.mockReturnValue({
      auth: {
        getUser: mocks.getUser,
      },
    })
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('redirects unauthenticated preview users to admin login', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    process.env.PREVIEW_GUARD_ENABLED = 'true'
    const request = new NextRequest('https://example.com/posts/example?foo=bar')

    const response = await proxy(request)

    expect(response.status).toBe(307)
    const redirectLocation = response.headers.get('location')
    expect(redirectLocation).toBeTruthy()

    const redirectUrl = new URL(redirectLocation as string)
    expect(redirectUrl.pathname).toBe('/admin/login')
    expect(redirectUrl.searchParams.get('message')).toBe(PREVIEW_GUARD_LOGIN_REQUIRED_MESSAGE_KEY)
    expect(redirectUrl.searchParams.get('next')).toBe('/posts/example?foo=bar')
  })

  it('allows unauthenticated preview users on exempt routes and sets lock header', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    process.env.PREVIEW_GUARD_ENABLED = 'true'
    const request = new NextRequest('https://example.com/admin/login')

    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(response.headers.get(`x-middleware-request-${PREVIEW_GUARD_LOCK_REQUEST_HEADER}`)).toBe('1')
  })

  it('redirects authenticated clinic users in preview guard', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    process.env.PREVIEW_GUARD_ENABLED = 'true'
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', app_metadata: { user_type: 'clinic' } } },
      error: null,
    })

    const request = new NextRequest('https://example.com/posts/example')
    const response = await proxy(request)

    expect(response.status).toBe(307)
    const redirectLocation = response.headers.get('location')
    const redirectUrl = new URL(redirectLocation as string)
    expect(redirectUrl.pathname).toBe('/admin/login')
  })

  it('allows authenticated platform users', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    process.env.PREVIEW_GUARD_ENABLED = 'true'
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-2', app_metadata: { user_type: 'platform' } } },
      error: null,
    })

    const request = new NextRequest('https://example.com/posts/example')
    const response = await proxy(request)

    expect(response.status).toBe(200)
  })

  it('does not enforce preview lock outside preview environments', async () => {
    const request = new NextRequest('https://example.com/posts/example')
    const response = await proxy(request)

    expect(response.status).toBe(200)
  })

  it('bypasses API routes', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    process.env.PREVIEW_GUARD_ENABLED = 'true'
    const request = new NextRequest('https://example.com/api/forms/contact')
    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('matcher excludes api routes', () => {
    expect(config.matcher).toContain('/((?!api|_next/static|_next/image|.*\\..*).*)')
  })
})

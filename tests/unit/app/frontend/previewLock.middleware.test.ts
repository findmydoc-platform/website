import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { PREVIEW_GUARD_LOCK_REQUEST_HEADER, PREVIEW_GUARD_LOGIN_REQUIRED_MESSAGE_KEY } from '@/features/previewGuard'
import { TEMPORARY_LANDING_MODE_REQUEST_HEADER } from '@/features/temporaryLandingMode'

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
      TEMPORARY_LANDING_MODE_ENABLED: undefined,
      VERCEL_ENV: undefined,
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
    const request = new NextRequest('https://example.com/admin/login')

    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(response.headers.get(`x-middleware-request-${PREVIEW_GUARD_LOCK_REQUEST_HEADER}`)).toBe('1')
  })

  it('redirects authenticated clinic users in preview guard', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
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

  it('marks root requests for temporary landing mode', async () => {
    process.env.TEMPORARY_LANDING_MODE_ENABLED = 'true'
    const request = new NextRequest('https://example.com/')

    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(response.headers.get(`x-middleware-request-${TEMPORARY_LANDING_MODE_REQUEST_HEADER}`)).toBe('1')
    expect(response.headers.get(`x-middleware-request-${PREVIEW_GUARD_LOCK_REQUEST_HEADER}`)).toBe('1')
  })

  it('returns 404 for non-root routes in temporary landing mode', async () => {
    process.env.TEMPORARY_LANDING_MODE_ENABLED = 'true'
    const request = new NextRequest('https://example.com/posts/example')

    const response = await proxy(request)

    expect(response.status).toBe(404)
    expect(response.headers.get('location')).toBeNull()
  })

  it('keeps admin login reachable in temporary landing mode', async () => {
    process.env.TEMPORARY_LANDING_MODE_ENABLED = 'true'
    const request = new NextRequest('https://example.com/admin/login')

    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(response.headers.get(`x-middleware-request-${PREVIEW_GUARD_LOCK_REQUEST_HEADER}`)).toBe('1')
  })

  it('keeps admin root reachable in temporary landing mode', async () => {
    process.env.TEMPORARY_LANDING_MODE_ENABLED = 'true'
    const request = new NextRequest('https://example.com/admin')

    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(response.headers.get(`x-middleware-request-${PREVIEW_GUARD_LOCK_REQUEST_HEADER}`)).toBe('1')
  })

  it('keeps privacy, imprint, and contact pages reachable in temporary landing mode', async () => {
    process.env.TEMPORARY_LANDING_MODE_ENABLED = 'true'

    const privacyRequest = new NextRequest('https://example.com/privacy-policy')
    const imprintRequest = new NextRequest('https://example.com/imprint')
    const contactRequest = new NextRequest('https://example.com/contact')

    const privacyResponse = await proxy(privacyRequest)
    const imprintResponse = await proxy(imprintRequest)
    const contactResponse = await proxy(contactRequest)

    expect(privacyResponse.status).toBe(200)
    expect(imprintResponse.status).toBe(200)
    expect(contactResponse.status).toBe(200)

    expect(privacyResponse.headers.get(`x-middleware-request-${PREVIEW_GUARD_LOCK_REQUEST_HEADER}`)).toBe('1')
    expect(imprintResponse.headers.get(`x-middleware-request-${PREVIEW_GUARD_LOCK_REQUEST_HEADER}`)).toBe('1')
    expect(contactResponse.headers.get(`x-middleware-request-${PREVIEW_GUARD_LOCK_REQUEST_HEADER}`)).toBe('1')
  })

  it('allows platform users to bypass temporary landing mode', async () => {
    process.env.TEMPORARY_LANDING_MODE_ENABLED = 'true'
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-2', app_metadata: { user_type: 'platform' } } },
      error: null,
    })

    const request = new NextRequest('https://example.com/posts/example')
    const response = await proxy(request)

    expect(response.status).toBe(200)
  })

  it('prioritizes temporary landing mode over preview redirects', async () => {
    process.env.TEMPORARY_LANDING_MODE_ENABLED = 'true'
    process.env.DEPLOYMENT_ENV = 'preview'

    const request = new NextRequest('https://example.com/posts/example')
    const response = await proxy(request)

    expect(response.status).toBe(404)
    expect(response.headers.get('location')).toBeNull()
  })

  it('bypasses API routes', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    const request = new NextRequest('https://example.com/api/forms/contact')
    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('matcher excludes api routes', () => {
    expect(config.matcher).toContain('/((?!api|_next/static|_next/image|.*\\..*).*)')
  })
})

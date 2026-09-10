import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import {
  POST,
  POSTHOG_PREVIEW_EXCEPTION_TEST_HEADER,
  POSTHOG_PREVIEW_EXCEPTION_TEST_MESSAGE,
} from '@/app/api/internal/posthog-exception-test/route'

describe('POST /api/internal/posthog-exception-test', () => {
  beforeEach(() => {
    vi.stubEnv('DEPLOYMENT_ENVIRONMENT', 'preview')
    vi.stubEnv('POSTHOG_PREVIEW_EXCEPTION_TEST_TOKEN', 'test-verification-token')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([undefined, 'wrong-token'])('returns 404 without a valid token', async (token) => {
    const headers = token ? { [POSTHOG_PREVIEW_EXCEPTION_TEST_HEADER]: token } : undefined

    const response = await POST(new NextRequest('http://localhost/api/internal/posthog-exception-test', { headers }))

    expect(response.status).toBe(404)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })

  it.each(['development', 'production'])('returns 404 in %s even when the token is valid', async (environment) => {
    vi.stubEnv('DEPLOYMENT_ENVIRONMENT', environment)

    const response = await POST(
      new NextRequest('http://localhost/api/internal/posthog-exception-test', {
        headers: { [POSTHOG_PREVIEW_EXCEPTION_TEST_HEADER]: 'test-verification-token' },
      }),
    )

    expect(response.status).toBe(404)
  })

  it('returns 404 when the preview token is not configured', async () => {
    vi.stubEnv('POSTHOG_PREVIEW_EXCEPTION_TEST_TOKEN', '')

    const response = await POST(
      new NextRequest('http://localhost/api/internal/posthog-exception-test', {
        headers: { [POSTHOG_PREVIEW_EXCEPTION_TEST_HEADER]: 'test-verification-token' },
      }),
    )

    expect(response.status).toBe(404)
  })

  it('throws one fixed error for a valid preview verification request', async () => {
    const request = new NextRequest('http://localhost/api/internal/posthog-exception-test', {
      headers: { [POSTHOG_PREVIEW_EXCEPTION_TEST_HEADER]: 'test-verification-token' },
    })

    await expect(POST(request)).rejects.toThrow(POSTHOG_PREVIEW_EXCEPTION_TEST_MESSAGE)
  })
})

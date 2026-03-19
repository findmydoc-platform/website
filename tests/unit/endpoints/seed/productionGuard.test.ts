import { describe, it, expect, vi, afterEach } from 'vitest'
import type { PayloadRequest } from 'payload'
import { createMockPayload, createMockReq } from '../../helpers/testHelpers'
import { mockUsers } from '../../helpers/mockUsers'

type MockResponse = {
  _status?: number
  _body: Record<string, unknown>
  status: (code: number) => MockResponse
  json: (body: unknown) => MockResponse
}

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

import { seedPostHandler } from '@/endpoints/seed/seedEndpoint'

function makeReq(query: Record<string, unknown>): PayloadRequest {
  return createMockReq(mockUsers.platform(), createMockPayload(), { query }) as PayloadRequest
}

function makeRes(): MockResponse {
  const res: Partial<MockResponse> = {
    _status: 0,
    _body: {},
    status: (code: number) => {
      res._status = code
      return res as MockResponse
    },
    json: (body: unknown) => {
      res._body = body as Record<string, unknown>
      return res as MockResponse
    },
  }

  return res as MockResponse
}

describe('production seed guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('blocks demo seeding in production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_ENV', 'production')
    vi.stubEnv('NODE_ENV', 'production')

    const res = makeRes()
    await seedPostHandler(makeReq({ type: 'demo' }), res)

    expect(res._status).toBe(405)
    expect(res._body.error).toBe('Seed requests are disabled in this runtime.')
  })

  it('blocks reset requests in production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_ENV', 'production')
    vi.stubEnv('NODE_ENV', 'production')

    const res = makeRes()
    await seedPostHandler(makeReq({ type: 'baseline', reset: '1' }), res)

    expect(res._status).toBe(405)
    expect(res._body.error).toBe('Seed requests are disabled in this runtime.')
  })

  it('queues baseline seeding in development runtime', async () => {
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('DEPLOYMENT_ENV', '')
    vi.stubEnv('NODE_ENV', 'development')

    const res = makeRes()
    await seedPostHandler(makeReq({ type: 'baseline' }), res)

    expect(res._status).toBe(202)
    expect(res._body.type).toBe('baseline')
  })
})

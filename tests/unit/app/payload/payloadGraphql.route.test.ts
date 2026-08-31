import { beforeEach, describe, expect, it, vi } from 'vitest'

const routeMocks = vi.hoisted(() => {
  const graphqlHandler = vi.fn().mockResolvedValue(Response.json({ data: { Posts: { docs: [] } } }))
  const optionsHandler = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  return {
    after: vi.fn(),
    getPayload: vi.fn().mockResolvedValue({}),
    graphqlHandler,
    optionsHandler,
    sendPostHogException: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('@payload-config', () => ({ default: Promise.resolve({}) }))
vi.mock('@payloadcms/next/routes', () => ({
  GRAPHQL_POST: vi.fn(() => routeMocks.graphqlHandler),
  REST_OPTIONS: vi.fn(() => routeMocks.optionsHandler),
}))
vi.mock('next/server.js', () => ({ after: routeMocks.after }))
vi.mock('@/posthog/api', () => ({ sendPostHogException: routeMocks.sendPostHogException }))
vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return { ...actual, getPayload: routeMocks.getPayload }
})

describe('Payload GraphQL route database availability', () => {
  beforeEach(() => {
    vi.resetModules()
    routeMocks.after.mockReset()
    routeMocks.getPayload.mockReset().mockResolvedValue({})
    routeMocks.graphqlHandler.mockReset().mockResolvedValue(Response.json({ data: { Posts: { docs: [] } } }))
    routeMocks.optionsHandler.mockReset().mockResolvedValue(new Response(null, { status: 204 }))
    routeMocks.sendPostHogException.mockReset().mockResolvedValue(undefined)
  })

  it('returns the GraphQL 503 contract when Payload cannot acquire its initial database connection', async () => {
    routeMocks.getPayload.mockRejectedValueOnce(
      Object.assign(new Error('temporary DNS failure'), { code: 'EAI_AGAIN' }),
    )
    const route = await import('@/app/(payload)/api/graphql/route')

    const response = await route.POST(
      new Request('https://preview.findmydoc.eu/api/graphql', {
        body: JSON.stringify({ query: '{ Posts { docs { id } } }' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          extensions: {
            code: 'DATABASE_TEMPORARILY_UNAVAILABLE',
            statusCode: 503,
          },
          message: 'Database temporarily unavailable',
        },
      ],
    })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(routeMocks.graphqlHandler).not.toHaveBeenCalled()
  })

  it('passes a healthy GraphQL request through to Payload', async () => {
    const payloadResponse = Response.json({ data: { Posts: { docs: [{ id: 1 }] } } })
    routeMocks.graphqlHandler.mockResolvedValueOnce(payloadResponse)
    const route = await import('@/app/(payload)/api/graphql/route')
    const request = new Request('https://preview.findmydoc.eu/api/graphql', {
      body: JSON.stringify({ query: '{ Posts { docs { id } } }' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    const response = await route.POST(request)

    expect(response).toBe(payloadResponse)
    expect(routeMocks.graphqlHandler).toHaveBeenCalledWith(request)
  })
})

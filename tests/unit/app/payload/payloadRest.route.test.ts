import { beforeEach, describe, expect, it, vi } from 'vitest'

const routeMocks = vi.hoisted(() => {
  const payloadHandler = vi.fn().mockResolvedValue(Response.json({ source: 'payload' }))
  return {
    after: vi.fn(),
    getPayload: vi.fn().mockResolvedValue({}),
    payloadHandler,
    sendPostHogException: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('@payload-config', () => ({ default: Promise.resolve({}) }))
vi.mock('@payloadcms/next/css', () => ({}))
vi.mock('@payloadcms/next/routes', () => ({
  REST_DELETE: vi.fn(() => routeMocks.payloadHandler),
  REST_GET: vi.fn(() => routeMocks.payloadHandler),
  REST_OPTIONS: vi.fn(() => routeMocks.payloadHandler),
  REST_PATCH: vi.fn(() => routeMocks.payloadHandler),
  REST_POST: vi.fn(() => routeMocks.payloadHandler),
  REST_PUT: vi.fn(() => routeMocks.payloadHandler),
}))
vi.mock('next/server.js', () => ({ after: routeMocks.after }))
vi.mock('@/posthog/api', () => ({ sendPostHogException: routeMocks.sendPostHogException }))
vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return { ...actual, getPayload: routeMocks.getPayload }
})

const context = { params: Promise.resolve({ slug: ['posts'] }) }

describe('Payload REST route database availability', () => {
  beforeEach(() => {
    vi.resetModules()
    routeMocks.after.mockReset()
    routeMocks.getPayload.mockReset().mockResolvedValue({})
    routeMocks.payloadHandler.mockReset().mockResolvedValue(Response.json({ source: 'payload' }))
    routeMocks.sendPostHogException.mockReset().mockResolvedValue(undefined)
  })

  it('returns the stable 503 contract when Payload cannot acquire its initial database connection', async () => {
    routeMocks.getPayload.mockRejectedValueOnce(
      Object.assign(new Error('pool client limit reached'), { code: 'EMAXCONN' }),
    )
    const route = await import('@/app/(payload)/api/[...slug]/route')

    const response = await route.GET(new Request('https://preview.findmydoc.eu/api/posts'), context)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'DATABASE_TEMPORARILY_UNAVAILABLE' },
    })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(routeMocks.payloadHandler).not.toHaveBeenCalled()
  })

  it('passes a healthy request through to the native Payload handler', async () => {
    const payloadResponse = Response.json({ docs: [{ id: 1 }] })
    routeMocks.payloadHandler.mockResolvedValueOnce(payloadResponse)
    const route = await import('@/app/(payload)/api/[...slug]/route')
    const request = new Request('https://preview.findmydoc.eu/api/posts')

    const response = await route.GET(request, context)

    expect(response).toBe(payloadResponse)
    expect(routeMocks.payloadHandler).toHaveBeenCalledWith(request, context)
  })

  it('rethrows a non-database initialization error without invoking Payload a second time', async () => {
    const initializationError = new Error('Payload plugin initialization failed')
    routeMocks.getPayload.mockRejectedValueOnce(initializationError)
    const route = await import('@/app/(payload)/api/[...slug]/route')

    await expect(route.GET(new Request('https://preview.findmydoc.eu/api/posts'), context)).rejects.toBe(
      initializationError,
    )
    expect(routeMocks.payloadHandler).not.toHaveBeenCalled()
  })
})

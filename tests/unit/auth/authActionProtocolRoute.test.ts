import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/internal/auth-actions/v1/[operation]/route'

const boundary = vi.hoisted(() => ({ getPayload: vi.fn(), createLocalReq: vi.fn(), handle: vi.fn() }))
vi.mock('@/payload.config', () => ({ default: Promise.resolve({}) }))
vi.mock('payload', async (load) => ({
  ...(await load<typeof import('payload')>()),
  getPayload: boundary.getPayload,
  createLocalReq: boundary.createLocalReq,
}))
vi.mock('@/auth/actions/protocol/http', async (load) => ({
  ...(await load<typeof import('@/auth/actions/protocol/http')>()),
  bindAuthActionProtocol: () => boundary.handle,
}))
const keys = {
  environment: 'test',
  service: [{ version: 'current', secret: randomBytes(32).toString('hex') }],
  reference: [{ version: 'current', secret: randomBytes(32).toString('hex') }],
}
const now = Date.parse('2026-10-04T12:00:00.000Z')
const context = { params: Promise.resolve({ operation: 'validateAction' }) }
function request(body = '{}', signed = true) {
  const requestId = randomUUID()
  const timestamp = new Date(now).toISOString()
  const signature = createHmac('sha256', keys.service[0]!.secret)
    .update(
      JSON.stringify([
        'auth-action-protocol-v1',
        'test',
        'POST',
        'validateAction',
        timestamp,
        requestId,
        createHash('sha256').update(body).digest('hex'),
      ]),
    )
    .digest('hex')
  return new Request('https://website.example.invalid/api/internal/auth-actions/v1/validateAction', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-action-timestamp': timestamp,
      'x-auth-action-request-id': requestId,
      'x-auth-action-key-version': 'current',
      'x-auth-action-signature': signed ? signature : 'invalid',
    },
    body,
  })
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(Date, 'now').mockReturnValue(now)
  vi.stubEnv('DEPLOYMENT_ENV', 'test')
  vi.stubEnv('CI', 'false')
  vi.stubEnv('VERCEL_ENV', '')
  vi.stubEnv('AUTH_ACTION_PROTOCOL_KEYS_JSON', JSON.stringify(keys))
  boundary.getPayload.mockResolvedValue({})
  boundary.createLocalReq.mockResolvedValue({})
  boundary.handle.mockResolvedValue(Response.json({ version: 1, ok: true, outcome: 'valid' }))
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('native auth-action route authentication', () => {
  it('rejects unsigned and oversized cloned requests before Payload initialization', async () => {
    expect((await POST(request('{}', false), context)).status).toBe(400)
    expect((await POST(request('x'.repeat(16385)), context)).status).toBe(400)
    expect(boundary.getPayload).not.toHaveBeenCalled()
    expect(boundary.handle).not.toHaveBeenCalled()
  })
  it('passes an intact authenticated request into the production handler after initializing native Payload', async () => {
    expect((await POST(request(), context)).status).toBe(200)
    expect(boundary.getPayload).toHaveBeenCalledOnce()
    expect(boundary.handle).toHaveBeenCalledOnce()
    expect(await boundary.handle.mock.calls[0]![0].text()).toBe('{}')
  })
  it('fails closed with private no-store output when environment credentials are unavailable', async () => {
    vi.stubEnv('AUTH_ACTION_PROTOCOL_KEYS_JSON', '')
    const response = await POST(request(), context)
    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toEqual({ version: 1, ok: false, code: 'AUTH_ACTION_TEMPORARILY_UNAVAILABLE' })
    expect(boundary.getPayload).not.toHaveBeenCalled()
  })
})

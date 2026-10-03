import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/auth/password/reset/route'
const mocks = vi.hoisted(() => ({ getPayload: vi.fn(), createLocalReq: vi.fn(), request: vi.fn(), context: vi.fn() }))
vi.mock('payload', async (load) => ({
  ...(await load<typeof import('payload')>()),
  getPayload: mocks.getPayload,
  createLocalReq: mocks.createLocalReq,
}))
vi.mock('@/auth/actions/passwordRecoveryRequests', () => ({ requestPasswordRecovery: mocks.request }))
vi.mock('@/auth/actions/recoveryContext', () => ({ websiteRecoveryContext: mocks.context }))
function request(body: unknown) {
  return new NextRequest('https://example.test/api/auth/password/reset', { method: 'POST', body: JSON.stringify(body) })
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getPayload.mockResolvedValue({})
  mocks.createLocalReq.mockResolvedValue({ user: null })
  mocks.context.mockReturnValue(null)
})
describe('Website recovery public response', () => {
  it('routes a valid address through Auth with a server-owned context and neutral uncached response', async () => {
    const context = Object.freeze({})
    mocks.context.mockReturnValue(context)
    const response = await POST(request({ email: 'person@example.test' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ success: true })
    expect(mocks.request).toHaveBeenCalledWith({ user: null }, { email: 'person@example.test', context })
  })
  it.each(['missing', 'limited', 'inactive', 'private infrastructure detail'])(
    'acknowledges %s without account disclosure',
    async (reason) => {
      mocks.request.mockRejectedValueOnce(new Error(reason))
      const response = await POST(request({ email: 'unknown@example.test' }))
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(await response.json()).toEqual({ success: true })
    },
  )
  it('keeps a Payload outage indistinguishable from successful admission', async () => {
    mocks.getPayload.mockRejectedValue(new Error('Private database detail'))
    const response = await POST(request({ email: 'person@example.test' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
  })
  it.each([
    { email: 'bad' },
    { email: 'x'.repeat(255) + '@example.test' },
    { email: 'person@example.test', recipient: 'other@example.test' },
    null,
  ])('rejects malformed input before initializing Payload', async (body) => {
    const response = await POST(request(body))
    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(mocks.getPayload).not.toHaveBeenCalled()
    expect(mocks.request).not.toHaveBeenCalled()
  })
})

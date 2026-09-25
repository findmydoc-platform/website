import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/internal/transactional-email/worker/route'

const dependencies = vi.hoisted(() => ({
  getPayload: vi.fn(),
  createLocalReq: vi.fn(),
  createWorker: vi.fn(),
  selectRuntime: vi.fn(),
}))

vi.mock('payload', () => ({ getPayload: dependencies.getPayload, createLocalReq: dependencies.createLocalReq }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/features/transactionalEmail/environment', () => ({
  selectTransactionalEmailRuntime: dependencies.selectRuntime,
}))
vi.mock('@/features/transactionalEmail/worker', () => ({
  createTransactionalEmailWorker: dependencies.createWorker,
}))

const endpoint = 'https://example.test/api/internal/transactional-email/worker'
const secret = 'synthetic-scheduler-secret-for-tests-only'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('scheduler request through hosted composition', () => {
  it('rejects an unauthenticated request before Payload or worker resolution', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('CRON_SECRET', secret)
    const response = await GET(new Request(endpoint))
    expect(response.status).toBe(401)
    expect(dependencies.selectRuntime).not.toHaveBeenCalled()
    expect(dependencies.getPayload).not.toHaveBeenCalled()
    expect(dependencies.createWorker).not.toHaveBeenCalled()
  })

  it('rejects environment drift before Payload resolution', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('CRON_SECRET', secret)
    dependencies.selectRuntime.mockReturnValue({ environment: 'production' })
    const response = await GET(new Request(endpoint, { headers: { authorization: `Bearer ${secret}` } }))
    expect(response.status).toBe(503)
    expect(dependencies.getPayload).not.toHaveBeenCalled()
  })

  it('runs safety work and at most five claims with two in flight after authorization', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('CRON_SECRET', secret)
    dependencies.selectRuntime.mockReturnValue({ environment: 'preview' })
    dependencies.getPayload.mockResolvedValue({})
    dependencies.createLocalReq.mockResolvedValue({})

    const order: string[] = []
    let inFlight = 0
    let peak = 0
    const worker = {
      sweepForBatch: vi.fn(async () => {
        order.push('sweep')
        return true
      }),
      candidatesForBatch: vi.fn(async (afterId: number) =>
        Array.from({ length: 8 }, (_, index) => index + 1).filter((id) => id > afterId),
      ),
      claimForBatch: vi.fn(async (id: string) => {
        order.push(`claim:${id}`)
        return { operationId: id, token: `lease-${id}` }
      }),
      processClaimForBatch: vi.fn(async () => {
        inFlight += 1
        peak = Math.max(peak, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 1))
        inFlight -= 1
      }),
    }
    dependencies.createWorker.mockReturnValue(worker)

    const response = await GET(new Request(endpoint, { headers: { authorization: `Bearer ${secret}` } }))
    expect(response.status).toBe(200)
    expect(dependencies.createWorker).toHaveBeenCalledTimes(1)
    expect(order[0]).toBe('sweep')
    expect(worker.claimForBatch).toHaveBeenCalledTimes(5)
    expect(worker.processClaimForBatch).toHaveBeenCalledTimes(5)
    expect(peak).toBe(2)
  })
})

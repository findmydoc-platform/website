import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '@/app/api/internal/transactional-email/worker/route'
import { runBoundedTransactionalEmailWorker } from '@/features/transactionalEmail/scheduler'

const runHosted = vi.fn()
vi.mock('@/features/transactionalEmail/hostedScheduler', () => ({
  runHostedTransactionalEmailWorker: (...args: unknown[]) => runHosted(...args),
}))

const secret = 'synthetic-scheduler-secret-for-tests-only'
const endpoint = 'https://example.test/api/internal/transactional-email/worker'
const invalidCredentials: Array<{ label: string; url: string; headers: Record<string, string>; body?: string }> = [
  { label: 'missing', url: endpoint, headers: {} },
  { label: 'wrong', url: endpoint, headers: { authorization: 'Bearer wrong' } },
  { label: 'URL', url: `${endpoint}?token=${secret}`, headers: {} },
  { label: 'cookie', url: endpoint, headers: { cookie: `token=${secret}` } },
  { label: 'body', url: endpoint, headers: {}, body: secret },
]

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('hosted transactional email scheduler request', () => {
  it.each(invalidCredentials)('rejects $label credentials without resolving work', async ({ url, headers, body }) => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('CRON_SECRET', secret)
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const request = new Request(url, { headers, ...(body ? { body, method: 'POST' } : {}) })
    const response = body ? await POST(request) : await GET(request)
    expect(response.status).toBe(401)
    expect(runHosted).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['preview', 'production'])(
    'runs the %s worker once for its own authorization header',
    async (environment) => {
      vi.stubEnv('VERCEL_ENV', environment)
      vi.stubEnv('CRON_SECRET', secret)
      runHosted.mockResolvedValue({ claimed: 0 })
      const fetch = vi.fn()
      vi.stubGlobal('fetch', fetch)
      const response = await GET(new Request(endpoint, { headers: { authorization: `Bearer ${secret}` } }))
      expect(response.status).toBe(200)
      expect(runHosted).toHaveBeenCalledTimes(1)
      expect(fetch).not.toHaveBeenCalled()
    },
  )
})

describe('bounded transactional email worker invocation', () => {
  it('sweeps first and limits claims to five with at most two in flight', async () => {
    const order: string[] = []
    let active = 0
    let peak = 0
    const result = await runBoundedTransactionalEmailWorker(
      {
        sweep: async () => {
          order.push('sweep')
          return true
        },
        candidates: async (afterId) => Array.from({ length: 8 }, (_, index) => index + 1).filter((id) => id > afterId),
        claim: async (id) => {
          order.push(`claim:${id}`)
          return { operationId: String(id), token: `lease-${id}` }
        },
        processClaim: async () => {
          active += 1
          peak = Math.max(peak, active)
          await new Promise((resolve) => setTimeout(resolve, 1))
          active -= 1
        },
      },
      () => 0,
    )
    expect(order[0]).toBe('sweep')
    expect(order.filter((event) => event.startsWith('claim:'))).toHaveLength(5)
    expect(peak).toBe(2)
    expect(result.claimed).toBe(5)
  })

  it('does not start another claim without attempt and result budget', async () => {
    let clock = 0
    const claim = vi.fn(async (id: number) => {
      clock = 215_001
      return { operationId: String(id), token: `lease-${id}` }
    })
    const result = await runBoundedTransactionalEmailWorker(
      {
        sweep: async () => true,
        candidates: async (afterId) => [1, 2, 3].filter((id) => id > afterId),
        claim,
        processClaim: async () => undefined,
      },
      () => clock,
    )
    expect(claim).toHaveBeenCalledTimes(1)
    expect(result.claimed).toBe(1)
  })

  it('defers claims when the safety sweep has more work', async () => {
    const candidates = vi.fn()
    const claim = vi.fn()
    const result = await runBoundedTransactionalEmailWorker({
      sweep: async () => false,
      candidates,
      claim,
      processClaim: async () => undefined,
    })
    expect(result.claimed).toBe(0)
    expect(candidates).not.toHaveBeenCalled()
    expect(claim).not.toHaveBeenCalled()
  })
})

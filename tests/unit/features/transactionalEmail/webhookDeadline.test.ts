import type { PayloadRequest } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebhookDeadline } from '@/features/transactionalEmail/webhookDeadline'

// Capture the external SQL tag boundary; real PostgreSQL controls are exercised by the route integration suite.
vi.mock('@payloadcms/db-postgres', () => ({
  sql: (strings: TemplateStringsArray, ...parameters: unknown[]) => ({
    text: strings.join('?').replace(/\s+/g, ' ').trim(),
    parameters,
  }),
}))

type Control = { text: string; parameters: string[] }
function fixture() {
  const execute = vi.fn(async ({ parameters }: Control) => ({
    rows: [{ statement_timeout: parameters[0], idle_timeout: parameters[1] }],
  }))
  const req = { payload: { db: { name: 'postgres', sessions: { owned: { db: { execute } } } } } }
  return { execute, req, asRequest: req as unknown as PayloadRequest }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('private webhook transaction deadline controls', () => {
  it('executes only fixed transaction-local controls with a decreasing numeric budget', async () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000)
    const deadline = new WebhookDeadline()
    const { execute, asRequest } = fixture()
    try {
      await deadline.beforeOperation(asRequest, 'owned')
      clock.mockReturnValue(1900)
      await deadline.beforeOperation(asRequest, 'owned')
      const controls = execute.mock.calls.map(([control]) => control)
      expect(controls).toEqual([
        {
          text: "SELECT set_config('statement_timeout', ?, true) AS statement_timeout, set_config('idle_in_transaction_session_timeout', ?, true) AS idle_timeout",
          parameters: ['4900ms', '4900ms'],
        },
        {
          text: "SELECT set_config('statement_timeout', ?, true) AS statement_timeout, set_config('idle_in_transaction_session_timeout', ?, true) AS idle_timeout",
          parameters: ['4000ms', '4000ms'],
        },
      ])
      clock.mockReturnValue(6000)
      await expect(deadline.beforeOperation(asRequest, 'owned')).rejects.toMatchObject({ code: 'storage-unavailable' })
      expect(execute).toHaveBeenCalledTimes(2)
    } finally {
      deadline.dispose()
    }
  })

  it.each(['adapter', 'session', 'capability', 'result', 'zero', 'wrong-value'])(
    'fails closed for an unsupported %s without application-data access',
    async (fault) => {
      vi.spyOn(performance, 'now').mockReturnValue(0)
      const deadline = new WebhookDeadline()
      const { execute, req, asRequest } = fixture()
      if (fault === 'adapter') req.payload.db.name = 'unsupported'
      if (fault === 'session') Reflect.deleteProperty(req.payload.db.sessions, 'owned')
      if (fault === 'capability') Reflect.deleteProperty(req.payload.db.sessions.owned.db, 'execute')
      if (fault === 'result') execute.mockResolvedValue({ rows: [] })
      if (fault === 'zero') execute.mockResolvedValue({ rows: [{ statement_timeout: '0', idle_timeout: '0' }] })
      if (fault === 'wrong-value')
        execute.mockResolvedValue({ rows: [{ statement_timeout: '1s', idle_timeout: '1s' }] })
      try {
        await expect(deadline.beforeOperation(asRequest, 'owned')).rejects.toMatchObject({
          code: 'storage-unavailable',
        })
        expect(execute).toHaveBeenCalledTimes(['adapter', 'session', 'capability'].includes(fault) ? 0 : 1)
      } finally {
        deadline.dispose()
      }
    },
  )

  it('accepts PostgreSQL-normalized control units', async () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
    const deadline = new WebhookDeadline()
    const { execute, asRequest } = fixture()
    clock.mockReturnValue(900)
    execute.mockResolvedValue({ rows: [{ statement_timeout: '4s', idle_timeout: '4s' }] })
    try {
      await expect(deadline.beforeOperation(asRequest, 'owned')).resolves.toBeUndefined()
    } finally {
      deadline.dispose()
    }
  })

  it('bounds cleanup waiting without converting unfinished rollback into success', async () => {
    vi.useFakeTimers()
    const deadline = new WebhookDeadline()
    const cleanup = deadline.cleanup(new Promise<void>(() => {}))
    const failed = expect(cleanup).rejects.toMatchObject({ code: 'storage-unavailable' })
    await vi.advanceTimersByTimeAsync(100)
    await failed
    deadline.dispose()
  })
})

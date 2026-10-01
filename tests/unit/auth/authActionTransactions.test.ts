import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import { bindAuthActions } from '@/auth/actions/lifecycle'

vi.mock('payload', async (load) => ({
  ...(await load<typeof import('payload')>()),
  createLocalReq: async ({ context, req }: { context: object; req: object }, payload: Payload) => ({
    ...req,
    context,
    payload,
    user: null,
  }),
}))

const require = createRequire(import.meta.url)
const postgresRequire = createRequire(require.resolve('@payloadcms/db-postgres'))
const transactions = path.join(path.dirname(postgresRequire.resolve('@payloadcms/drizzle')), 'transactions')
type Controls = Pick<Payload['db'], 'beginTransaction' | 'commitTransaction' | 'rollbackTransaction'>
async function control<Name extends keyof Controls>(name: Name) {
  const installed = (await import(pathToFileURL(path.join(transactions, `${name}.js`)).href)) as Record<
    Name,
    Controls[Name]
  >
  return installed[name]
}

describe('AuthAction owner over installed transaction controls', () => {
  it.each([false, true])(
    'preserves native rollback failure and stops retries (rollbackFails=%s)',
    async (rollbackFails) => {
      const original = Object.assign(new Error('synthetic command serialization failure'), { code: '40001' })
      const rollbackFailure = new Error('synthetic rollback transport failure')
      const adapter = {
        initializing: Promise.resolve(),
        sessions: {},
        payload: { logger: { error() {} } },
        drizzle: {
          transaction: async (work: (transaction: object) => Promise<void>) => {
            await Promise.resolve() // A real driver acquires its session before invoking the callback.
            try {
              await work({})
            } catch (signal) {
              throw rollbackFails ? rollbackFailure : signal
            }
          },
        },
      }
      const begin = await control('beginTransaction')
      const commit = await control('commitTransaction')
      const rollback = await control('rollbackTransaction')
      const create = vi.fn().mockRejectedValue(original)
      const payload = {
        create,
        db: {
          beginTransaction: begin.bind(adapter),
          commitTransaction: commit.bind(adapter),
          rollbackTransaction: rollback.bind(adapter),
        },
      } as unknown as Payload
      const req = { payload, context: {} } as PayloadRequest
      const result = bindAuthActions(req, { environment: 'test' }).create({ actionType: 'patient-verification' })
      if (rollbackFails) {
        await expect(result).rejects.toMatchObject({ errors: [original, rollbackFailure] })
        expect(create).toHaveBeenCalledTimes(1)
      } else {
        await expect(result).rejects.toBe(original)
        expect(create).toHaveBeenCalledTimes(3)
      }
    },
  )
})

import { afterAll, beforeAll, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { runBaselineSeeds } from '@/endpoints/seed/baseline'
import { deriveDatabaseConfig } from '../../scripts/test-database-harness.mjs'

let payload: Payload | undefined
afterAll(async () => {
  await payload?.destroy()
})

let failures: unknown[]
beforeAll(async () => {
  if (process.env.NODE_ENV !== 'test' || process.env.INTEGRATION_RUN_STAGE !== 'seed')
    throw new Error('Integration seed preparation requires the isolated test runner.')
  const target = deriveDatabaseConfig(process.env.DATABASE_URI)
  if (!target.targetDatabaseName.endsWith('_template_baseline'))
    throw new Error('Integration seed preparation requires a local baseline template.')
  payload = await getPayload({ config })
  const result = await runBaselineSeeds(payload)
  failures = result.failures
})

it('prepares the integration baseline without seed failures', async () => {
  expect(failures).toEqual([])
  for (const collection of ['countries', 'cities', 'medical-specialties', 'treatments'] as const)
    expect((await payload!.count({ collection, overrideAccess: true })).totalDocs).toBeGreaterThan(0)
})

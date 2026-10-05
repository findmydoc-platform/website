import { afterAll, beforeAll, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { runBaselineSeeds } from '@/endpoints/seed/baseline'
import { deriveDatabaseConfig } from '../../scripts/test-database-harness.mjs'

let payload: Payload
beforeAll(async () => {
  if (process.env.CI_DB_SEED_ACTIVE !== '1' || process.env.NODE_ENV !== 'test')
    throw new Error('Template seed coverage requires the explicit test experiment.')
  const { targetDatabaseName } = deriveDatabaseConfig(process.env.DATABASE_URI)
  if (!targetDatabaseName.endsWith('_template_baseline'))
    throw new Error('Template seed coverage requires an isolated baseline template.')
  payload = await getPayload({ config })
})
afterAll(async () => {
  if (payload) await payload.destroy()
})

// Explicit diagnostic include only: normal integration discovery does not run this template builder.
it('prepares complete baseline data without seed failures', async () => {
  const result = await runBaselineSeeds(payload)
  expect(result.failures).toEqual([])
  for (const collection of ['countries', 'cities', 'medical-specialties', 'treatments'] as const) {
    expect((await payload.count({ collection, overrideAccess: true })).totalDocs).toBeGreaterThan(0)
  }
}, 120_000)

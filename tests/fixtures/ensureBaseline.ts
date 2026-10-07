import type { Payload } from 'payload'
import { runBaselineSeeds } from '@/endpoints/seed/baseline'
import { assertIntegrationBaseline } from '../../scripts/test-database-harness.mjs'

let baselineSeeded = false

/**
 * Ensures baseline seeds are run only once per test process.
 * Returns the result of seeding or cached result if already run.
 */
export async function ensureBaseline(payload: Payload) {
  if (baselineSeeded) return
  if (process.env.INTEGRATION_BASELINE_COPY === '1') {
    await assertIntegrationBaseline()
    baselineSeeded = true
    return
  }
  await runBaselineSeeds(payload)
  baselineSeeded = true
}

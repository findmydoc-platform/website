import type { Payload } from 'payload'
import { runBaselineSeeds } from '@/endpoints/seed/baseline'

let baselineSeeded = false

/**
 * Ensures baseline seeds are run only once per test process.
 * Returns the result of seeding or cached result if already run.
 */
export async function ensureBaseline(payload: Payload) {
  if (baselineSeeded) return
  await runBaselineSeeds(payload)
  baselineSeeded = true
}

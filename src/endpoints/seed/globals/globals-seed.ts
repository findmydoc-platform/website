import type { Payload } from 'payload'

import { importGlobals } from '../utils/import-globals'

/**
 * Seed baseline globals deterministically.
 * @returns counts from the generic globals importer.
 */
export async function seedGlobalsBaseline(payload: Payload): Promise<{ created: number; updated: number }> {
  payload.logger.info('— Seeding baseline globals...')

  const result = await importGlobals(payload)

  payload.logger.info('— Finished seeding baseline globals.')
  return { created: result.created, updated: result.updated }
}

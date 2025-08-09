import type { Payload, PayloadRequest } from 'payload'
import { runBaselineSeeds, type SeedResult as BaselineSeedResult } from './baseline/index'
import { runDemoSeeds, type SeedResult as DemoSeedResult } from './demo/index'

// LEGACY NOTICE:
// This file previously performed a fully destructive reset + demo dataset load.
// That behavior has been deprecated. We now separate immutable baseline reference data
// (idempotent, safe for all environments) from optional demo sample data.
// The exported `seed` function will run baseline seeds always, and demo seeds ONLY
// if explicitly requested via `req.query.demo === 'true'`.
// No collections are deleted here to ensure safety in non-dev environments.

// Next.js revalidation errors are normal when seeding the database without a server running
// i.e. running `yarn seed` locally instead of using the admin UI within an active app
// The app is not running to revalidate the pages and so the API routes are not available
// These error messages can be ignored: `Error hitting revalidate route for...`
export const seed = async ({ payload, req }: { payload: Payload; req: PayloadRequest }): Promise<void> => {
  payload.logger.info('Seeding (non-destructive) started...')

  const baseline: BaselineSeedResult[] = await runBaselineSeeds(payload)
  payload.logger.info(
    `Baseline seeds complete. Totals: created=${baseline.reduce(
      (a: number, b: BaselineSeedResult) => a + b.created,
      0,
    )}, updated=${baseline.reduce((a: number, b: BaselineSeedResult) => a + b.updated, 0)}`,
  )

  const runDemo = req?.query?.demo === 'true'
  if (runDemo) {
    payload.logger.warn('Demo seeding requested via ?demo=true')
    const demo: DemoSeedResult[] = await runDemoSeeds(payload)
    payload.logger.info(
      `Demo seeds complete. Totals: created=${demo.reduce((a: number, b: DemoSeedResult) => a + b.created, 0)}, updated=${demo.reduce(
        (a: number, b: DemoSeedResult) => a + b.updated,
        0,
      )}`,
    )
  } else {
    payload.logger.info('Skipping demo seeds (set ?demo=true to include sample content)')
  }

  payload.logger.info('Seeding finished.')
}

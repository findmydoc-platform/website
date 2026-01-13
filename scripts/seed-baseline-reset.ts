/**
 * Script: seed-baseline-reset
 * Usage: pnpm payload run scripts/seed-baseline-reset.ts
 * Resets baseline reference-data collections (non-production only) and then re-runs baseline seeds.
 */
import path from 'path'
import { config as dotenvConfig } from 'dotenv'
import payload from 'payload'
import { runBaselineSeeds } from '../src/endpoints/seed/baseline'

async function main() {
  process.stderr.write('[seed:baseline:reset] starting\n')
  process.env.PAYLOAD_LOG_LEVEL ||= 'info'

  dotenvConfig({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })
  dotenvConfig({ path: path.resolve(process.cwd(), '.env'), quiet: true })

  if (!process.env.PAYLOAD_SECRET && process.env.PAYLOAD_SECRET_KEY) {
    process.env.PAYLOAD_SECRET = process.env.PAYLOAD_SECRET_KEY
  }

  try {
    const { default: config } = await import('../src/payload.config')
    await payload.init({ config })

    const result = await runBaselineSeeds(payload, { reset: true })

    const created = result.units.reduce((a, u) => a + u.created, 0)
    const updated = result.units.reduce((a, u) => a + u.updated, 0)

    console.log(
      `[seed:baseline:reset] units=${result.units.length} created=${created} updated=${updated} failures=${result.failures.length}`,
    )

    const [countries, cities, specialties, treatments] = await Promise.all([
      payload.count({ collection: 'countries', overrideAccess: true }),
      payload.count({ collection: 'cities', overrideAccess: true }),
      payload.count({ collection: 'medical-specialties', overrideAccess: true }),
      payload.count({ collection: 'treatments', overrideAccess: true }),
    ])

    console.log(
      `[seed:baseline:reset] counts countries=${countries.totalDocs} cities=${cities.totalDocs} medical-specialties=${specialties.totalDocs} treatments=${treatments.totalDocs}`,
    )

    if (result.failures.length > 0) {
      console.error('[seed:baseline:reset] failures:', result.failures)
      process.exitCode = 1
    }
  } finally {
    await payload.destroy().catch(() => undefined)

    const exitCode = process.exitCode ?? 0
    setTimeout(() => process.exit(exitCode), 250).unref()
  }
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})

/**
 * Script: seed-baseline
 * Usage: pnpm payload run scripts/seed-baseline.ts
 * Runs non-destructive baseline seeds (reference data only).
 */
import path from 'path'
import { config as dotenvConfig } from 'dotenv'
import payload from 'payload'
import { runBaselineSeeds } from '../src/endpoints/seed/baseline'

async function main() {
  process.stderr.write('[seed:baseline] starting\n')
  process.env.PAYLOAD_LOG_LEVEL ||= 'info'

  dotenvConfig({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })
  dotenvConfig({ path: path.resolve(process.cwd(), '.env'), quiet: true })

  // Back-compat: some local envs use PAYLOAD_SECRET_KEY.
  if (!process.env.PAYLOAD_SECRET && process.env.PAYLOAD_SECRET_KEY) {
    process.env.PAYLOAD_SECRET = process.env.PAYLOAD_SECRET_KEY
  }

  try {
    const { default: config } = await import('../src/payload.config')
    await payload.init({ config })

    const result = await runBaselineSeeds(payload)
    const created = result.units.reduce((a, u) => a + u.created, 0)
    const updated = result.units.reduce((a, u) => a + u.updated, 0)

    // Print deterministic output regardless of Payload logger config.
    console.log(
      `[seed:baseline] units=${result.units.length} created=${created} updated=${updated} failures=${result.failures.length}`,
    )

    const [countries, cities, specialties, treatments] = await Promise.all([
      payload.count({ collection: 'countries', overrideAccess: true }),
      payload.count({ collection: 'cities', overrideAccess: true }),
      payload.count({ collection: 'medical-specialties', overrideAccess: true }),
      payload.count({ collection: 'treatments', overrideAccess: true }),
    ])

    console.log(
      `[seed:baseline] counts countries=${countries.totalDocs} cities=${cities.totalDocs} medical-specialties=${specialties.totalDocs} treatments=${treatments.totalDocs}`,
    )

    if (result.failures.length > 0) {
      console.error('[seed:baseline] failures:', result.failures)
      process.exitCode = 1
    }
  } finally {
    // Ensure Payload shuts down cleanly so the process can exit.
    await payload.destroy().catch(() => undefined)

    // Some adapters/plugins can keep handles open; force-exit after cleanup.
    const exitCode = process.exitCode ?? 0
    setTimeout(() => process.exit(exitCode), 250).unref()
  }
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})

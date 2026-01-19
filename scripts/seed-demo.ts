/**
 * Script: seed-demo
 * Usage: pnpm payload run scripts/seed-demo.ts
 * Runs baseline + demo seeds (demo gated by query flag).
 */
import path from 'path'
import { config as dotenvConfig } from 'dotenv'
import payload from 'payload'
import { runBaselineSeeds } from '../src/endpoints/seed/baseline'
import { runDemoSeeds } from '../src/endpoints/seed/demo'

async function main() {
  process.stderr.write('[seed:demo] starting\n')
  process.env.PAYLOAD_LOG_LEVEL ||= 'info'

  dotenvConfig({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })
  dotenvConfig({ path: path.resolve(process.cwd(), '.env'), quiet: true })

  if (!process.env.PAYLOAD_SECRET && process.env.PAYLOAD_SECRET_KEY) {
    process.env.PAYLOAD_SECRET = process.env.PAYLOAD_SECRET_KEY
  }

  try {
    const { default: config } = await import('../src/payload.config')
    await payload.init({ config })

    await runBaselineSeeds(payload)
    const result = await runDemoSeeds(payload)
    const created = result.units.reduce((a, u) => a + u.created, 0)
    const updated = result.units.reduce((a, u) => a + u.updated, 0)

    console.log(
      `[seed:demo] units=${result.units.length} created=${created} updated=${updated} failures=${result.failures.length}`,
    )

    const [posts, clinics, doctors, reviews] = await Promise.all([
      payload.count({ collection: 'posts', overrideAccess: true }),
      payload.count({ collection: 'clinics', overrideAccess: true }),
      payload.count({ collection: 'doctors', overrideAccess: true }),
      payload.count({ collection: 'reviews', overrideAccess: true }),
    ])

    console.log(
      `[seed:demo] counts posts=${posts.totalDocs} clinics=${clinics.totalDocs} doctors=${doctors.totalDocs} reviews=${reviews.totalDocs}`,
    )

    if (result.failures.length > 0) {
      console.error('[seed:demo] failures:', result.failures)
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

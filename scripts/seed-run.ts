/**
 * Script: seed-run
 * Usage:
 *   pnpm seed:run -- --type <baseline|demo> [--runtime-env <production|preview|development|test>] [--reset]
 *
 * Runs baseline or demo seeds through a single, policy-aware entrypoint.
 * - Baseline: can run in all environments.
 * - Demo: blocked in production.
 * - Reset: blocked in production.
 */
import path from 'path'
import { fileURLToPath } from 'url'
import { config as dotenvConfig } from 'dotenv'
import payload from 'payload'
import { runBaselineSeeds } from '../src/endpoints/seed/baseline'
import { runDemoSeeds } from '../src/endpoints/seed/demo'
import { sumSeedUnits } from '../src/endpoints/seed/utils/summary'
import {
  assertSeedRunPolicy,
  isSeedRuntimeEnv,
  resolveSeedRuntimeEnv,
  type SeedRuntimeEnv,
  type SeedType,
} from '../src/endpoints/seed/utils/runtime'

export type SeedRunOptions = {
  type: SeedType
  reset: boolean
  runtimeEnv?: SeedRuntimeEnv
}

const parseBooleanLike = (value: string): boolean => {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1') return true
  if (normalized === 'false' || normalized === '0') return false
  throw new Error(`Invalid boolean value: ${value}`)
}

const stripArgSeparators = (argv: string[]): string[] => argv.filter((arg) => arg !== '--')

export function parseSeedRunArgs(argv: string[]): SeedRunOptions {
  const args = stripArgSeparators(argv)
  let type: SeedType | null = null
  let reset = false
  let runtimeEnv: SeedRuntimeEnv | undefined

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (!arg) continue

    if (arg === '--type') {
      const value = args[i + 1]
      if (!value) throw new Error('Missing value for --type')
      if (value !== 'baseline' && value !== 'demo') {
        throw new Error(`Invalid --type value: ${value}`)
      }
      type = value
      i += 1
      continue
    }

    if (arg.startsWith('--type=')) {
      const value = arg.slice('--type='.length)
      if (value !== 'baseline' && value !== 'demo') {
        throw new Error(`Invalid --type value: ${value}`)
      }
      type = value
      continue
    }

    if (arg === '--runtime-env') {
      const value = args[i + 1]
      if (!value) throw new Error('Missing value for --runtime-env')
      if (!isSeedRuntimeEnv(value)) {
        throw new Error(`Invalid --runtime-env value: ${value}`)
      }
      runtimeEnv = value
      i += 1
      continue
    }

    if (arg.startsWith('--runtime-env=')) {
      const value = arg.slice('--runtime-env='.length)
      if (!isSeedRuntimeEnv(value)) {
        throw new Error(`Invalid --runtime-env value: ${value}`)
      }
      runtimeEnv = value
      continue
    }

    if (arg === '--reset') {
      const next = args[i + 1]
      if (!next || next.startsWith('--')) {
        reset = true
      } else {
        reset = parseBooleanLike(next)
        i += 1
      }
      continue
    }

    if (arg.startsWith('--reset=')) {
      const value = arg.slice('--reset='.length)
      reset = parseBooleanLike(value)
      continue
    }

    throw new Error(`Unknown option: ${arg}`)
  }

  if (!type) {
    throw new Error('Missing required option --type <baseline|demo>')
  }

  return { type, reset, runtimeEnv }
}

export { assertSeedRunPolicy, resolveSeedRuntimeEnv, type SeedRuntimeEnv, type SeedType }

async function reportCounts(seedType: SeedType) {
  if (seedType === 'baseline') {
    const [countries, cities, specialties, treatments] = await Promise.all([
      payload.count({ collection: 'countries', overrideAccess: true }),
      payload.count({ collection: 'cities', overrideAccess: true }),
      payload.count({ collection: 'medical-specialties', overrideAccess: true }),
      payload.count({ collection: 'treatments', overrideAccess: true }),
    ])

    console.log(
      `[seed:run] baseline counts countries=${countries.totalDocs} cities=${cities.totalDocs} medical-specialties=${specialties.totalDocs} treatments=${treatments.totalDocs}`,
    )
    return
  }

  const [posts, clinics, doctors, reviews] = await Promise.all([
    payload.count({ collection: 'posts', overrideAccess: true }),
    payload.count({ collection: 'clinics', overrideAccess: true }),
    payload.count({ collection: 'doctors', overrideAccess: true }),
    payload.count({ collection: 'reviews', overrideAccess: true }),
  ])

  console.log(
    `[seed:run] demo counts posts=${posts.totalDocs} clinics=${clinics.totalDocs} doctors=${doctors.totalDocs} reviews=${reviews.totalDocs}`,
  )
}

export async function runSeedFromCliArgs(argv: string[], env: NodeJS.ProcessEnv = process.env) {
  const options = parseSeedRunArgs(argv)
  const runtimeEnv = resolveSeedRuntimeEnv(options.runtimeEnv, env)
  assertSeedRunPolicy({ runtimeEnv, type: options.type, reset: options.reset })

  process.stderr.write(
    `[seed:run] starting type=${options.type} reset=${String(options.reset)} runtimeEnv=${runtimeEnv}\n`,
  )

  process.env.PAYLOAD_LOG_LEVEL ||= 'info'
  ;(process.env as Record<string, string | undefined>).NODE_ENV ||= 'development'

  dotenvConfig({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })
  dotenvConfig({ path: path.resolve(process.cwd(), '.env'), quiet: true })

  if (!process.env.PAYLOAD_SECRET && process.env.PAYLOAD_SECRET_KEY) {
    process.env.PAYLOAD_SECRET = process.env.PAYLOAD_SECRET_KEY
  }

  const { default: config } = await import('../src/payload.config')
  await payload.init({ config })

  if (options.type === 'baseline') {
    const baseline = await runBaselineSeeds(payload, { reset: options.reset })
    const totals = sumSeedUnits(baseline.units)
    console.log(
      `[seed:run] baseline units=${baseline.units.length} created=${totals.created} updated=${totals.updated} failures=${baseline.failures.length}`,
    )

    await reportCounts('baseline')

    if (baseline.failures.length > 0) {
      console.error('[seed:run] baseline failures:', baseline.failures)
      process.exitCode = 1
    }

    return
  }

  const baseline = await runBaselineSeeds(payload)
  const baselineTotals = sumSeedUnits(baseline.units)
  console.log(
    `[seed:run] baseline precheck units=${baseline.units.length} created=${baselineTotals.created} updated=${baselineTotals.updated} failures=${baseline.failures.length}`,
  )

  if (baseline.failures.length > 0) {
    console.error('[seed:run] baseline precheck failures:', baseline.failures)
    process.exitCode = 1
    return
  }

  const demo = await runDemoSeeds(payload, { reset: options.reset })
  const demoTotals = sumSeedUnits(demo.units)
  console.log(
    `[seed:run] demo units=${demo.units.length} created=${demoTotals.created} updated=${demoTotals.updated} failures=${demo.failures.length}`,
  )

  await reportCounts('demo')

  if (demo.failures.length > 0) {
    console.error('[seed:run] demo failures:', demo.failures)
    process.exitCode = 1
  }
}

async function main() {
  try {
    await runSeedFromCliArgs(process.argv.slice(2), process.env)
  } finally {
    await payload.destroy().catch(() => undefined)

    const exitCode = process.exitCode ?? 0
    setTimeout(() => process.exit(exitCode), 250).unref()
  }
}

const currentFile = fileURLToPath(import.meta.url)
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : null

if (invokedFile && currentFile === invokedFile) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
}

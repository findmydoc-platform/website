/**
 * Script: seed-baseline
 * Usage: pnpm payload run scripts/seed-baseline.ts
 * Runs non-destructive baseline seeds (reference data only).
 */
import payload, { PayloadRequest } from 'payload'
import config from '../src/payload.config'
import { seed } from '../src/endpoints/seed'

async function main() {
  await payload.init({ config })
  await seed({ payload, req: { query: {} } as PayloadRequest })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

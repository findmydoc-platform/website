/**
 * Script: seed-demo
 * Usage: pnpm payload run scripts/seed-demo.ts
 * Runs baseline + demo seeds (demo gated by query flag).
 */
import payload, { PayloadRequest } from 'payload'
import config from '../src/payload.config'
import { seed } from '../src/endpoints/seed'

async function main() {
  await payload.init({ config })
  await seed({ payload, req: { query: { demo: 'true' } } as unknown as PayloadRequest })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

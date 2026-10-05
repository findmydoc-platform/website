import { appendFileSync } from 'node:fs'
import { loadLocalAndTestEnv } from '../../scripts/test-env.mjs'
import { copyBaselineWorkingDatabase, verifyBaselineCopyIsolation } from '../../scripts/test-database-harness.mjs'

// Runs before test module imports and Payload initialization, once per isolated file.
loadLocalAndTestEnv()
const started = process.hrtime.bigint()
await copyBaselineWorkingDatabase()
if (process.env.CI_DB_COPY_VERIFY_ISOLATION === '1') await verifyBaselineCopyIsolation()
if (process.env.CI_DB_COPY_REPORT) {
  appendFileSync(
    process.env.CI_DB_COPY_REPORT,
    JSON.stringify({
      durationMs: Number(process.hrtime.bigint() - started) / 1e6,
      status: 'passed',
      isolationVerified: process.env.CI_DB_COPY_VERIFY_ISOLATION === '1',
    }) + '\n',
  )
}

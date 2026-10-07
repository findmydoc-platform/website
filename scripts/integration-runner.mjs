import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { integrationBaselineDatabaseConfig, setupTestDatabase, teardownTestDatabase } from './test-database-harness.mjs'
import { loadLocalAndTestEnv } from './test-env.mjs'

const vitest = path.resolve('node_modules/vitest/vitest.mjs')
const runVitest = (args, env = process.env) => {
  const result = spawnSync(process.execPath, [vitest, ...args], { env, stdio: 'inherit' })
  if (result.error) throw result.error
  return result.status ?? 1
}

/** Native report replay cannot turn a failed suite into a successful job. */
export async function runIntegrationCoverage({ run = runVitest, reportsDirectory }) {
  const suiteCode = run(
    [
      'run',
      '--config',
      'vitest.integration.config.ts',
      '--project',
      'integration',
      '--coverage',
      '--reporter=verbose',
      '--reporter=blob',
      `--outputFile.blob=${path.join(reportsDirectory, 'suite.json')}`,
    ],
    { ...process.env, INTEGRATION_RUN_STAGE: 'suite' },
  )
  if (!['seed.json', 'suite.json'].every((name) => existsSync(path.join(reportsDirectory, name)))) {
    console.error('Integration coverage blobs are incomplete.')
    return 1
  }
  const mergeCode = run(
    [
      'run',
      '--config',
      'vitest.config.ts',
      '--project',
      'integration',
      '--coverage',
      '--merge-reports',
      reportsDirectory,
      '--reporter=verbose',
    ],
    { ...process.env, INTEGRATION_BASELINE_COPY: '', INTEGRATION_RUN_STAGE: '' },
  )
  return suiteCode || mergeCode
}

export async function runIntegrationTests() {
  loadLocalAndTestEnv()
  process.env.INTEGRATION_BASELINE_COPY = '1'
  integrationBaselineDatabaseConfig()
  mkdirSync('tmp', { recursive: true })
  const directory = mkdtempSync(path.resolve('tmp/integration-run-'))
  const reportsDirectory = path.join(directory, 'blobs')
  mkdirSync(reportsDirectory)
  process.env.INTEGRATION_COVERAGE_DIRECTORY = path.join(directory, 'coverage')
  try {
    await setupTestDatabase({
      templateKind: 'baseline',
      seedBaseline: (connectionString) => {
        const code = runVitest(
          [
            'run',
            '--config',
            'vitest.integration.config.ts',
            '--project',
            'integration',
            '--coverage',
            '--reporter=dot',
            '--reporter=blob',
            `--outputFile.blob=${path.join(reportsDirectory, 'seed.json')}`,
          ],
          { ...process.env, DATABASE_URI: connectionString, INTEGRATION_RUN_STAGE: 'seed' },
        )
        if (code !== 0) throw new Error('Integration baseline preparation failed.')
      },
    })
    return await runIntegrationCoverage({ reportsDirectory })
  } finally {
    try {
      await teardownTestDatabase({ strict: true })
    } finally {
      rmSync(directory, { recursive: true, force: true })
      delete process.env.INTEGRATION_COVERAGE_DIRECTORY
      delete process.env.INTEGRATION_BASELINE_COPY
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runIntegrationTests().then(
    (code) => {
      process.exitCode = code
    },
    () => {
      console.error('Integration runner failed; no successful acceptance is claimed.')
      process.exitCode = 1
    },
  )
}

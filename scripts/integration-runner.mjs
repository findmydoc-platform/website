import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

const collectionContract = 'tests/integration/contracts/collectionContractCoverage.test.ts'

/** Vitest filters are substrings; only an exact native inventory authorizes partial coverage. */
export function discoverIntegrationSelection(files) {
  const full = { mode: 'full', files: [] }
  if (!files.length || files.some((file) => typeof file !== 'string' || file.startsWith('-'))) return full
  const intended = [...new Set([...files, collectionContract])].sort()
  mkdirSync('tmp', { recursive: true })
  const directory = mkdtempSync(path.resolve('tmp/integration-discovery-'))
  const inventory = path.join(directory, 'files.json')
  try {
    const result = runVitest([
      'list',
      '--config',
      'vitest.config.ts',
      '--project',
      'integration',
      '--filesOnly',
      `--json=${inventory}`,
      ...intended,
    ])
    if (result !== 0 || !existsSync(inventory)) return full
    const discovered = JSON.parse(readFileSync(inventory, 'utf8'))
    if (
      !Array.isArray(discovered) ||
      discovered.some((entry) => entry.projectName !== 'integration' || typeof entry.file !== 'string')
    )
      return full
    const actual = discovered
      .map((entry) => path.relative(process.cwd(), path.resolve(entry.file)).split(path.sep).join('/'))
      .sort()
    if (actual.length !== intended.length || actual.some((file, index) => file !== intended[index])) return full
    return { mode: 'partial', files: intended }
  } catch {
    return full
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

/**
 * Native report replay cannot turn a failed suite into a successful job.
 * @param {{ run?: typeof runVitest, reportsDirectory: string, selection?: { mode: string, files: string[] } }} options
 */
export async function runIntegrationCoverage({
  run = runVitest,
  reportsDirectory,
  selection = { mode: 'full', files: [] },
}) {
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
      ...selection.files,
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
    {
      ...process.env,
      INTEGRATION_BASELINE_COPY: '',
      INTEGRATION_RUN_STAGE: '',
      INTEGRATION_COVERAGE_MODE: selection.mode,
    },
  )
  return suiteCode || mergeCode
}

export async function runIntegrationTests(files = []) {
  loadLocalAndTestEnv()
  const selection = discoverIntegrationSelection(files)
  console.log(
    `Integration coverage mode: ${selection.mode}. ${selection.mode === 'partial' ? 'Incomplete suite coverage; global full-suite thresholds do not apply.' : 'Ordinary unfiltered full suite; unchanged global thresholds apply.'}`,
  )
  if (files.length && selection.mode === 'full')
    console.log('Native selection could not be confirmed; running the full suite.')
  if (selection.files.length) console.log(`Native integration files: ${JSON.stringify(selection.files)}`)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `coverage_mode=${selection.mode}\n`)
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `\n### Integration selection\n- Coverage mode: ${selection.mode}\n- Native selected files: ${JSON.stringify(selection.files)}\n- ${selection.mode === 'partial' ? 'Incomplete integration coverage; no full-suite compliance claimed.' : 'Unfiltered full suite with unchanged coverage thresholds.'}\n`,
    )
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
    const result = await runIntegrationCoverage({ reportsDirectory, selection })
    mkdirSync('coverage/integration', { recursive: true })
    writeFileSync('coverage/integration/scope.json', `${JSON.stringify(selection, null, 2)}\n`)
    return result
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
  runIntegrationTests(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code
    },
    () => {
      console.error('Integration runner failed; no successful acceptance is claimed.')
      process.exitCode = 1
    },
  )
}

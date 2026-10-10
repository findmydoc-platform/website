import { spawnSync } from 'node:child_process'
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
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

function parseIntegrationShard(value) {
  if (!value) return undefined
  const match = /^([1-4])\/([24])$/.exec(value)
  if (!match || Number(match[1]) > Number(match[2])) throw new Error('Invalid integration shard.')
  return { index: Number(match[1]), count: Number(match[2]) }
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
 * @param {{ run?: typeof runVitest, reportsDirectory: string, selection?: { mode: string, files: string[] }, shard?: { index: number, count: number }, shardArtifactsDirectory?: string, sourceRevision?: string }} options
 */
export async function runIntegrationCoverage({
  run = runVitest,
  reportsDirectory,
  selection = { mode: 'full', files: [] },
  shard,
  shardArtifactsDirectory = 'coverage/integration-shards',
  sourceRevision = process.env.GITHUB_SHA,
}) {
  if (shard && (selection.mode !== 'full' || selection.files.length))
    throw new Error('A full integration shard cannot apply selected file filters.')
  if (shard) mkdirSync(shardArtifactsDirectory, { recursive: true })
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
      ...(shard
        ? [
            `--shard=${shard.index}/${shard.count}`,
            '--reporter=json',
            `--outputFile.json=${path.resolve(shardArtifactsDirectory, `results-${shard.index}.json`)}`,
          ]
        : []),
      ...selection.files,
    ],
    { ...process.env, INTEGRATION_RUN_STAGE: 'suite' },
  )
  if (!['seed.json', 'suite.json'].every((name) => existsSync(path.join(reportsDirectory, name)))) {
    console.error('Integration coverage blobs are incomplete.')
    return 1
  }
  if (shard) {
    if (!sourceRevision) throw new Error('Integration shard source revision is missing.')
    copyFileSync(
      path.join(reportsDirectory, 'suite.json'),
      path.join(shardArtifactsDirectory, `suite-${shard.index}.json`),
    )
    if (shard.index === 1)
      copyFileSync(path.join(reportsDirectory, 'seed.json'), path.join(shardArtifactsDirectory, 'seed.json'))
    writeFileSync(
      path.join(shardArtifactsDirectory, `shard-${shard.index}.json`),
      `${JSON.stringify({ ...shard, sourceRevision })}\n`,
    )
    // Only the collector can assert full-suite coverage after all native reports arrive.
    return suiteCode
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
  const shard = parseIntegrationShard(process.env.INTEGRATION_SHARD)
  if (shard && files.length) throw new Error('Sharded integration cannot select test files.')
  if (shard && !process.env.GITHUB_SHA) throw new Error('Integration shard source revision is missing.')
  loadLocalAndTestEnv()
  const selection = discoverIntegrationSelection(files)
  if (shard)
    console.log(
      `Native integration shard ${shard.index}/${shard.count}; full coverage acceptance awaits the collector.`,
    )
  else
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
      `\n### Integration selection\n- Coverage mode: ${selection.mode}\n- Native selected files: ${JSON.stringify(selection.files)}\n- ${shard ? 'Native full-suite shard; complete coverage and thresholds are verified by the collector.' : selection.mode === 'partial' ? 'Incomplete integration coverage; no full-suite compliance claimed.' : 'Unfiltered full suite with unchanged coverage thresholds.'}\n`,
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
    const result = await runIntegrationCoverage({ reportsDirectory, selection, shard })
    if (!shard) {
      mkdirSync('coverage/integration', { recursive: true })
      writeFileSync('coverage/integration/scope.json', `${JSON.stringify(selection, null, 2)}\n`)
    }
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

/** Verify complete native discovery and successful shard results before full coverage replay. */
export async function mergeIntegrationShards({
  reportsDirectory = 'coverage/integration-shards',
  coverageDirectory = 'coverage/integration',
  count = 2,
  sourceRevision = process.env.GITHUB_SHA,
  run = runVitest,
} = {}) {
  if (![2, 4].includes(count) || !sourceRevision) throw new Error('Integration shard context is missing.')
  mkdirSync('tmp', { recursive: true })
  const directory = mkdtempSync(path.resolve('tmp/integration-shard-merge-'))
  const inventory = path.join(directory, 'inventory.json')
  const blobs = path.join(directory, 'blobs')
  mkdirSync(blobs)
  try {
    const discoveryCode = run([
      'list',
      '--config',
      'vitest.config.ts',
      '--project',
      'integration',
      '--filesOnly',
      `--json=${inventory}`,
    ])
    if (discoveryCode !== 0 || !existsSync(inventory)) throw new Error('Full integration discovery failed.')
    const discovered = JSON.parse(readFileSync(inventory, 'utf8'))
    if (
      !Array.isArray(discovered) ||
      !discovered.length ||
      discovered.some((entry) => entry.projectName !== 'integration' || typeof entry.file !== 'string')
    )
      throw new Error('Full integration inventory is invalid.')
    const normalize = (file) => path.relative(process.cwd(), path.resolve(file)).split(path.sep).join('/')
    const expected = discovered.map((entry) => normalize(entry.file)).sort()
    if (new Set(expected).size !== expected.length) throw new Error('Full integration discovery has duplicates.')
    const actual = []
    let cases = 0
    for (let index = 1; index <= count; index++) {
      const metadata = JSON.parse(readFileSync(path.join(reportsDirectory, `shard-${index}.json`), 'utf8'))
      if (metadata.index !== index || metadata.count !== count || metadata.sourceRevision !== sourceRevision)
        throw new Error('Integration shard source or identity differs.')
      const result = JSON.parse(readFileSync(path.join(reportsDirectory, `results-${index}.json`), 'utf8'))
      if (
        result.success !== true ||
        result.numFailedTests !== 0 ||
        result.numPendingTests !== 0 ||
        result.numTodoTests !== 0 ||
        !Array.isArray(result.testResults) ||
        !result.testResults.length
      )
        throw new Error('Integration shard did not execute every case successfully.')
      for (const file of result.testResults) {
        if (
          typeof file.name !== 'string' ||
          file.status !== 'passed' ||
          !Array.isArray(file.assertionResults) ||
          !file.assertionResults.length ||
          file.assertionResults.some((test) => test.status !== 'passed')
        )
          throw new Error('Integration shard has failed or omitted cases.')
        actual.push(normalize(file.name))
        cases += file.assertionResults.length
      }
      copyFileSync(path.join(reportsDirectory, `suite-${index}.json`), path.join(blobs, `suite-${index}.json`))
    }
    actual.sort()
    if (actual.length !== expected.length || actual.some((file, index) => file !== expected[index]))
      throw new Error('Integration shards do not match the complete native inventory exactly once.')
    copyFileSync(path.join(reportsDirectory, 'seed.json'), path.join(blobs, 'seed.json'))
    const mergeCode = run(
      [
        'run',
        '--config',
        'vitest.config.ts',
        '--project',
        'integration',
        '--coverage',
        '--merge-reports',
        blobs,
        '--reporter=verbose',
      ],
      { ...process.env, INTEGRATION_BASELINE_COPY: '', INTEGRATION_RUN_STAGE: '', INTEGRATION_COVERAGE_MODE: 'full' },
    )
    if (mergeCode !== 0) return mergeCode
    mkdirSync(coverageDirectory, { recursive: true })
    writeFileSync(
      path.join(coverageDirectory, 'scope.json'),
      `${JSON.stringify({ mode: 'full', files: [], shards: count, sourceRevision, suiteFiles: actual.length, suiteCases: cases }, null, 2)}\n`,
    )
    console.log(
      `Complete integration shards: ${actual.length} suite files, ${cases} cases; one native seed report replayed.`,
    )
    return 0
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const execution =
    process.argv[2] === '--merge-shards'
      ? mergeIntegrationShards({ count: Number(process.argv[3] || 2) })
      : runIntegrationTests(process.argv.slice(2))
  execution.then(
    (code) => {
      process.exitCode = code
    },
    () => {
      console.error('Integration runner failed; no successful acceptance is claimed.')
      process.exitCode = 1
    },
  )
}

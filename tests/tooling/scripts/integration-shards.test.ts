import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { mergeIntegrationShards, runIntegrationCoverage } from '../../../scripts/integration-runner.mjs'

it('accepts complete native shards and rejects missing, duplicated, skipped or differently sourced results before replay', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'integration-native-shards-'))
  const config = path.join(directory, 'vitest.config.mjs')
  const artifacts = path.join(directory, 'artifacts')
  const coverageDirectory = path.join(directory, 'coverage')
  const vitest = path.resolve('node_modules/vitest/vitest.mjs')
  const replayCalls: string[][] = []
  writeFileSync(
    path.join(directory, 'subject.mjs'),
    'export function branch(value) { return value ? 1 : 2 }\nexport function seedBranch(value) { return value ? 3 : 4 }\n',
  )
  writeFileSync(
    path.join(directory, 'setup.mjs'),
    "export default function () { if (process.env.FIXTURE_STAGE === 'merge') throw new Error('Replay must not initialize test services') }\n",
  )
  writeFileSync(
    path.join(directory, 'seed.test.ts'),
    "import { expect, it } from 'vitest'; import { seedBranch } from './subject.mjs'; it('baseline seed coverage', () => { expect(seedBranch(true)).toBe(3); expect(seedBranch(false)).toBe(4) })\n",
  )
  writeFileSync(
    path.join(directory, 'suite-a.test.ts'),
    "import { expect, it } from 'vitest'; import { branch } from './subject.mjs'; it('first suite case', () => expect(branch(false)).toBe(2))\n",
  )
  writeFileSync(
    path.join(directory, 'suite-b.test.ts'),
    "import { expect, it } from 'vitest'; import { branch } from './subject.mjs'; it('second suite case', () => expect(branch(true)).toBe(1))\n",
  )
  writeFileSync(
    config,
    `export default { test: {
    projects: [{ test: { name: 'integration', fileParallelism: false, globalSetup: 'setup.mjs', include: [process.env.FIXTURE_STAGE === 'seed' ? 'seed.test.ts' : 'suite-*.test.ts'] } }],
    coverage: { provider: 'v8', include: ['subject.mjs'], reporter: ['json-summary'], reportsDirectory: ${JSON.stringify(coverageDirectory)},
      thresholds: process.env.FIXTURE_STAGE === 'merge' ? { lines: 100, branches: 100, functions: 100, statements: 100 } : undefined }
  } }`,
  )
  const execute = (args: string[], stage: string, env = process.env) => {
    const command = [...args]
    command[command.indexOf('--config') + 1] = config
    if (command.includes('--merge-reports')) replayCalls.push(command)
    const result = spawnSync(process.execPath, [vitest, ...command], {
      cwd: directory,
      env: { ...env, FIXTURE_STAGE: stage },
      encoding: 'utf8',
    })
    if (result.status !== 0 && stage !== 'suite')
      throw new Error(`Native fixture ${stage} failed: ${result.stderr}\n${result.stdout}`)
    return result.status ?? 1
  }
  const run = (args: string[], env = process.env) =>
    execute(args, args.includes('--merge-reports') ? 'merge' : 'suite', env)
  const collect = () =>
    mergeIntegrationShards({
      reportsDirectory: artifacts,
      count: 2,
      sourceRevision: 'fixture-source',
      coverageDirectory,
      run,
    })
  try {
    for (const index of [1, 2]) {
      const blobs = path.join(directory, `blobs-${index}`)
      mkdirSync(blobs)
      execute(
        [
          'run',
          '--config',
          config,
          '--project',
          'integration',
          '--coverage',
          '--reporter=blob',
          `--outputFile.blob=${path.join(blobs, 'seed.json')}`,
        ],
        'seed',
      )
      expect(
        await runIntegrationCoverage({
          reportsDirectory: blobs,
          shard: { index, count: 2 },
          shardArtifactsDirectory: artifacts,
          sourceRevision: 'fixture-source',
          run,
        }),
      ).toBe(0)
    }
    expect(await collect()).toBe(0)
    expect(replayCalls).toHaveLength(1)
    const coverage = JSON.parse(readFileSync(path.join(coverageDirectory, 'coverage-summary.json'), 'utf8'))
    expect(coverage.total.branches.pct).toBe(100)
    expect(JSON.parse(readFileSync(path.join(coverageDirectory, 'scope.json'), 'utf8'))).toMatchObject({
      mode: 'full',
      suiteFiles: 2,
      suiteCases: 2,
      shards: 2,
    })

    const resultsFile = path.join(artifacts, 'results-2.json')
    const originalResults = readFileSync(resultsFile, 'utf8')
    rmSync(resultsFile)
    await expect(collect()).rejects.toThrow()
    writeFileSync(resultsFile, originalResults)

    const result = JSON.parse(originalResults)
    const other = JSON.parse(readFileSync(path.join(artifacts, 'results-1.json'), 'utf8'))
    result.testResults[0].name = other.testResults[0].name
    writeFileSync(resultsFile, JSON.stringify(result))
    await expect(collect()).rejects.toThrow('complete native inventory exactly once')
    writeFileSync(resultsFile, originalResults)

    const skipped = JSON.parse(originalResults)
    skipped.testResults[0].assertionResults[0].status = 'pending'
    writeFileSync(resultsFile, JSON.stringify(skipped))
    await expect(collect()).rejects.toThrow('failed or omitted cases')
    writeFileSync(resultsFile, originalResults)

    writeFileSync(
      path.join(artifacts, 'shard-2.json'),
      JSON.stringify({ index: 2, count: 2, sourceRevision: 'different-source' }),
    )
    await expect(collect()).rejects.toThrow('source or identity differs')
    writeFileSync(
      path.join(artifacts, 'shard-2.json'),
      JSON.stringify({ index: 2, count: 2, sourceRevision: 'fixture-source' }),
    )
    for (const name of ['suite-a.test.ts', 'suite-b.test.ts'])
      writeFileSync(
        path.join(directory, name),
        "import { expect, it } from 'vitest'; it('actual failed shard case', () => expect(true).toBe(false))\n",
      )
    expect(
      await runIntegrationCoverage({
        reportsDirectory: path.join(directory, 'blobs-1'),
        shard: { index: 1, count: 2 },
        shardArtifactsDirectory: artifacts,
        sourceRevision: 'fixture-source',
        run,
      }),
    ).toBe(1)
    await expect(collect()).rejects.toThrow('did not execute every case successfully')
    expect(replayCalls).toHaveLength(1)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}, 120_000)

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import * as runner from '../../../scripts/integration-runner.mjs'

it('keeps a failed integration suite failed even if its native coverage merge succeeds', async () => {
  const commands: string[][] = []
  const directory = mkdtempSync(path.join(tmpdir(), 'integration-status-contract-'))
  try {
    writeFileSync(path.join(directory, 'seed.json'), '{}')
    writeFileSync(path.join(directory, 'suite.json'), '{}')
    const result = await runner.runIntegrationCoverage({
      run: (args: string[]) => {
        commands.push(args)
        return args.includes('--merge-reports') ? 0 : 1
      },
      reportsDirectory: directory,
    })
    expect(result).toBe(1)
    expect(commands).toHaveLength(2)
    expect(commands[1]).toContain('--merge-reports')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

it('fails the job when native merged coverage fails, even if every suite test passed', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'integration-status-contract-'))
  try {
    writeFileSync(path.join(directory, 'seed.json'), '{}')
    writeFileSync(path.join(directory, 'suite.json'), '{}')
    const result = await runner.runIntegrationCoverage({
      run: (args: string[]) => (args.includes('--merge-reports') ? 1 : 0),
      reportsDirectory: directory,
    })
    expect(result).toBe(1)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

it('refuses successful acceptance when the seed or suite blob is missing', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'integration-missing-blob-contract-'))
  try {
    const result = await runner.runIntegrationCoverage({ run: () => 0, reportsDirectory: directory })
    expect(result).toBe(1)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

it.each(['complete', 'incomplete', 'partial'])(
  'checks actual %s seed and suite V8 coverage against unchanged final thresholds',
  async (coverageCase) => {
    const directory = mkdtempSync(path.join(tmpdir(), 'integration-coverage-contract-'))
    const vitest = path.resolve('node_modules/vitest/vitest.mjs')
    const config = path.join(directory, 'vitest.config.mjs')
    const reportsDirectory = path.join(directory, 'blobs')
    const output = path.join(directory, 'coverage')
    writeFileSync(
      path.join(directory, 'global-setup.mjs'),
      "export default function () { if (process.env.FIXTURE_STAGE === 'merge') throw new Error('Report replay must not initialize test services') }\n",
    )
    writeFileSync(path.join(directory, 'fixture.mjs'), 'export function branch(flag) { return flag ? 2 : 1 }\n')
    writeFileSync(
      path.join(directory, 'seed.test.ts'),
      "import { expect, it } from 'vitest'; import { branch } from './fixture.mjs'; it('seed branch', () => expect(branch(true)).toBe(2))\n",
    )
    writeFileSync(
      path.join(directory, 'suite.test.ts'),
      coverageCase === 'complete'
        ? "import { expect, it } from 'vitest'; import { branch } from './fixture.mjs'; it('suite branch', () => expect(branch(false)).toBe(1))\n"
        : "import { expect, it } from 'vitest'; import { branch } from './fixture.mjs'; it('suite branch', () => expect(branch(true)).toBe(2))\n",
    )
    writeFileSync(
      config,
      `export default { test: {
    projects: [{ test: { name: 'integration', globalSetup: 'global-setup.mjs', include: [process.env.FIXTURE_STAGE === 'seed' ? 'seed.test.ts' : 'suite.test.ts'] } }],
    coverage: { provider: 'v8', include: ['fixture.mjs'], reportsDirectory: ${JSON.stringify(output)}, reporter: ['json-summary'],
      thresholds: process.env.FIXTURE_STAGE === 'merge' && process.env.INTEGRATION_COVERAGE_MODE !== 'partial' ? { lines: 100, statements: 100, functions: 100, branches: 100 } : undefined }
  } }`,
    )
    const execute = (args: string[], stage: string, env = process.env) => {
      const command = [...args]
      const configIndex = command.indexOf('--config')
      command[configIndex + 1] = config
      const result = spawnSync(process.execPath, [vitest, ...command], {
        cwd: directory,
        env: { ...env, FIXTURE_STAGE: stage },
        encoding: 'utf8',
      })
      if (result.status !== 0 && stage !== 'merge')
        throw new Error(`Synthetic native Vitest ${stage} failed: ${result.stderr}\n${result.stdout}`)
      return result.status ?? 1
    }
    try {
      execute(
        [
          'run',
          '--config',
          config,
          '--project',
          'integration',
          '--coverage',
          '--reporter=blob',
          `--outputFile.blob=${path.join(reportsDirectory, 'seed.json')}`,
        ],
        'seed',
      )
      const result = await runner.runIntegrationCoverage({
        reportsDirectory,
        run: (args: string[], env = process.env) =>
          execute(args, args.includes('--merge-reports') ? 'merge' : 'suite', env),
        selection: {
          mode: coverageCase === 'partial' ? 'partial' : 'full',
          files: coverageCase === 'partial' ? ['suite.test.ts'] : [],
        },
      })
      expect(result).toBe(coverageCase === 'incomplete' ? 1 : 0)
      const coverage = JSON.parse(readFileSync(path.join(output, 'coverage-summary.json'), 'utf8'))
      expect(coverage.total.branches.pct).toBe(coverageCase === 'complete' ? 100 : 50)
      expect(coverage.total.lines.pct).toBe(100)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  },
  30_000,
)

it('confirms real native discovery of selected cases and the collection contract', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'integration-discovery-contract-'))
  const inventory = path.join(directory, 'files.json')
  const collectionContract = 'tests/integration/contracts/collectionContractCoverage.test.ts'
  try {
    const result = spawnSync(
      process.execPath,
      [
        path.resolve('node_modules/vitest/vitest.mjs'),
        'list',
        '--config',
        'vitest.config.ts',
        '--project',
        'integration',
        '--filesOnly',
        `--json=${inventory}`,
      ],
      { encoding: 'utf8' },
    )
    expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0)
    const discovered: { projectName: string; file: string }[] = JSON.parse(readFileSync(inventory, 'utf8'))
    const files = discovered.map((entry) => path.relative(process.cwd(), entry.file).split(path.sep).join('/'))
    expect(files).toContain(collectionContract)
    const selectedCase = files.find((file) => file !== collectionContract)
    if (!selectedCase) throw new Error('Native integration inventory contains no ordinary test case')
    const selection = runner.discoverIntegrationSelection([selectedCase])
    expect(selection).toEqual({
      mode: 'partial',
      files: [collectionContract, selectedCase].sort(),
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}, 30_000)

it.each([[[]], [['tests/integration/missing.test.ts']], [['countries']], [['--passWithNoTests']]])(
  'falls back to the ordinary full suite for unreliable native file filters %j',
  (files) => {
    expect(runner.discoverIntegrationSelection(files)).toEqual({ mode: 'full', files: [] })
  },
  30_000,
)

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'

it('fails coverage merging when expected reports are absent', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'combined-coverage-contract-'))
  try {
    const result = spawnSync(
      process.execPath,
      [
        'scripts/coverage/merge-coverage.mjs',
        '--input-root',
        directory,
        '--output-root',
        path.join(directory, 'output'),
      ],
      { encoding: 'utf8' },
    )
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('No coverage-summary.json files found')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

it.each([{}, { total: { lines: { total: 1, covered: 1, skipped: 0, pct: 100 } } }])(
  'rejects an incomplete suite coverage report %j',
  (report) => {
    const directory = mkdtempSync(path.join(tmpdir(), 'combined-coverage-contract-'))
    try {
      writeFileSync(path.join(directory, 'coverage-summary.json'), JSON.stringify(report))
      const result = spawnSync(
        process.execPath,
        [
          'scripts/coverage/merge-coverage.mjs',
          '--input-root',
          directory,
          '--output-root',
          path.join(directory, 'output'),
        ],
        { encoding: 'utf8' },
      )
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('Incomplete coverage metrics')
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  },
)

it('fails when one expected suite report is missing even though other coverage exists', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'combined-coverage-contract-'))
  try {
    mkdirSync(path.join(directory, 'coverage-unit'))
    const metric = { total: 4, covered: 3, skipped: 0, pct: 75 }
    writeFileSync(
      path.join(directory, 'coverage-unit/coverage-summary.json'),
      JSON.stringify({ total: { lines: metric, statements: metric, functions: metric, branches: metric } }),
    )
    const result = spawnSync(
      process.execPath,
      [
        'scripts/coverage/merge-coverage.mjs',
        '--input-root',
        directory,
        '--output-root',
        path.join(directory, 'output'),
        '--expected-sources',
        'unit,storybook',
      ],
      { encoding: 'utf8' },
    )
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Missing expected coverage source: storybook')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

it('combines the expected suites without claiming coverage for an intentionally absent integration run', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'combined-coverage-contract-'))
  try {
    const metric = { total: 4, covered: 3, skipped: 0, pct: 75 }
    for (const source of ['unit', 'storybook']) {
      mkdirSync(path.join(directory, `coverage-${source}`))
      writeFileSync(
        path.join(directory, `coverage-${source}/coverage-summary.json`),
        JSON.stringify({ total: { lines: metric, statements: metric, functions: metric, branches: metric } }),
      )
    }
    const result = spawnSync(
      process.execPath,
      [
        'scripts/coverage/merge-coverage.mjs',
        '--input-root',
        directory,
        '--output-root',
        path.join(directory, 'output'),
        '--expected-sources',
        'unit,storybook',
      ],
      { encoding: 'utf8' },
    )
    expect(result.status).toBe(0)
    const summary = JSON.parse(readFileSync(path.join(directory, 'output/coverage-summary.json'), 'utf8'))
    expect(summary.total.lines).toEqual({ total: 8, covered: 6, skipped: 0, pct: 75 })
    expect(summary.sources.map((source: { name: string }) => source.name).sort()).toEqual(['storybook', 'unit'])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

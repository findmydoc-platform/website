import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parse } from 'yaml'
import {
  parsePnpmReporter,
  pinReactInputs,
  prepareLockChange,
  privateProcess,
  runDiagnostic,
  validateEnvironment,
  validateOptions,
} from '../../../scripts/ci-cache-pnpm.mjs'

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})
const progress = (status: string, extra = {}) =>
  JSON.stringify({ name: 'pnpm:progress', status, packageId: 'private-package', to: '/private/import', ...extra })
const log = (...statuses: string[]) => statuses.map((status) => progress(status)).join('\n')

function fixture() {
  mkdirSync('tmp', { recursive: true })
  const repositoryRoot = mkdtempSync(path.resolve('tmp/pnpm-worker-test-'))
  const runnerTemp = mkdtempSync(path.join(os.tmpdir(), 'pnpm-worker-test-'))
  directories.push(repositoryRoot, runnerTemp)
  writeFileSync(path.join(repositoryRoot, 'package.json'), '{"dependencies":{"react":"^19.3.0"}}\n')
  writeFileSync(
    path.join(repositoryRoot, 'pnpm-lock.yaml'),
    "lockfileVersion: '9.0'\nimporters:\n\n  .:\n    dependencies:\n      react:\n        specifier: ^19.3.0\n        version: 19.3.0\npackages:\n  react@19.3.0: {}\n",
  )
  const env = {
    ...process.env,
    CI_CACHE_EXPERIMENT: '1',
    GITHUB_ACTIONS: 'true',
    RUNNER_TEMP: runnerTemp,
    CI_CACHE_STORE: path.join(runnerTemp, 'ci-cache-store'),
  }
  const options = { variant: 'warm', round: 1, output: 'tmp/result' }
  return { repositoryRoot, env, options }
}

describe('pnpm reporter measurements', () => {
  it.each([
    [
      'hit',
      ['resolved', 'resolved', 'found_in_store', 'found_in_store', 'imported', 'imported'],
      { resolved: 2, reused: 2, downloaded: 0, added: 2 },
    ],
    [
      'fallback',
      ['resolved', 'resolved', 'found_in_store', 'fetched', 'imported', 'imported'],
      { resolved: 2, reused: 1, downloaded: 1, added: 2 },
    ],
    [
      'miss',
      ['resolved', 'resolved', 'fetched', 'fetched', 'imported', 'imported'],
      { resolved: 2, reused: 0, downloaded: 2, added: 2 },
    ],
    ['failure', ['resolved', 'fetched'], { resolved: 1, reused: 0, downloaded: 1, added: 0 }],
  ])('reports actual event counts for %s', (_scenario, statuses, counts) => {
    expect(parsePnpmReporter(log(...(statuses as string[])))).toEqual(counts)
  })
  it('ignores byte progress, lifecycle text, malformed records and unsupported statuses', () => {
    const raw = [
      progress('found_in_store'),
      '{invalid',
      'private secret',
      'null',
      JSON.stringify({ name: 'pnpm:fetching-progress', status: 'in_progress', downloaded: 999 }),
      progress('downloaded'),
      progress('added'),
      progress('fetched', { name: 'pnpm:lifecycle' }),
      progress('resolved', { packageId: null }),
      progress('imported', { to: null }),
    ].join('\n')
    expect(parsePnpmReporter(raw)).toEqual({ resolved: 0, reused: 1, downloaded: 0, added: 0 })
  })
  it('drains a real failing child without retaining private stdout or stderr', async () => {
    const source = `process.stdout.write(${JSON.stringify(progress('fetched'))}.slice(0, 15)); setTimeout(() => { process.stdout.write(${JSON.stringify(progress('fetched'))}.slice(15)); console.error('private token'); process.exitCode = 7 }, 10)`
    const result = await privateProcess(process.execPath, ['--eval', source])
    expect(result).toMatchObject({ exitCode: 7, packages: { downloaded: 1 } })
    expect(result.durationMs).toBeGreaterThan(0)
    expect(JSON.stringify(result)).not.toMatch(/private|token/)
  })
  it('turns spawn failure into a failed measurement', async () => {
    expect(await privateProcess('nonexistent-pnpm-diagnostic-command', [])).toMatchObject({ exitCode: 1 })
  })
})

describe('pnpm experiment isolation', () => {
  it('requires explicit Actions experiment opt-in', () => {
    const { env } = fixture()
    for (const overrides of [
      { CI_CACHE_EXPERIMENT: '0' },
      { GITHUB_ACTIONS: 'false' },
      { RUNNER_TEMP: '' },
      { CI_CACHE_STORE: 'relative' },
      { CI_CACHE_STORE: env.RUNNER_TEMP },
      { CI_CACHE_STORE: path.join(env.RUNNER_TEMP + '-outside', 'store') },
    ]) {
      expect(() => validateEnvironment({ ...env, ...overrides })).toThrow()
    }
  })
  it('rejects store and output escapes through existing symlinks', () => {
    const { env, repositoryRoot, options } = fixture()
    symlinkSync(repositoryRoot, path.join(env.RUNNER_TEMP, 'escape'))
    expect(() => validateEnvironment({ ...env, CI_CACHE_STORE: path.join(env.RUNNER_TEMP, 'escape/store') })).toThrow(
      'below RUNNER_TEMP',
    )
    mkdirSync(path.join(repositoryRoot, 'tmp'))
    symlinkSync(env.RUNNER_TEMP, path.join(repositoryRoot, 'tmp/escape'))
    expect(() => validateOptions({ ...options, output: 'tmp/escape/output' }, repositoryRoot)).toThrow('below tmp')
    expect(() => validateOptions({ ...options, round: 4 }, repositoryRoot)).toThrow('round')
    expect(() => validateOptions({ ...options, variant: 'invalid' }, repositoryRoot)).toThrow('variant')
  })
  it.each(['baseline', 'populate', 'warm', 'warm-fallback'])(
    'installs %s with unchanged lifecycle and a dedicated store',
    async (variant) => {
      const { env, repositoryRoot, options } = fixture()
      mkdirSync(env.CI_CACHE_STORE)
      writeFileSync(path.join(env.CI_CACHE_STORE, 'package-data'), 'abc')
      const run = vi
        .fn()
        .mockResolvedValueOnce({ exitCode: 0 })
        .mockResolvedValueOnce({
          exitCode: 0,
          durationMs: 42,
          packages: { ...parsePnpmReporter(log('resolved', 'found_in_store', 'imported')), raw: 'private token' },
        })
      const result = await runDiagnostic({ ...options, variant }, { env, repositoryRoot, run })
      expect(run.mock.calls[0]?.[1]).toEqual([
        path.join(repositoryRoot, 'scripts/assert-email-template-package-access.mjs'),
      ])
      expect(run.mock.calls[1]?.[0]).toBe('pnpm')
      expect(run.mock.calls[1]?.[1]).toEqual([
        'install',
        '--store-dir',
        realpathSync(env.CI_CACHE_STORE),
        '--frozen-lockfile',
        '--strict-peer-dependencies',
        '--reporter',
        'ndjson',
      ])
      expect(result).toMatchObject({
        schemaVersion: 1,
        kind: 'pnpm',
        variant,
        success: true,
        phases: [{ name: 'install', durationMs: 42, exitCode: 0 }],
        storeBytes: 3,
        cleanupSucceeded: true,
        packages: { resolved: 1, reused: 1, downloaded: 0, added: 1 },
      })
      const artifact = readFileSync(path.join(repositoryRoot, options.output, 'result.json'), 'utf8')
      expect(JSON.parse(artifact)).toEqual(result)
      expect(artifact).not.toMatch(/private|token|package-data|RUNNER_TEMP|NODE_AUTH_TOKEN/)
      expect(readdirSync(path.join(repositoryRoot, options.output))).toEqual(['result.json'])
    },
  )
  it('stops before installation when package access fails', async () => {
    const { env, repositoryRoot, options } = fixture()
    const run = vi.fn().mockResolvedValue({ exitCode: 1 })
    const result = await runDiagnostic(options, { env, repositoryRoot, run })
    expect(run).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ success: false, phases: [], cleanupSucceeded: true })
  })
  it('keeps partial package counts on install failure', async () => {
    const { env, repositoryRoot, options } = fixture()
    const run = vi
      .fn()
      .mockResolvedValueOnce({ exitCode: 0 })
      .mockResolvedValueOnce({ exitCode: 9, durationMs: 50, packages: parsePnpmReporter(log('resolved', 'fetched')) })
    expect(await runDiagnostic(options, { env, repositoryRoot, run })).toMatchObject({
      success: false,
      phases: [{ name: 'install', exitCode: 9 }],
      packages: { resolved: 1, reused: 0, downloaded: 1, added: 0 },
      cleanupSucceeded: true,
    })
  })
})

describe('reversible React lock input sample', () => {
  it('pins the real importer and manifest while preserving all resolved package data', () => {
    const manifest = readFileSync('package.json')
    const lock = readFileSync('pnpm-lock.yaml')
    const changed = pinReactInputs(manifest, lock)
    const expectedManifest = JSON.parse(manifest.toString())
    expectedManifest.dependencies.react = expectedManifest.dependencies.react.slice(1)
    const expectedLock = parse(lock.toString())
    expectedLock.importers['.'].dependencies.react.specifier = expectedManifest.dependencies.react
    expect(JSON.parse(changed.manifest.toString())).toEqual(expectedManifest)
    expect(parse(changed.lock.toString())).toEqual(expectedLock)
    expect(changed.lock.equals(lock)).toBe(false)
  })
  it.each([0, 7])(
    'restores both inputs after install exit %s, retaining the measured lock digest',
    async (exitCode) => {
      const { env, repositoryRoot, options } = fixture()
      const manifest = readFileSync(path.join(repositoryRoot, 'package.json'))
      const lock = readFileSync(path.join(repositoryRoot, 'pnpm-lock.yaml'))
      prepareLockChange({ env, repositoryRoot })
      const measuredDigest = createHash('sha256')
        .update(readFileSync(path.join(repositoryRoot, 'pnpm-lock.yaml')))
        .digest('hex')
      expect(() => prepareLockChange({ env, repositoryRoot })).toThrow('already exists')
      const run = vi
        .fn()
        .mockResolvedValueOnce({ exitCode: 0 })
        .mockResolvedValueOnce({
          exitCode,
          durationMs: 10,
          packages: parsePnpmReporter(log('resolved', 'found_in_store')),
        })
      const result = await runDiagnostic({ ...options, variant: 'lock-change' }, { env, repositoryRoot, run })
      expect(result).toMatchObject({ success: exitCode === 0, lockDigest: measuredDigest, cleanupSucceeded: true })
      expect(readFileSync(path.join(repositoryRoot, 'package.json'))).toEqual(manifest)
      expect(readFileSync(path.join(repositoryRoot, 'pnpm-lock.yaml'))).toEqual(lock)
      expect(readdirSync(env.RUNNER_TEMP)).toEqual([])
    },
  )
  it('preserves concurrent edits instead of reporting successful cleanup', async () => {
    const { env, repositoryRoot, options } = fixture()
    prepareLockChange({ env, repositoryRoot })
    const run = vi
      .fn()
      .mockResolvedValueOnce({ exitCode: 0 })
      .mockImplementationOnce(async () => {
        writeFileSync(path.join(repositoryRoot, 'pnpm-lock.yaml'), 'concurrent edit')
        return { exitCode: 0, durationMs: 10, packages: parsePnpmReporter('') }
      })
    expect(await runDiagnostic({ ...options, variant: 'lock-change' }, { env, repositoryRoot, run })).toMatchObject({
      success: false,
      cleanupSucceeded: false,
    })
    expect(readFileSync(path.join(repositoryRoot, 'pnpm-lock.yaml'), 'utf8')).toBe('concurrent edit')
  })
})

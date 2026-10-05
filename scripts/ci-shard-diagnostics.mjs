import { spawn, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { performance } from 'node:perf_hooks'
import os from 'node:os'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const compose = ['compose', '-p', 'findmydoc-test', '-f', 'docker-compose.test.yml']
const reporter = path.join(root, 'scripts/ci-shard-reporter.mjs')
const worker = path.join(root, 'scripts/ci-shard-worker.mjs')
const zeroThresholds = { statements: 0, branches: 0, functions: 0, lines: 0 }

export function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name)
    return entry.isDirectory() ? filesUnder(filename) : [filename]
  })
}

export function pilotFiles(repositoryRoot = root) {
  const files = filesUnder(path.join(repositoryRoot, 'tests/integration'))
    .filter((filename) => filename.endsWith('.test.ts'))
    .map((filename) => path.relative(repositoryRoot, filename).split(path.sep).join('/'))
    .sort()
  const groups = [
    files.filter((filename) => filename.includes('.lifecycle.test.ts')),
    files.filter((filename) => filename.includes('/access/')),
    files.filter((filename) => /storage.*\.test\.ts$/.test(filename) && !filename.includes('/migrations/')),
    files.filter((filename) => filename.includes('/migrations/')),
  ]
  if (groups.some((group) => group.length < 2)) throw new Error('Each pilot category requires two files.')
  const selected = groups.flatMap((group) => group.slice(0, 2))
  if (new Set(selected).size !== 8) throw new Error('Pilot categories overlap.')
  return selected
}

export function makePlan({ stage = 'smoke', variant = 'pair', round = 1, shard = 1 } = {}) {
  if (!['smoke', 'pilot', 'full'].includes(stage) || !['pair', 'shard'].includes(variant))
    throw new Error('Invalid stage or variant.')
  if (![1, 2, 3].includes(round) || ![1, 2, 3, 4].includes(shard)) throw new Error('Invalid round or shard.')
  if (stage === 'smoke') return [{ variant: 'smoke', shard: 0 }]
  if (variant === 'shard') {
    if (stage !== 'full') throw new Error('Parallel shards require the full stage.')
    return [{ variant: 'C', shard }]
  }
  const serial = [{ variant: 'A', shard: 0 }]
  const split = [1, 2, 3, 4].map((index) => ({ variant: 'B', shard: index }))
  return round === 2 ? [...split, ...serial] : [...serial, ...split]
}

export function sourceFingerprint(repositoryRoot = root) {
  const files = execFileSync(
    'git',
    [
      'ls-files',
      '-z',
      'src',
      'tests/integration',
      'config/coverage',
      'package.json',
      'pnpm-lock.yaml',
      'vitest.config.ts',
      'docker-compose.test.yml',
    ],
    { cwd: repositoryRoot, encoding: 'utf8' },
  )
    .split('\0')
    .filter(Boolean)
    .sort()
  const hash = createHash('sha256')
  for (const filename of files)
    hash
      .update(filename)
      .update('\0')
      .update(readFileSync(path.join(repositoryRoot, filename)))
      .update('\0')
  return hash.digest('hex')
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv, timeoutMs?: number, signal?: AbortSignal, onLine?: (line: string, atMs: number) => void }} options
 */
export function measuredProcess(
  command,
  args,
  { cwd = root, env = process.env, timeoutMs = 45 * 60 * 1000, signal, onLine = () => {} } = {},
) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Measurement aborted.'))
    const startedAt = new Date().toISOString()
    const start = performance.now()
    const child = spawn(command, args, {
      cwd,
      env,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let timedOut = false
    let aborted = false
    let killTimer
    const stop = () => {
      try {
        process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGTERM')
      } catch {}
      killTimer = setTimeout(() => {
        try {
          process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGKILL')
        } catch {}
      }, 3000)
      killTimer.unref()
    }
    const abort = () => {
      aborted = true
      stop()
    }
    signal?.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(() => {
      timedOut = true
      stop()
    }, timeoutMs)
    for (const stream of [child.stdout, child.stderr]) {
      let pending = ''
      stream.setEncoding('utf8')
      stream.on('data', (chunk) => {
        pending += chunk
        const lines = pending.split('\n')
        pending = lines.pop().slice(-8192)
        for (const line of lines) onLine(line, performance.now() - start)
      })
    }
    const cleanup = () => {
      clearTimeout(timer)
      clearTimeout(killTimer)
      signal?.removeEventListener('abort', abort)
    }
    child.once('error', (error) => {
      cleanup()
      reject(error)
    })
    child.once('close', (code, exitSignal) => {
      cleanup()
      resolve({
        startedAt,
        endedAt: new Date().toISOString(),
        wallMs: performance.now() - start,
        code,
        signal: exitSignal,
        timedOut,
        aborted,
      })
    })
  })
}

const markers = [
  ['service-start', /Starting (?:test|local test)/],
  ['database-wait', /Waiting for test database/],
  ['storage-wait', /Waiting for test S3 storage/],
  ['template-build', /Building empty test DB template/],
  ['database-restore', /Restoring .* from the empty template/],
  ['database-ready', /Test database ready from empty template/],
  ['teardown', /Stopping test services while preserving/],
  ['teardown-end', /Test services stopped/],
]

function resourceSample() {
  const host = {
    at: new Date().toISOString(),
    hostLoad: os.loadavg(),
    freeMemoryBytes: os.freemem(),
    cpuTicks: os.cpus().reduce(
      (sum, cpu) => ({
        idle: sum.idle + cpu.times.idle,
        total: sum.total + Object.values(cpu.times).reduce((total, ticks) => total + ticks, 0),
      }),
      { idle: 0, total: 0 },
    ),
  }
  const docker = spawn(
    'docker',
    [
      'stats',
      '--no-stream',
      '--format',
      '{{.CPUPerc}}|{{.MemPerc}}',
      'findmydoc-postgres-test',
      'findmydoc-s3mock-test',
    ],
    { stdio: ['ignore', 'pipe', 'ignore'] },
  )
  let output = ''
  docker.stdout.on('data', (chunk) => {
    output += chunk
  })
  const timeout = setTimeout(() => docker.kill(), 4000)
  return new Promise((resolve) => {
    docker.once('error', () => {
      clearTimeout(timeout)
      resolve({ ...host, docker: [] })
    })
    docker.once('close', () => {
      clearTimeout(timeout)
      resolve({
        ...host,
        docker: output
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((line) => line.split('|').map((value) => Number.parseFloat(value))),
      })
    })
  })
}

export async function executePlan(plan, run, { before = async () => {}, after = async () => {} } = {}) {
  const results = []
  for (const item of plan) {
    try {
      await before(item)
      const result = await run(item)
      results.push(result)
      if (result.code !== 0 || result.timedOut || result.aborted)
        throw new Error('A measurement failed; subsequent measurements were stopped.')
    } finally {
      await after(item)
    }
  }
  return results
}

export function configSource(directory, smoke = false, merge = false) {
  if (smoke)
    return `export default { test: { include: [${JSON.stringify(path.join(directory, 'smoke.test.ts'))}], runner: ${JSON.stringify(worker)}, reporters: [${JSON.stringify(reporter)}] } }`
  return `import base from ${JSON.stringify(path.join(root, 'vitest.config.ts'))};
export default { ...base, cacheDir: ${JSON.stringify(path.join(directory, 'cache'))}, test: { ...base.test,
projects: base.test.projects.filter(p => p.test?.name === 'integration').map(p => ({ ...p, cacheDir: ${JSON.stringify(path.join(directory, 'cache'))}, test: { ...p.test, runner: ${JSON.stringify(worker)} } })),
reporters: ${merge ? "['dot']" : `[["blob", { outputFile: ${JSON.stringify(path.join(directory, 'blob.json'))} }], ${JSON.stringify(reporter)}]`},
coverage: { ...base.test.coverage, thresholds: ${JSON.stringify(zeroThresholds)}, reporter: ['json-summary', 'json'], reportsDirectory: ${JSON.stringify(path.join(directory, 'coverage'))} }
} }`
}

export async function runDiagnostic(options) {
  const plan = makePlan(options)
  if (!options.execute)
    return {
      plan,
      files: options.stage === 'pilot' ? pilotFiles() : 'all integration files',
      dryRun: true,
      valid: null,
    }
  const output = path.resolve(root, options.output)
  const allowed = path.join(root, 'tmp/ci-diagnostics') + path.sep
  if (!output.startsWith(allowed)) throw new Error('Output must be a child of tmp/ci-diagnostics.')
  if (existsSync(output)) throw new Error('Output already exists; measurements must not overwrite a previous run.')
  if (
    options.stage !== 'smoke' &&
    (process.env.GITHUB_ACTIONS !== 'true' ||
      process.env.RUNNER_OS !== 'Linux' ||
      process.platform !== 'linux' ||
      process.env.GITHUB_REPOSITORY !== 'findmydoc-platform/website' ||
      process.env.GITHUB_REF !== 'refs/heads/agent/ci-shard-diagnostics')
  )
    throw new Error('Integration measurements are restricted to the experiment branch on GitHub Linux runners.')
  mkdirSync(output, { recursive: true })
  const metadata = {
    valid: false,
    version: 1,
    stage: options.stage,
    round: options.round,
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    sourceFingerprint: sourceFingerprint(),
    node: process.version,
    cpus: os.cpus().map(({ model }) => model),
    totalMemoryBytes: os.totalmem(),
    results: [],
  }
  const controller = new AbortController()
  const abort = () => controller.abort()
  process.once('SIGINT', abort)
  process.once('SIGTERM', abort)
  try {
    await executePlan(
      plan,
      async (item) => {
        const directory = path.join(output, `${item.variant}-${item.shard}`)
        mkdirSync(directory)
        const config = path.join(directory, 'vitest.config.mjs')
        writeFileSync(config, configSource(directory, options.stage === 'smoke'))
        if (options.stage === 'smoke')
          writeFileSync(
            path.join(directory, 'smoke.test.ts'),
            "import { beforeAll, describe, expect, it } from 'vitest'; describe('reporter smoke', () => { beforeAll(() => { const until = performance.now() + 60; while (performance.now() < until) {} }); it.each([2, 3])('passes', value => expect(value + value).toBe(value * 2)); });",
          )
        const args = [path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', config]
        if (options.stage !== 'smoke') {
          args.push('--project', 'integration', '--coverage')
          if (item.shard) args.push('--shard', `${item.shard}/4`)
          if (options.stage === 'pilot') args.push(...pilotFiles())
        }
        const samples = []
        let sampling = false
        const interval =
          options.stage === 'smoke'
            ? null
            : setInterval(async () => {
                if (sampling) return
                sampling = true
                samples.push(await resourceSample())
                sampling = false
              }, 5000)
        const phases = []
        const timeFile = path.join(directory, 'process-time.txt')
        const linux = process.platform === 'linux'
        let result
        try {
          result = await measuredProcess(
            linux ? '/usr/bin/time' : process.execPath,
            linux ? ['--format=%U %S %M', '--output', timeFile, process.execPath, ...args] : args,
            {
              signal: controller.signal,
              timeoutMs: options.stage === 'full' && item.variant === 'A' ? 90 * 60 * 1000 : 45 * 60 * 1000,
              env: {
                ...process.env,
                NODE_ENV: 'test',
                NODE_OPTIONS: '--no-deprecation',
                TEST_DB_REBUILD_TEMPLATES: '1',
                CI_SHARD_REPORT: path.join(directory, 'metrics.json'),
                CI_SHARD_HOOKS: path.join(directory, 'hooks.jsonl'),
              },
              onLine: (line, atMs) => {
                for (const [phase, pattern] of markers) if (pattern.test(line)) phases.push({ phase, atMs })
              },
            },
          )
        } finally {
          if (interval) clearInterval(interval)
        }
        const cpu =
          linux && existsSync(timeFile)
            ? readFileSync(timeFile, 'utf8').trim().split('\n').at(-1).split(' ').map(Number)
            : []
        const record = {
          ...item,
          ...result,
          userCpuSeconds: cpu[0] ?? null,
          systemCpuSeconds: cpu[1] ?? null,
          maxRssKiB: cpu[2] ?? null,
          phases,
          samples,
        }
        metadata.results.push(record)
        writeFileSync(path.join(directory, 'process.json'), JSON.stringify(record, null, 2))
        console.log(`${item.variant}/${item.shard}: exit=${result.code}, elapsed=${Math.round(result.wallMs / 1000)}s`)
        if (result.code !== 0) rmSync(path.join(directory, 'blob.json'), { force: true })
        return record
      },
      {
        after: async (item) => {
          if (options.stage !== 'smoke') {
            const cleaned = await measuredProcess('docker', [...compose, 'down', '--volumes', '--remove-orphans'], {
              timeoutMs: 60000,
            })
            const record = metadata.results.at(-1)
            if (record && record.variant === item.variant && record.shard === item.shard) {
              record.cleanupMs = cleaned.wallMs
              writeFileSync(
                path.join(output, `${item.variant}-${item.shard}`, 'process.json'),
                JSON.stringify(record, null, 2),
              )
            }
            if (cleaned.code !== 0) throw new Error('Test service cleanup failed.')
          }
          rmSync(path.join(output, `${item.variant}-${item.shard}`, 'cache'), { recursive: true, force: true })
          rmSync(path.join(output, `${item.variant}-${item.shard}`, 'vitest.config.mjs'), { force: true })
          rmSync(path.join(output, `${item.variant}-${item.shard}`, 'smoke.test.ts'), { force: true })
        },
      },
    )
    if (options.variant === 'pair' && options.stage !== 'smoke') await mergeReports(output, 'B')
    if (options.variant === 'pair') {
      for (const item of plan) rmSync(path.join(output, `${item.variant}-${item.shard}`, 'blob.json'), { force: true })
    }
    metadata.valid = true
  } catch (error) {
    metadata.valid = false
    throw error
  } finally {
    writeFileSync(path.join(output, 'run.json'), JSON.stringify(metadata, null, 2))
    process.removeListener('SIGINT', abort)
    process.removeListener('SIGTERM', abort)
  }
  return metadata
}

export async function mergeReports(output, variant) {
  if (
    !['B', 'C'].includes(variant) ||
    !path.resolve(output).startsWith(path.join(root, 'tmp/ci-diagnostics') + path.sep)
  )
    throw new Error('Merge requires B or C and an experiment output directory.')
  const target = path.join(output, `${variant}-merged`)
  mkdirSync(target, { recursive: true })
  const blobs = path.join(target, 'blobs')
  mkdirSync(blobs)
  for (let shard = 1; shard <= 4; shard++) {
    const filename = filesUnder(output).find((filename) => filename.endsWith(`/${variant}-${shard}/blob.json`))
    if (!filename) throw new Error('A required shard blob is missing.')
    writeFileSync(path.join(blobs, `blob-${shard}.json`), readFileSync(filename))
  }
  const config = path.join(target, 'vitest.config.mjs')
  writeFileSync(config, configSource(target, false, true))
  const record = await measuredProcess(process.execPath, [
    path.join(root, 'node_modules/vitest/vitest.mjs'),
    'run',
    '--config',
    config,
    '--project',
    'integration',
    '--merge-reports',
    blobs,
    '--coverage',
  ])
  writeFileSync(path.join(target, 'process.json'), JSON.stringify(record, null, 2))
  rmSync(blobs, { recursive: true, force: true })
  rmSync(path.join(target, 'cache'), { recursive: true, force: true })
  rmSync(config, { force: true })
  if (record.code !== 0) throw new Error('Native Vitest report merge failed.')
  return record
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { values } = parseArgs({
    options: {
      stage: { type: 'string', default: 'smoke' },
      variant: { type: 'string', default: 'pair' },
      round: { type: 'string', default: '1' },
      shard: { type: 'string', default: '1' },
      output: { type: 'string', default: 'tmp/ci-diagnostics/preview' },
      execute: { type: 'boolean', default: false },
      merge: { type: 'string' },
    },
  })
  try {
    const options = { ...values, round: Number(values.round), shard: Number(values.shard) }
    const result = values.merge
      ? await mergeReports(path.resolve(values.output), values.merge)
      : await runDiagnostic(options)
    console.log(JSON.stringify(result.dryRun ? result : { valid: result.valid ?? result.code === 0 }, null, 2))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

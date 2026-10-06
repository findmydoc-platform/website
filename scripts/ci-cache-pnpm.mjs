import { spawn, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
const inside = (parent, child) => child.startsWith(parent + path.sep)

// Resolve existing ancestors too, so nonexistent children cannot escape through symlinks.
function canonical(filename) {
  if (existsSync(filename)) return realpathSync(filename)
  const parent = path.dirname(filename)
  if (parent === filename) throw new Error('Path cannot be resolved.')
  return path.join(canonical(parent), path.basename(filename))
}

export function validateEnvironment(env = process.env) {
  if (env.CI_CACHE_EXPERIMENT !== '1' || env.GITHUB_ACTIONS !== 'true')
    throw new Error('pnpm diagnostics require CI_CACHE_EXPERIMENT=1 and GITHUB_ACTIONS=true.')
  if (!env.RUNNER_TEMP || !path.isAbsolute(env.RUNNER_TEMP)) throw new Error('RUNNER_TEMP must be absolute.')
  const runnerTemp = realpathSync(env.RUNNER_TEMP)
  if (!env.CI_CACHE_STORE || !path.isAbsolute(env.CI_CACHE_STORE)) throw new Error('CI_CACHE_STORE must be absolute.')
  const store = canonical(env.CI_CACHE_STORE)
  if (!inside(runnerTemp, store)) throw new Error('CI_CACHE_STORE must be below RUNNER_TEMP.')
  return { runnerTemp, store }
}

export function validateOptions(options, repositoryRoot = root) {
  if (!['baseline', 'populate', 'warm', 'warm-fallback', 'lock-change'].includes(options.variant))
    throw new Error('Invalid variant.')
  if (![1, 2, 3].includes(options.round)) throw new Error('Invalid round.')
  if (typeof options.output !== 'string' || !options.output) throw new Error('Output is required.')
  const output = canonical(path.resolve(repositoryRoot, options.output))
  if (!inside(canonical(path.join(repositoryRoot, 'tmp')), output)) throw new Error('Output must be below tmp/.')
  return output
}

export function createProgressParser() {
  const packages = { resolved: 0, reused: 0, downloaded: 0, added: 0 }
  const statuses = { resolved: 'resolved', found_in_store: 'reused', fetched: 'downloaded', imported: 'added' }
  return {
    consume(line) {
      let event
      try {
        event = JSON.parse(line)
      } catch {
        return
      }
      if (event?.name !== 'pnpm:progress' || !Object.hasOwn(statuses, event.status)) return
      // pnpm's default reporter counts events, including peer-specific imports.
      const identity = event.status === 'imported' ? event.to : event.packageId
      if (typeof identity !== 'string' || !identity) return
      packages[statuses[event.status]]++
    },
    snapshot() {
      return { ...packages }
    },
  }
}

export function parsePnpmReporter(ndjson) {
  const parser = createProgressParser()
  for (const line of ndjson.split('\n')) parser.consume(line)
  return parser.snapshot()
}

// Child output stays in memory and is never inherited, written to disk, or returned.
export function privateProcess(command, args, { cwd = root, env = process.env } = {}) {
  return new Promise((resolve) => {
    const start = performance.now()
    const parser = createProgressParser()
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
    let pending = ''
    let dropping = false
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      for (const segment of chunk.split(/(?<=\n)/)) {
        if (!dropping) pending += segment
        if (pending.length > 1024 * 1024) {
          pending = ''
          dropping = true
        }
        if (segment.endsWith('\n')) {
          if (!dropping) parser.consume(pending)
          pending = ''
          dropping = false
        }
      }
    })
    child.stderr.on('data', () => {})
    child.once('error', () => {})
    child.once('close', (code) => {
      if (pending && !dropping) parser.consume(pending)
      pending = ''
      resolve({
        durationMs: performance.now() - start,
        exitCode: code !== null && code >= 0 ? code : 1,
        packages: parser.snapshot(),
      })
    })
  })
}

function lockBackup(repositoryRoot, runnerTemp) {
  return path.join(runnerTemp, `ci-cache-pnpm-lock-${digest(repositoryRoot).slice(0, 16)}`)
}
// Pin an existing importer input without resolving or changing installed versions.
export function pinReactInputs(manifestBytes, lockBytes) {
  const manifest = manifestBytes.toString('utf8')
  const specifier = JSON.parse(manifest).dependencies?.react
  if (!/^\^\d+\.\d+\.\d+$/.test(specifier ?? '')) throw new Error('React must use a stable caret specifier.')
  const exact = specifier.slice(1)
  const lock = lockBytes.toString('utf8')
  const importer = /(^importers:\r?\n(?:\r?\n)*  \.:\r?\n)([\s\S]*?)(?=^  [^ ]|^[^ \r\n]|$(?![\s\S]))/m.exec(lock)
  const dependencyBlock = importer && /^    dependencies:\r?\n([\s\S]*?)(?=^    [^ ]|$(?![\s\S]))/m.exec(importer[2])
  const react =
    dependencyBlock &&
    /^(      react:\r?\n        specifier: )([^\r\n]+)(\r?\n        version: )([^\r\n]+)/m.exec(dependencyBlock[1])
  if (!react || react[2] !== specifier || react[4] !== exact)
    throw new Error('React importer does not match the existing resolution.')
  const changedManifest = manifest.replace(/("react"\s*:\s*")\^[^"\r\n]+(")/, `$1${exact}$2`)
  const parsed = JSON.parse(changedManifest)
  const expected = JSON.parse(manifest)
  expected.dependencies.react = exact
  if (JSON.stringify(parsed) !== JSON.stringify(expected)) throw new Error('React manifest pin is ambiguous.')
  const changedDependencies = dependencyBlock[0].replace(react[0], react[1] + exact + react[3] + react[4])
  const changedImporter = importer[0].replace(dependencyBlock[0], changedDependencies)
  return { manifest: Buffer.from(changedManifest), lock: Buffer.from(lock.replace(importer[0], changedImporter)) }
}

export function prepareLockChange({ repositoryRoot = root, env = process.env } = {}) {
  const { runnerTemp } = validateEnvironment(env)
  const backup = lockBackup(repositoryRoot, runnerTemp)
  if (existsSync(backup)) throw new Error('Lock-change preparation already exists.')
  const manifest = readFileSync(path.join(repositoryRoot, 'package.json'))
  const lock = readFileSync(path.join(repositoryRoot, 'pnpm-lock.yaml'))
  const changed = pinReactInputs(manifest, lock)
  mkdirSync(backup, { mode: 0o700 })
  writeFileSync(path.join(backup, 'package.json'), manifest, { mode: 0o600, flag: 'wx' })
  writeFileSync(path.join(backup, 'pnpm-lock.yaml'), lock, { mode: 0o600, flag: 'wx' })
  writeFileSync(path.join(repositoryRoot, 'package.json'), changed.manifest)
  writeFileSync(path.join(repositoryRoot, 'pnpm-lock.yaml'), changed.lock)
}

function storeBytes(directory) {
  const stat = lstatSync(directory)
  // Count link metadata, including dangling links; never inspect targets outside the store.
  if (!stat.isDirectory()) return stat.size
  return readdirSync(directory).reduce((total, name) => total + storeBytes(path.join(directory, name)), 0)
}

function version(command, args, cwd, pattern) {
  const value = execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  if (!pattern.test(value)) throw new Error('Invalid diagnostic metadata.')
  return value
}

export async function runDiagnostic(options, { repositoryRoot = root, env = process.env, run = privateProcess } = {}) {
  const { runnerTemp, store } = validateEnvironment(env)
  const output = validateOptions(options, repositoryRoot)
  if (existsSync(output)) throw new Error('Output already exists.')
  const lock = path.join(repositoryRoot, 'pnpm-lock.yaml')
  const backup = lockBackup(repositoryRoot, runnerTemp)
  const manifestFile = path.join(repositoryRoot, 'package.json')
  const original =
    options.variant === 'lock-change'
      ? {
          manifest: readFileSync(path.join(backup, 'package.json')),
          lock: readFileSync(path.join(backup, 'pnpm-lock.yaml')),
        }
      : null
  const prepared = original && pinReactInputs(original.manifest, original.lock)
  const inputsMatch = () =>
    readFileSync(lock).equals(prepared.lock) && readFileSync(manifestFile).equals(prepared.manifest)
  if (original && !inputsMatch()) throw new Error('Prepared inputs differ from the React specifier pin.')
  const cpus = os.cpus()
  const result = {
    schemaVersion: 1,
    kind: 'pnpm',
    variant: options.variant,
    round: options.round,
    commit: null,
    node: process.version,
    pnpm: null,
    runner: {
      os: os.platform(),
      arch: os.arch(),
      cpuModel: cpus[0]?.model ?? 'unknown',
      cpuCount: cpus.length,
      memoryBytes: os.totalmem(),
    },
    success: false,
    // First failing stage only; exception text, paths and child output are excluded.
    failureReason: null,
    phases: [],
    packages: { resolved: 0, reused: 0, downloaded: 0, added: 0 },
    storeBytes: 0,
    lockDigest: digest(readFileSync(lock)),
    cleanupSucceeded: false,
  }
  let stage = 'metadata'
  try {
    result.commit = version('git', ['rev-parse', 'HEAD'], repositoryRoot, /^[a-f0-9]{40,64}$/)
    result.pnpm = version('pnpm', ['--version'], repositoryRoot, /^\d+\.\d+\.\d+$/)
    stage = 'access'
    const access = await run(
      process.execPath,
      [path.join(repositoryRoot, 'scripts/assert-email-template-package-access.mjs')],
      { cwd: repositoryRoot, env },
    )
    if (access.exitCode === 0) {
      stage = 'install'
      const install = await run(
        'pnpm',
        ['install', '--store-dir', store, '--frozen-lockfile', '--strict-peer-dependencies', '--reporter', 'ndjson'],
        { cwd: repositoryRoot, env },
      )
      result.phases.push({ name: 'install', durationMs: install.durationMs, exitCode: install.exitCode })
      if (install.exitCode !== 0) result.failureReason = 'install'
      stage = 'reporter'
      // Explicit allowlist: raw reporter records and package identities cannot reach the artifact.
      for (const key of Object.keys(result.packages)) {
        const count = install.packages[key]
        if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid package count.')
        result.packages[key] = count
      }
      result.success = install.exitCode === 0
    } else result.failureReason = 'access'
    stage = 'store-stat'
    result.storeBytes = existsSync(store) ? storeBytes(store) : 0
  } catch {
    result.failureReason ??= stage
    result.success = false
  } finally {
    try {
      if (original) {
        // Do not overwrite another process's edits to the shared lockfile.
        if (!inputsMatch()) throw new Error('Inputs changed during measurement.')
        writeFileSync(lock, original.lock)
        writeFileSync(manifestFile, original.manifest)
        rmSync(backup, { recursive: true })
      }
      result.cleanupSucceeded = true
    } catch {
      result.failureReason ??= 'cleanup'
      result.success = false
    }
    mkdirSync(output, { recursive: true })
    writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n')
  }
  return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({
      options: {
        variant: { type: 'string' },
        round: { type: 'string' },
        output: { type: 'string' },
        'prepare-lock-change': { type: 'boolean', default: false },
      },
    })
    if (values['prepare-lock-change']) prepareLockChange()
    else {
      const result = await runDiagnostic({
        variant: values.variant,
        round: Number(values.round),
        output: values.output,
      })
      process.exitCode = result.success && result.cleanupSucceeded ? 0 : 1
    }
  } catch {
    console.error('pnpm cache diagnostic failed; check experiment inputs and package access. Raw output withheld.')
    process.exitCode = 1
  }
}

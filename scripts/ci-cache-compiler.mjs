import { spawn } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { arch, cpus, homedir, platform, totalmem } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'
import { CACHE_REASONS, COMPILER_NAMES } from './ci-cache-webpack-plugin.mjs'

const CACHE_PATHS = ['webpack', 'swc']
const MARKER = 'CI compiler incremental metadata marker'
const MARKER_PATH = 'src/app/(frontend)/contact/page.tsx'

/** @typedef {{name: string, builtModules: number, cachedModules: number, totalModules: number, compilationMs: number, cacheVersionEqual: boolean | null, cacheInvalidationReasons: string[]}} CompilerMetrics */
/** @typedef {{label: string, exitCode: number, durationMs: number, compilers: CompilerMetrics[], phaseTimings: Record<string, number>, sourceMarkerVerified: boolean | null}} BuildResult */
/** @typedef {{schemaVersion: number, kind: string, mode: string, variant: string, round: number, commit: string, node: string, pnpm: string | null, runner: {os: string, arch: string, cpuModel: string, cpuCount: number, memoryBytes: number}, success: boolean, phases: Array<{name: string, durationMs: number, exitCode: number}>, builds: BuildResult[], cleanupSucceeded: boolean}} CompilerResult */

/** @returns {{mode: string, variant: string, round: number, output: string}} */
export function parseArgs(args) {
  const options = {}
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]
    const value = args[index + 1]
    if (!['--mode', '--variant', '--round', '--output'].includes(key) || !value || options[key.slice(2)]) {
      throw new Error('Invalid diagnostic arguments')
    }
    options[key.slice(2)] = value
  }
  if (!['diagnose', 'measure'].includes(options.mode)) throw new Error('Invalid mode')
  if (
    !['baseline', 'populate', 'warm', 'incremental'].includes(options.variant) &&
    !(options.mode === 'diagnose' && options.variant === 'diagnose')
  )
    throw new Error('Invalid variant')
  if (!['1', '2', '3'].includes(options.round)) throw new Error('Invalid round')
  if (!options.output?.startsWith('tmp/') || options.output.split('/').some((part) => ['..', '.', ''].includes(part))) {
    throw new Error('Output must be a directory below tmp')
  }
  return { ...options, round: Number(options.round) }
}

function within(parent, child) {
  const path = relative(parent, child)
  return path !== '' && !path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path)
}

async function noSymlinks(path) {
  let current = resolve(path)
  while (current !== dirname(current)) {
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error('Symlink path rejected')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    current = dirname(current)
  }
}

export async function assertEphemeralCI(env, cwd, output) {
  if (env.CI_CACHE_EXPERIMENT !== '1' || env.GITHUB_ACTIONS !== 'true' || env.RUNNER_ENVIRONMENT !== 'github-hosted') {
    throw new Error('Compiler cleanup requires opted-in ephemeral hosted CI')
  }
  if (!env.RUNNER_TEMP || !isAbsolute(env.RUNNER_TEMP) || !env.GITHUB_WORKSPACE) throw new Error('Missing CI paths')
  const workspace = await realpath(cwd)
  const temporary = await realpath(env.RUNNER_TEMP)
  if (
    workspace !== (await realpath(env.GITHUB_WORKSPACE)) ||
    temporary === dirname(temporary) ||
    temporary === homedir() ||
    temporary === workspace ||
    within(temporary, workspace) ||
    within(workspace, temporary) ||
    !within(join(workspace, 'tmp'), resolve(workspace, output))
  )
    throw new Error('Unsafe CI paths')
  await noSymlinks(join(workspace, '.next'))
  await noSymlinks(resolve(workspace, output))
  return { workspace, temporary }
}

export function stableServerActionsKey(secret, commit) {
  if (!secret || !/^[a-f0-9]{40,64}$/i.test(commit ?? '')) throw new Error('Missing secret or frozen commit')
  return createHmac('sha256', secret)
    .update(`findmydoc:ci-cache-compiler:server-actions:v1\0${commit}`)
    .digest('base64')
}

export function instrumentConfig(source) {
  const target = 'export default withPayload(nextConfig)'
  if (source.split(target).length !== 2) throw new Error('Unsupported Next config export')
  return `import { withCompilerDiagnostics } from './scripts/ci-cache-webpack-plugin.mjs'\n${source.replace(target, 'export default withCompilerDiagnostics(withPayload(nextConfig))')}`
}

export function incrementalSource(source) {
  const metadata = /export const metadata: Metadata = \{[\s\S]*?title: 'Contact',/
  if (!metadata.test(source) || source.includes(MARKER)) throw new Error('Metadata marker target changed')
  return source.replace(metadata, (match) => match.replace("title: 'Contact',", `title: 'Contact ${MARKER}',`))
}

export function parsePhaseTimings(log) {
  const timings = {}
  const patterns = {
    compileMs: /Compiled (?:successfully|with warnings) in ([\d.]+)(ms|s)/,
    typecheckMs: /(?:Finished TypeScript|Linting and checking validity of types).*?in ([\d.]+)(ms|s)/,
    pageDataMs: /Collecting page data.*?in ([\d.]+)(ms|s)/,
    staticGenerationMs: /Generating static pages.*?in ([\d.]+)(ms|s)/,
    finalizeMs: /Finalizing page optimization.*?in ([\d.]+)(ms|s)/,
  }
  const plain = log.replace(/\u001b\[[0-9;]*m/g, '')
  const starts = new Map()
  const start = (name, time) => {
    if (!starts.has(name)) starts.set(name, time)
  }
  const finish = (name, time) => {
    if (starts.has(name)) {
      timings[name] = Math.max(0, time - starts.get(name))
      starts.delete(name)
    }
  }
  for (const line of plain.split('\n')) {
    const stamp = line.match(/^\[ci-cache-ms:(\d+)\] (.*)$/)
    if (!stamp) continue
    const time = Number(stamp[1])
    const message = stamp[2]
    if (/Creating an optimized production build/.test(message)) start('compileMs', time)
    if (/Compiled (?:successfully|with warnings)/.test(message)) finish('compileMs', time)
    if (/Running TypeScript|Linting and checking validity of types/.test(message)) start('typecheckMs', time)
    if (/Finished TypeScript/.test(message)) {
      finish('typecheckMs', time)
      start('pageDataMs', time)
    }
    if (/Collecting page data/.test(message)) {
      finish('typecheckMs', time)
      start('pageDataMs', time)
    }
    if (/Generating static pages/.test(message)) {
      finish('pageDataMs', time)
      start('staticGenerationMs', time)
      const progress = message.match(/\((\d+)\/(\d+)\)/)
      if (progress && progress[1] === progress[2]) finish('staticGenerationMs', time)
    }
    if (/Collecting build traces|Finalizing page optimization/.test(message)) {
      finish('staticGenerationMs', time)
      start('finalizeMs', time)
    }
    if (/^> .* postbuild(?: |$)/.test(message)) {
      finish('finalizeMs', time)
      start('postbuildMs', time)
    }
    if (message === '[ci-cache-command-end]') {
      for (const name of [...starts.keys()]) finish(name, time)
    }
  }
  for (const [name, pattern] of Object.entries(patterns)) {
    const match = plain.match(pattern)
    if (match) timings[name] = Math.round(Number(match[1]) * (match[2] === 's' ? 1000 : 1))
  }
  return timings
}

/** @returns {CompilerMetrics} */
export function parseCompilerMetrics(value) {
  if (!COMPILER_NAMES.includes(value?.name)) throw new Error('Invalid compiler metrics')
  const result = { name: value.name }
  for (const field of ['builtModules', 'cachedModules', 'totalModules', 'compilationMs']) {
    if (!Number.isSafeInteger(value[field]) || value[field] < 0) throw new Error('Invalid compiler counter')
    result[field] = value[field]
  }
  if (value.builtModules > value.totalModules || value.cachedModules > value.totalModules)
    throw new Error('Impossible compiler counters')
  if (![null, true, false].includes(value.cacheVersionEqual)) throw new Error('Invalid version comparison')
  if (
    !Array.isArray(value.cacheInvalidationReasons) ||
    value.cacheInvalidationReasons.some((reason) => !CACHE_REASONS.includes(reason))
  ) {
    throw new Error('Invalid cache reason')
  }
  result.cacheVersionEqual = value.cacheVersionEqual
  result.cacheInvalidationReasons = [...new Set(value.cacheInvalidationReasons)].sort()
  return result
}

export function experimentSucceeded(options, builds) {
  const labels =
    options.mode === 'diagnose' ? ['cold', 'old-paths-restore', 'stable-cold', 'stable-warm'] : [options.variant]
  if (
    builds.length !== labels.length ||
    builds.some(
      (build, index) =>
        build.label !== labels[index] ||
        build.exitCode !== 0 ||
        build.compilers.length !== COMPILER_NAMES.length ||
        COMPILER_NAMES.some((name) => !build.compilers.some((compiler) => compiler.name === name)) ||
        ['client', 'server'].some(
          (name) => !build.compilers.some((compiler) => compiler.name === name && compiler.totalModules > 0),
        ),
    )
  )
    return false
  const warm =
    options.mode === 'diagnose' ? builds.at(-1) : ['warm', 'incremental'].includes(options.variant) ? builds[0] : null
  if (warm && !warm.compilers.some((compiler) => compiler.cachedModules > 0)) return false
  if (options.mode === 'measure' && options.variant === 'incremental') {
    return builds[0].sourceMarkerVerified === true && builds[0].compilers.some((compiler) => compiler.builtModules > 0)
  }
  return true
}

async function command(command, args, { cwd, env, logPath, signal }) {
  const log = createWriteStream(logPath, { mode: 0o600 })
  return new Promise((resolveResult) => {
    const started = performance.now()
    const child = spawn(command, args, {
      cwd,
      env,
      detached: platform() !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let spawnFailed = false
    let killTimer
    const kill = (name) => {
      try {
        if (platform() === 'win32') child.kill(name)
        else if (child.pid) process.kill(-child.pid, name)
      } catch {
        /* The process group may already have exited. */
      }
    }
    const abort = () => {
      kill('SIGTERM')
      killTimer = setTimeout(() => kill('SIGKILL'), 5000)
      killTimer.unref()
    }
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
    const stdout = createInterface({ input: child.stdout, crlfDelay: Infinity })
    const stderr = createInterface({ input: child.stderr, crlfDelay: Infinity })
    const capture = (line) => log.write(`[ci-cache-ms:${Math.round(performance.now() - started)}] ${line}\n`)
    stdout.on('line', capture)
    stderr.on('line', capture)
    child.once('error', () => {
      spawnFailed = true
    })
    child.once('close', (code) => {
      clearTimeout(killTimer)
      signal?.removeEventListener('abort', abort)
      capture('[ci-cache-command-end]')
      log.end(() => resolveResult(signal?.aborted ? 130 : spawnFailed ? 127 : (code ?? 1)))
    })
  })
}

async function exists(path) {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

async function copyCompilerCache(from, to) {
  await noSymlinks(from)
  await noSymlinks(to)
  let copied = false
  for (const name of CACHE_PATHS) {
    const source = join(from, name)
    await noSymlinks(source)
    if (await exists(source)) {
      const files = await readdir(source, { recursive: true, withFileTypes: true })
      if (files.some((file) => file.isSymbolicLink())) throw new Error('Symlink in compiler cache')
      if (files.some((file) => file.isFile())) {
        await cp(source, join(to, name), { recursive: true })
        copied = true
      }
    }
  }
  if (!copied) throw new Error('Compiler cache missing')
}

export async function verifySourceMarker(serverDirectory) {
  const files = await readdir(serverDirectory, { recursive: true, withFileTypes: true })
  for (const file of files) {
    if (
      file.isFile() &&
      /\.(js|html|rsc)$/.test(file.name) &&
      (await readFile(join(file.parentPath, file.name), 'utf8')).includes(MARKER)
    )
      return true
  }
  return false
}

async function restoreOwnedEdit(path, original, edited) {
  await noSymlinks(path)
  if ((await readFile(path, 'utf8')) !== edited) throw new Error('Concurrent source edit prevents restoration')
  await writeFile(path, original)
}

/**
 * @param {{mode: string, variant: string, round: number, output: string}} options
 * @param {{cwd?: string, env?: Record<string, string | undefined>, runCommand?: (command: string, args: string[], context: {cwd: string, env: Record<string, string | undefined>, logPath: string, signal?: AbortSignal}) => Promise<number>, nodeVersion?: string, signal?: AbortSignal}} [settings]
 */
export async function runCompilerExperiment(
  options,
  { cwd = process.cwd(), env = process.env, runCommand = command, nodeVersion = process.versions.node, signal } = {},
) {
  const { workspace, temporary } = await assertEphemeralCI(env, cwd, options.output)
  if (nodeVersion.split('.')[0] !== '24') throw new Error('Node 24 required')
  const commit = env.GITHUB_SHA
  const key = stableServerActionsKey(env.PAYLOAD_SECRET, commit)
  const privateDirectory = await mkdtemp(join(temporary, 'ci-cache-compiler-'))
  const configPath = join(workspace, 'next.config.js')
  const sourcePath = join(workspace, MARKER_PATH)
  await noSymlinks(configPath)
  await noSymlinks(sourcePath)
  const originalConfig = await readFile(configPath, 'utf8')
  const editedConfig = instrumentConfig(originalConfig)
  const nextDirectory = join(workspace, '.next')
  const cacheDirectory = join(nextDirectory, 'cache')
  const savedCache = join(privateDirectory, 'cache')
  const versionsDirectory = join(privateDirectory, 'versions')
  /** @type {CompilerResult} */
  const result = {
    schemaVersion: 1,
    kind: 'compiler',
    mode: options.mode,
    variant: options.variant,
    round: options.round,
    commit,
    node: nodeVersion,
    pnpm: null,
    runner: {
      os: platform(),
      arch: arch(),
      cpuModel: cpus()[0]?.model ?? 'unknown',
      cpuCount: cpus().length,
      memoryBytes: totalmem(),
    },
    success: false,
    phases: [],
    builds: [],
    cleanupSucceeded: false,
  }
  let configEdited = false
  let originalSource
  let editedSource
  const phase = async (name, action) => {
    const started = performance.now()
    let exitCode = 1
    try {
      const value = await action()
      exitCode = typeof value === 'number' ? value : 0
      return value
    } finally {
      result.phases.push({ name, durationMs: Math.round(performance.now() - started), exitCode })
    }
  }
  const clean = async () => {
    await assertEphemeralCI(env, workspace, options.output)
    await rm(nextDirectory, { recursive: true, force: true })
  }
  const restoreCache = async () => {
    await clean()
    await copyCompilerCache(savedCache, cacheDirectory)
  }
  const build = async (label, stable) => {
    const metricsDirectory = join(privateDirectory, label)
    await mkdir(metricsDirectory, { mode: 0o700 })
    const logPath = join(privateDirectory, `${label}.log`)
    const buildEnv = {
      ...env,
      CI_CACHE_COMPILER_METRICS_DIR: metricsDirectory,
      CI_CACHE_COMPILER_VERSIONS_DIR: versionsDirectory,
    }
    // Old-paths builds intentionally regenerate the key after .rscinfo is removed.
    delete buildEnv.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
    if (stable) buildEnv.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY = key
    const started = performance.now()
    const exitCode = await phase(`build-${label}`, () =>
      runCommand('pnpm', ['build'], { cwd: workspace, env: buildEnv, logPath, signal }),
    )
    const entry = {
      label,
      exitCode,
      durationMs: Math.round(performance.now() - started),
      compilers: [],
      phaseTimings: {},
      sourceMarkerVerified: null,
    }
    result.builds.push(entry)
    entry.phaseTimings = parsePhaseTimings(await readFile(logPath, 'utf8'))
    if (await exists(`${logPath}.timings.json`)) {
      const timings = JSON.parse(await readFile(`${logPath}.timings.json`, 'utf8'))
      if (Number.isSafeInteger(timings.postbuildMs) && timings.postbuildMs >= 0)
        entry.phaseTimings.postbuildMs = timings.postbuildMs
    }
    for (const name of COMPILER_NAMES) {
      const metricsPath = join(metricsDirectory, `${name}.json`)
      if (await exists(metricsPath))
        entry.compilers.push(parseCompilerMetrics(JSON.parse(await readFile(metricsPath, 'utf8'))))
    }
    if (editedSource) entry.sourceMarkerVerified = await verifySourceMarker(join(nextDirectory, 'server'))
    if (exitCode !== 0) throw new Error('Build failed')
  }
  try {
    await phase('pnpm-version', async () => {
      const logPath = join(privateDirectory, 'pnpm-version.log')
      const exitCode = await runCommand('pnpm', ['--version'], { cwd: workspace, env, logPath, signal })
      const version = (await readFile(logPath, 'utf8'))
        .split('\n')
        .map((line) => line.replace(/^\[ci-cache-ms:\d+\] /, '').trim())
        .filter((line) => /^10\.\d+\.\d+$/.test(line))
        .at(-1)
      if (exitCode !== 0 || !/^10\.\d+\.\d+$/.test(version)) throw new Error('pnpm 10 required')
      result.pnpm = version
    })
    await writeFile(configPath, editedConfig)
    configEdited = true
    if (options.mode === 'diagnose') {
      await phase('cold-clean', clean)
      await build('cold', false)
      await phase('save-old-paths-cache', () => copyCompilerCache(cacheDirectory, savedCache))
      await phase('restore-old-paths-cache', restoreCache)
      await build('old-paths-restore', false)
      await phase('stable-cold-clean', async () => {
        await clean()
        await rm(savedCache, { recursive: true, force: true })
      })
      await build('stable-cold', true)
      await phase('save-stable-cache', () => copyCompilerCache(cacheDirectory, savedCache))
      await phase('restore-stable-cache', restoreCache)
      await build('stable-warm', true)
    } else {
      if (['warm', 'incremental'].includes(options.variant)) {
        await phase('save-restored-cache', () => copyCompilerCache(cacheDirectory, savedCache))
        await phase('restore-compiler-cache', restoreCache)
      } else await phase('cold-clean', clean)
      if (options.variant === 'incremental') {
        originalSource = await readFile(sourcePath, 'utf8')
        editedSource = incrementalSource(originalSource)
        await writeFile(sourcePath, editedSource)
      }
      await build(options.variant, true)
    }
    result.success = experimentSucceeded(options, result.builds)
  } catch {
    result.success = false
  } finally {
    await phase('cleanup', async () => {
      const operations = []
      if (editedSource) operations.push(restoreOwnedEdit(sourcePath, originalSource, editedSource))
      if (configEdited) operations.push(restoreOwnedEdit(configPath, originalConfig, editedConfig))
      // Never upload Next's generated key file with compiler caches.
      operations.push(
        (async () => {
          await noSymlinks(cacheDirectory)
          await rm(join(cacheDirectory, '.rscinfo'), { force: true })
        })(),
      )
      operations.push(rm(versionsDirectory, { recursive: true, force: true }))
      const settled = await Promise.allSettled(operations)
      result.cleanupSucceeded = settled.every((operation) => operation.status === 'fulfilled')
      if (!result.cleanupSucceeded) {
        result.success = false
        return 1
      }
    })
    const output = resolve(workspace, options.output)
    await noSymlinks(output)
    await mkdir(output, { recursive: true })
    await noSymlinks(join(output, 'result.json'))
    await writeFile(join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
  }
  return result
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  process.once('SIGINT', abort)
  process.once('SIGTERM', abort)
  try {
    const result = await runCompilerExperiment(parseArgs(process.argv.slice(2)), { signal: controller.signal })
    process.stdout.write(
      `Compiler experiment ${result.success ? 'succeeded' : 'failed'}; cleanup ${result.cleanupSucceeded ? 'succeeded' : 'failed'}.\n`,
    )
    process.exitCode = result.success ? 0 : 1
  } catch {
    process.stderr.write('Compiler experiment rejected; check CLI arguments and ephemeral CI prerequisites.\n')
    process.exitCode = 1
  } finally {
    process.removeListener('SIGINT', abort)
    process.removeListener('SIGTERM', abort)
  }
}

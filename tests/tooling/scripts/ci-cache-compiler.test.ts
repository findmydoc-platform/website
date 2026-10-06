import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import {
  assertEphemeralCI,
  experimentSucceeded,
  incrementalSource,
  instrumentConfig,
  parseArgs,
  parseCompilerMetrics,
  parsePhaseTimings,
  runCompilerExperiment,
  stableServerActionsKey,
  verifySourceMarker,
} from '../../../scripts/ci-cache-compiler.mjs'
import {
  cacheInvalidationReason,
  CiCacheWebpackPlugin,
  withCompilerDiagnostics,
} from '../../../scripts/ci-cache-webpack-plugin.mjs'

const directories: string[] = []
const secret = 'test-only-private-value'
const commit = 'a'.repeat(40)
const options = { mode: 'measure', variant: 'baseline', round: 1, output: 'tmp/compiler-test' }
const compilerMetrics = (name = 'server', cachedModules = 0) => ({
  name,
  builtModules: 1,
  cachedModules,
  totalModules: 4,
  compilationMs: 10,
  cacheVersionEqual: null,
  cacheInvalidationReasons: [],
})

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'compiler-diagnostics-test-')))
  directories.push(root)
  const cwd = join(root, 'workspace')
  const temporary = join(root, 'runner-temp')
  await mkdir(cwd)
  await mkdir(temporary)
  await mkdir(join(cwd, 'src/app/(frontend)/contact'), { recursive: true })
  const config = 'const nextConfig = {}\nexport default withPayload(nextConfig)\n'
  const source =
    "export const metadata: Metadata = {\n ...createSiteMetadata({title: 'Contact', path: '/contact'}),\n}\n"
  await writeFile(join(cwd, 'next.config.js'), config)
  await writeFile(join(cwd, 'src/app/(frontend)/contact/page.tsx'), source)
  const env = {
    CI_CACHE_EXPERIMENT: '1',
    GITHUB_ACTIONS: 'true',
    RUNNER_ENVIRONMENT: 'github-hosted',
    RUNNER_TEMP: temporary,
    GITHUB_WORKSPACE: cwd,
    GITHUB_SHA: commit,
    PAYLOAD_SECRET: secret,
  }
  return { root, cwd, temporary, config, source, env }
}

afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('compiler diagnostic safety and parsing', () => {
  it('parses the measurement interface and rejects invalid or escaping output', () => {
    expect(
      parseArgs(['--mode', 'diagnose', '--variant', 'diagnose', '--round', '1', '--output', 'tmp/diagnose']).variant,
    ).toBe('diagnose')
    expect(() =>
      parseArgs(['--mode', 'measure', '--variant', 'diagnose', '--round', '1', '--output', 'tmp/measure']),
    ).toThrow()
    expect(parseArgs(['--mode', 'measure', '--variant', 'warm', '--round', '2', '--output', 'tmp/warm'])).toEqual({
      mode: 'measure',
      variant: 'warm',
      round: 2,
      output: 'tmp/warm',
    })
    for (const output of ['/tmp/result', 'tmp/../outside', 'tmp/', 'tmp/a/../../outside']) {
      expect(() => parseArgs(['--mode', 'measure', '--variant', 'warm', '--round', '2', '--output', output])).toThrow()
    }
    expect(() => parseArgs(['--mode', 'measure', '--variant', 'warm', '--round', '4', '--output', 'tmp/a'])).toThrow()
    expect(() => parseArgs(['--mode', 'measure', '--mode', 'diagnose'])).toThrow()
  })

  it('rejects cleanup outside an opted-in hosted runner and symlinked outputs', async () => {
    const { cwd, env, temporary } = await fixture()
    await expect(assertEphemeralCI(env, cwd, options.output)).resolves.toEqual({ workspace: cwd, temporary })
    for (const override of [
      { CI_CACHE_EXPERIMENT: '0' },
      { GITHUB_ACTIONS: 'false' },
      { RUNNER_ENVIRONMENT: 'self-hosted' },
      { RUNNER_TEMP: cwd },
      { RUNNER_TEMP: '/' },
      { RUNNER_TEMP: join(cwd, 'tmp') },
      { GITHUB_WORKSPACE: temporary },
    ])
      await expect(assertEphemeralCI({ ...env, ...override }, cwd, options.output)).rejects.toThrow()
    await symlink(temporary, join(cwd, 'tmp'))
    await expect(assertEphemeralCI(env, cwd, options.output)).rejects.toThrow()
  })

  it('rejects symlinked build directories before deletion', async () => {
    const { cwd, env, temporary } = await fixture()
    await symlink(temporary, join(cwd, '.next'))
    await expect(assertEphemeralCI(env, cwd, options.output)).rejects.toThrow()
  })

  it('derives a reproducible 32-byte key and separates secrets and commits', () => {
    const key = stableServerActionsKey(secret, commit)
    expect(Buffer.from(key, 'base64')).toHaveLength(32)
    expect(stableServerActionsKey(secret, commit)).toBe(key)
    expect(stableServerActionsKey('other-secret', commit)).not.toBe(key)
    expect(stableServerActionsKey(secret, 'b'.repeat(40))).not.toBe(key)
    expect(() => stableServerActionsKey('', commit)).toThrow()
  })

  it('keeps instrumentation byte-identical and wraps the Payload webpack callback', () => {
    const source = 'export default withPayload(nextConfig)'
    expect(instrumentConfig(source)).toBe(instrumentConfig(source))
    expect(() => instrumentConfig('export default somethingElse')).toThrow()
    const original = vi.fn((config) => ({ ...config, plugins: ['payload-plugin'] }))
    const wrapped = withCompilerDiagnostics({ webpack: original })
    const context = { isServer: true }
    const configured = wrapped.webpack({ plugins: [] }, context)
    expect(original).toHaveBeenCalledWith({ plugins: [] }, context)
    expect(configured.plugins[0]).toBe('payload-plugin')
    expect(configured.plugins[1]).toBeInstanceOf(CiCacheWebpackPlugin)
  })

  it('preserves the complete post-Payload cache version for the separately sealed cache', () => {
    const wrap = (version: string) =>
      withCompilerDiagnostics({
        webpack: (config: object) => ({ ...config, cache: { version }, plugins: [] }),
      }).webpack({}, {})
    const first = wrap(`next-config:${secret}`)
    expect(first.cache.version).toBe(`next-config:${secret}`)
    expect(wrap(`changed-config:${secret}`).cache.version).toBe(`changed-config:${secret}`)
  })

  it('exports numeric phase timings without retaining log text', () => {
    const timings = parsePhaseTimings(
      `secret=${secret}\n✓ Compiled successfully in 2.5s\nCollecting page data using 2 workers in 150ms\nGenerating static pages (3/3) in 1.2s\n`,
    )
    expect(timings).toEqual({ compileMs: 2500, pageDataMs: 150, staticGenerationMs: 1200 })
    expect(JSON.stringify(timings)).not.toContain(secret)
  })

  it('times warning builds and TypeScript, page and postbuild boundaries from private line timestamps', () => {
    expect(
      parsePhaseTimings(
        [
          '[ci-cache-ms:10] Creating an optimized production build ...',
          '[ci-cache-ms:510] Compiled with warnings',
          '[ci-cache-ms:600] Running TypeScript ...',
          '[ci-cache-ms:950] Finished TypeScript',
          '[ci-cache-ms:1000] Collecting page data using 2 workers',
          '[ci-cache-ms:1200] Generating static pages (0/3)',
          '[ci-cache-ms:1600] Generating static pages (3/3)',
          '[ci-cache-ms:1800] Finalizing page optimization',
          '[ci-cache-ms:2000] > findmydoc-portal@1.0.0 postbuild /private',
          '[ci-cache-ms:2200] [ci-cache-command-end]',
        ].join('\n'),
      ),
    ).toEqual({
      compileMs: 500,
      typecheckMs: 350,
      pageDataMs: 250,
      staticGenerationMs: 400,
      finalizeMs: 200,
      postbuildMs: 200,
    })
    expect(parsePhaseTimings('Compiled with warnings in 4s')).toEqual({ compileMs: 4000 })
  })

  it('counts buildModule and stillValidModule independently and persists only a version equality flag', async () => {
    const { temporary } = await fixture()
    const metrics = join(temporary, 'metrics')
    const versions = join(temporary, 'versions')
    vi.stubEnv('CI_CACHE_COMPILER_METRICS_DIR', metrics)
    vi.stubEnv('CI_CACHE_COMPILER_VERSIONS_DIR', versions)
    const hook = () => ({ tap: vi.fn() })
    const fakeCompiler = () => ({
      options: { name: 'server', cache: { version: secret } },
      hooks: { infrastructureLog: hook(), compile: hook(), compilation: hook(), done: hook() },
    })
    const first = fakeCompiler()
    new CiCacheWebpackPlugin().apply(first)
    const compilation = { hooks: { buildModule: hook(), stillValidModule: hook(), finishModules: hook() } }
    first.hooks.compile.tap.mock.calls[0]![1]()
    first.hooks.compilation.tap.mock.calls[0]![1](compilation)
    const built = {}
    const cached = {}
    compilation.hooks.buildModule.tap.mock.calls[0]![1](built)
    compilation.hooks.buildModule.tap.mock.calls[0]![1](built)
    compilation.hooks.stillValidModule.tap.mock.calls[0]![1](cached)
    compilation.hooks.finishModules.tap.mock.calls[0]![1](new Set([built, cached]))
    expect(
      first.hooks.infrastructureLog.tap.mock.calls[0]![1]('webpack.cache.PackFileCacheStrategy', 'log', [
        `${secret} version doesn't match`,
      ]),
    ).toBe(true)
    first.hooks.done.tap.mock.calls[0]![1]({ compilation: { modules: new Set([{}]) } })
    const raw = await readFile(join(metrics, 'server.json'), 'utf8')
    expect(raw).not.toContain(secret)
    expect(JSON.parse(raw)).toMatchObject({
      builtModules: 1,
      cachedModules: 1,
      totalModules: 2,
      cacheVersionEqual: null,
      cacheInvalidationReasons: ['version-mismatch'],
    })
    const second = fakeCompiler()
    new CiCacheWebpackPlugin().apply(second)
    second.hooks.done.tap.mock.calls[0]![1]({ compilation: { modules: new Set([{}]) } })
    expect(JSON.parse(await readFile(join(metrics, 'server.json'), 'utf8')).cacheVersionEqual).toBe(true)
    const third = fakeCompiler()
    third.options.cache.version = 'different-private-version'
    new CiCacheWebpackPlugin().apply(third)
    third.hooks.done.tap.mock.calls[0]![1]({ compilation: { modules: new Set([{}]) } })
    expect(JSON.parse(await readFile(join(metrics, 'server.json'), 'utf8')).cacheVersionEqual).toBe(false)
  })

  it('observes real Webpack filesystem reuse and an empty edge compiler without a database', async () => {
    const require = createRequire(import.meta.url)
    const { webpack } = require('next/dist/compiled/webpack/webpack.js') as {
      webpack: (config: Record<string, unknown>) => {
        run: (callback: (error: Error | null, stats?: { hasErrors: () => boolean }) => void) => void
        close: (callback: (error: Error | null) => void) => void
      }
    }
    const { temporary } = await fixture()
    const entry = join(temporary, 'entry.js')
    await writeFile(entry, 'console.log("compiler fixture")\n')
    const metrics = join(temporary, 'real-metrics')
    vi.stubEnv('CI_CACHE_COMPILER_METRICS_DIR', metrics)
    vi.stubEnv('CI_CACHE_COMPILER_VERSIONS_DIR', join(temporary, 'real-versions'))
    const compile = async (name: string, entries: Record<string, string>) => {
      const config = withCompilerDiagnostics({}).webpack(
        {
          name,
          mode: 'production',
          entry: entries,
          context: temporary,
          optimization: { minimize: false },
          output: { path: join(temporary, 'bundle', name) },
          cache: {
            type: 'filesystem',
            cacheDirectory: join(temporary, 'webpack-cache', name),
            version: secret,
            buildDependencies: { defaultWebpack: [] },
          },
        },
        {},
      )
      const compiler = webpack(config)
      await new Promise<void>((resolve, reject) =>
        compiler.run((error, stats) => {
          compiler.close((closeError) => {
            if (error || closeError || stats?.hasErrors())
              reject(error ?? closeError ?? new Error('Fixture compiler failed'))
            else resolve()
          })
        }),
      )
      return parseCompilerMetrics(JSON.parse(await readFile(join(metrics, `${name}.json`), 'utf8')))
    }
    const cold = await compile('server', { main: entry })
    expect(cold.builtModules).toBeGreaterThan(0)
    expect(cold.cachedModules).toBe(0)
    const warm = await compile('server', { main: entry })
    expect(warm.cachedModules).toBeGreaterThan(0)
    expect(warm.cacheVersionEqual).toBe(true)
    const edge = await compile('edge-server', {})
    expect(edge.totalModules).toBe(0)
    expect(
      experimentSucceeded({ mode: 'measure', variant: 'warm' }, [
        {
          label: 'warm',
          exitCode: 0,
          sourceMarkerVerified: null,
          compilers: [compilerMetrics('client', 1), warm, edge],
        },
      ]),
    ).toBe(true)
  })

  it('rejects malformed counters and reasons and discards unknown fields', () => {
    expect(parseCompilerMetrics({ ...compilerMetrics(), rawVersion: secret })).not.toHaveProperty('rawVersion')
    for (const invalid of [
      { builtModules: -1 },
      { cachedModules: 0.5 },
      { cachedModules: 5 },
      { name: secret },
      { cacheVersionEqual: secret },
      { cacheInvalidationReasons: [secret] },
      { totalModules: NaN },
    ])
      expect(() => parseCompilerMetrics({ ...compilerMetrics(), ...invalid })).toThrow()
  })

  it.each([
    ["Restored pack from /private, but version doesn't match.", 'version-mismatch'],
    ['Restored pack but build dependencies have changed.', 'build-dependencies-changed'],
    ['No pack exists at /private', 'cache-missing'],
    ['Restoring pack failed from /private', 'restore-failed'],
    ['Pack got invalid because of write to: private', 'pack-write'],
  ])('reduces infrastructure logs to a safe reason: %s', (message, expected) => {
    expect(
      cacheInvalidationReason([
        message,
        secret,
        {
          toString: () => {
            throw new Error('Must not serialize')
          },
        },
      ]),
    ).toBe(expected)
    expect(cacheInvalidationReason(['unrelated secret log'])).toBeNull()
  })

  it('rejects successful commands with absent compiler telemetry, zero reuse, or missing marker evidence', () => {
    const compilers = ['client', 'server', 'edge-server'].map((name) => compilerMetrics(name, 1))
    const warm = { label: 'warm', exitCode: 0, compilers, sourceMarkerVerified: null }
    expect(experimentSucceeded({ mode: 'measure', variant: 'warm' }, [warm])).toBe(true)
    expect(experimentSucceeded({ mode: 'measure', variant: 'warm' }, [{ ...warm, exitCode: 1 }])).toBe(false)
    expect(experimentSucceeded({ mode: 'measure', variant: 'warm' }, [{ ...warm, compilers: [] }])).toBe(false)
    expect(
      experimentSucceeded({ mode: 'measure', variant: 'warm' }, [
        { ...warm, compilers: compilers.map((entry) => ({ ...entry, cachedModules: 0 })) },
      ]),
    ).toBe(false)
    expect(experimentSucceeded({ mode: 'measure', variant: 'incremental' }, [{ ...warm, label: 'incremental' }])).toBe(
      false,
    )
    expect(
      experimentSucceeded({ mode: 'measure', variant: 'incremental' }, [
        { ...warm, label: 'incremental', sourceMarkerVerified: true },
      ]),
    ).toBe(true)
    expect(experimentSucceeded({ mode: 'diagnose' }, [warm])).toBe(false)
  })

  it('requires the existing metadata title and checks emitted server content, excluding source maps', async () => {
    const { cwd, source } = await fixture()
    const edited = incrementalSource(source)
    expect(edited).toContain("title: 'Contact CI compiler incremental metadata marker'")
    expect(() => incrementalSource("const title = 'Contact'")).toThrow()
    const server = join(cwd, '.next/server')
    await mkdir(server, { recursive: true })
    await writeFile(join(server, 'page.js.map'), edited)
    expect(await verifySourceMarker(server)).toBe(false)
    await writeFile(join(server, 'page.js'), edited)
    expect(await verifySourceMarker(server)).toBe(true)
  })
})

describe('compiler experiment orchestration', () => {
  async function setupRunner({ failBuild = 0, marker = true, concurrentEdit = false } = {}) {
    const data = await fixture()
    const configs: string[] = []
    const keys: Array<string | undefined> = []
    let builds = 0
    const runCommand = async (
      _command: string,
      args: string[],
      context: { cwd: string; env: Record<string, string | undefined>; logPath: string },
    ) => {
      if (args[0] === '--version') {
        await writeFile(context.logPath, '10.28.2\n')
        return 0
      }
      expect(args).toEqual(['build'])
      builds += 1
      configs.push(await readFile(join(data.cwd, 'next.config.js'), 'utf8'))
      keys.push(context.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY)
      const cache = join(data.cwd, '.next/cache/webpack')
      const restored = await readFile(join(cache, 'pack'), 'utf8').catch(() => '')
      await mkdir(cache, { recursive: true })
      await writeFile(join(cache, 'pack'), 'seed-pack')
      await writeFile(join(data.cwd, '.next/cache/.rscinfo'), secret)
      await mkdir(join(data.cwd, '.next/server'), { recursive: true })
      await writeFile(
        join(data.cwd, '.next/server/page.js'),
        marker ? await readFile(join(data.cwd, 'src/app/(frontend)/contact/page.tsx'), 'utf8') : 'stale output',
      )
      for (const name of ['client', 'server', 'edge-server']) {
        await writeFile(
          join(context.env.CI_CACHE_COMPILER_METRICS_DIR!, `${name}.json`),
          JSON.stringify(compilerMetrics(name, restored ? 2 : 0)),
        )
      }
      await writeFile(context.logPath, `private ${secret}\nCompiled successfully in 2s\npostbuild next-sitemap\n`)
      if (concurrentEdit) await writeFile(join(data.cwd, 'next.config.js'), 'other worker edit')
      return builds === failBuild ? 1 : 0
    }
    return { ...data, runCommand, configs, keys }
  }

  it('diagnoses cold, old paths and stable keys on one VM, restoring source and excluding private logs', async () => {
    const data = await setupRunner()
    const result = await runCompilerExperiment({ ...options, mode: 'diagnose' }, { ...data, nodeVersion: '24.0.0' })
    expect(result.success).toBe(true)
    expect(result.cleanupSucceeded).toBe(true)
    expect(result.builds.map((build: { label: string }) => build.label)).toEqual([
      'cold',
      'old-paths-restore',
      'stable-cold',
      'stable-warm',
    ])
    expect(new Set(data.configs).size).toBe(1)
    expect(data.keys.slice(0, 2)).toEqual([undefined, undefined])
    expect(data.keys[2]).toBe(data.keys[3])
    expect(await readFile(join(data.cwd, 'next.config.js'), 'utf8')).toBe(data.config)
    await expect(readFile(join(data.cwd, '.next/cache/.rscinfo'))).rejects.toThrow()
    const artifact = await readFile(join(data.cwd, options.output, 'result.json'), 'utf8')
    expect(artifact).not.toContain(secret)
    expect(typeof data.keys[2]).toBe('string')
    expect(artifact).not.toContain(data.keys[2]!)
    expect(artifact).not.toContain(data.temporary)
    expect(JSON.parse(artifact)).toMatchObject({ schemaVersion: 1, kind: 'compiler', commit, pnpm: '10.28.2' })
    const privateRuns = (await readdir(data.temporary)).filter((name) => name.startsWith('ci-cache-compiler-'))
    expect(privateRuns).toHaveLength(1)
    await expect(readFile(join(data.temporary, privateRuns[0]!, 'versions/server.json'))).rejects.toThrow()
  })

  it.each(['baseline', 'populate'])(
    'starts %s cold and preserves only compiler cache for external sealing',
    async (variant) => {
      const data = await setupRunner()
      await mkdir(join(data.cwd, '.next/cache/webpack'), { recursive: true })
      await writeFile(join(data.cwd, '.next/cache/webpack/pack'), 'old-pack')
      const result = await runCompilerExperiment({ ...options, variant }, { ...data, nodeVersion: '24.0.0' })
      expect(result.success).toBe(true)
      expect(result.builds[0]!.compilers.every((compiler) => compiler.cachedModules === 0)).toBe(true)
      expect(await readFile(join(data.cwd, '.next/cache/webpack/pack'), 'utf8')).toBe('seed-pack')
      await expect(readFile(join(data.cwd, '.next/cache/.rscinfo'))).rejects.toThrow()
    },
  )

  it('ignores private npmrc warnings when identifying pnpm version', async () => {
    const data = await setupRunner()
    const runCommand = async (
      command: string,
      args: string[],
      context: { cwd: string; env: Record<string, string | undefined>; logPath: string },
    ) => {
      if (args[0] !== '--version') return data.runCommand(command, args, context)
      await writeFile(
        context.logPath,
        `[ci-cache-ms:5] npmrc warning ${secret}\n[ci-cache-ms:10] 10.28.2\n[ci-cache-ms:11] [ci-cache-command-end]\n`,
      )
      return 0
    }
    const result = await runCompilerExperiment(options, { ...data, runCommand, nodeVersion: '24.0.0' })
    expect(result.success).toBe(true)
    expect(result.pnpm).toBe('10.28.2')
  })

  it('fails the experiment on a failed build and still restores its config', async () => {
    const data = await setupRunner({ failBuild: 2 })
    const result = await runCompilerExperiment({ ...options, mode: 'diagnose' }, { ...data, nodeVersion: '24.0.0' })
    expect(result.success).toBe(false)
    expect(result.cleanupSucceeded).toBe(true)
    expect(result.builds).toHaveLength(2)
    expect(result.phases.find((phase: { name: string }) => phase.name === 'build-old-paths-restore')?.exitCode).toBe(1)
    expect(await readFile(join(data.cwd, 'next.config.js'), 'utf8')).toBe(data.config)
  })

  it.each([true, false])(
    'gates incremental measurement on actual output and reverses the source edit: %s',
    async (marker) => {
      const data = await setupRunner({ marker })
      await mkdir(join(data.cwd, '.next/cache/webpack'), { recursive: true })
      await writeFile(join(data.cwd, '.next/cache/webpack/pack'), 'restored-pack')
      const result = await runCompilerExperiment(
        { ...options, variant: 'incremental' },
        { ...data, nodeVersion: '24.0.0' },
      )
      expect(result.success).toBe(marker)
      expect(result.builds[0]!.sourceMarkerVerified).toBe(marker)
      expect(await readFile(join(data.cwd, 'src/app/(frontend)/contact/page.tsx'), 'utf8')).toBe(data.source)
    },
  )

  it('fails warm measurement without a restored cache instead of quietly measuring cold', async () => {
    const data = await setupRunner()
    const result = await runCompilerExperiment({ ...options, variant: 'warm' }, { ...data, nodeVersion: '24.0.0' })
    expect(result.success).toBe(false)
    expect(result.builds).toHaveLength(0)
    expect(result.cleanupSucceeded).toBe(true)
  })

  it('preserves another worker edit and reports cleanup failure', async () => {
    const data = await setupRunner({ concurrentEdit: true })
    const result = await runCompilerExperiment(options, { ...data, nodeVersion: '24.0.0' })
    expect(result.success).toBe(false)
    expect(result.cleanupSucceeded).toBe(false)
    expect(await readFile(join(data.cwd, 'next.config.js'), 'utf8')).toBe('other worker edit')
  })
})

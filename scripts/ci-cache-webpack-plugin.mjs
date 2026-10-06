import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PLUGIN = 'CiCacheCompilerDiagnostics'
export const COMPILER_NAMES = ['client', 'server', 'edge-server']
export const CACHE_REASONS = [
  'version-mismatch',
  'build-dependencies-changed',
  'resolve-dependencies-changed',
  'snapshot-check-failed',
  'cache-missing',
  'restore-failed',
  'unexpected-cache-content',
  'pack-write',
]

// Never retain a logger argument. Paths, versions and errors can contain credentials.
export function cacheInvalidationReason(args) {
  const message = args.filter((arg) => typeof arg === 'string').join(' ')
  if (message.includes("version doesn't match")) return 'version-mismatch'
  if (message.includes('build dependencies have changed')) return 'build-dependencies-changed'
  if (/resolv(e|ing).*build dependencies.*changed/i.test(message)) return 'resolve-dependencies-changed'
  if (/checking .*snapshot.*failed|checking .*dependencies.*errored/i.test(message)) return 'snapshot-check-failed'
  if (message.includes('No pack exists')) return 'cache-missing'
  if (message.includes('Restoring pack failed')) return 'restore-failed'
  if (message.includes('contained content is unexpected')) return 'unexpected-cache-content'
  if (message.includes('Pack got invalid because of write')) return 'pack-write'
  return null
}

export class CiCacheWebpackPlugin {
  apply(compiler) {
    const name = compiler.options.name
    if (!COMPILER_NAMES.includes(name)) throw new Error('Unsupported compiler')
    const directory = process.env.CI_CACHE_COMPILER_METRICS_DIR
    const versions = process.env.CI_CACHE_COMPILER_VERSIONS_DIR
    if (!directory || !versions) throw new Error('Missing diagnostic directories')
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    mkdirSync(versions, { recursive: true, mode: 0o700 })
    const versionFile = join(versions, `${name}.json`)
    const version = compiler.options.cache?.version
    let cacheVersionEqual = null
    try {
      cacheVersionEqual = JSON.parse(readFileSync(versionFile, 'utf8')) === version
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error('Cannot compare cache version')
    }
    // This file stays in RUNNER_TEMP, never in the cache or the result artifact.
    writeFileSync(versionFile, JSON.stringify(version ?? null), { mode: 0o600 })
    const reasons = new Set()
    const built = new Set()
    const cached = new Set()
    let totalModules = 0
    let compileStarted = 0
    let compilationMs = 0
    let completed = false
    const persist = () => {
      writeFileSync(
        join(directory, `${name}.json`),
        JSON.stringify({
          name,
          builtModules: built.size,
          cachedModules: cached.size,
          totalModules,
          cacheVersionEqual,
          cacheInvalidationReasons: [...reasons].sort(),
          compilationMs,
        }),
        { mode: 0o600 },
      )
    }
    compiler.hooks.infrastructureLog.tap(PLUGIN, (logger, _type, args) => {
      if (!/webpack\.cache\.|webpack\.FileSystemInfo/.test(logger)) return undefined
      const reason = cacheInvalidationReason(args)
      if (reason) reasons.add(reason)
      if (completed) persist()
      return true
    })
    compiler.hooks.compile.tap(PLUGIN, () => {
      compileStarted = performance.now()
    })
    compiler.hooks.compilation.tap(PLUGIN, (compilation) => {
      compilation.hooks.buildModule.tap(PLUGIN, (module) => built.add(module))
      compilation.hooks.stillValidModule.tap(PLUGIN, (module) => cached.add(module))
      // Count before concatenation replaces individual modules with optimized groups.
      compilation.hooks.finishModules.tap(PLUGIN, (modules) => {
        totalModules = modules.size
      })
    })
    compiler.hooks.done.tap(PLUGIN, (stats) => {
      totalModules ||= stats.compilation.modules.size
      compilationMs = Math.round(performance.now() - compileStarted)
      completed = true
      persist()
    })
  }
}

export function withCompilerDiagnostics(config) {
  const original = config.webpack
  return {
    ...config,
    webpack(webpackConfig, context) {
      const configured = original ? original.call(config, webpackConfig, context) : webpackConfig
      configured.plugins ??= []
      configured.plugins.push(new CiCacheWebpackPlugin())
      return configured
    },
  }
}

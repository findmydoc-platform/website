import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

export default class ShardDiagnosticReporter {
  modules = []
  hooks = []
  pendingHooks = new Map()

  onInit(ctx) {
    this.root = ctx.config.root
  }

  onHookStart(hook) {
    this.pendingHooks.set(`${hook.entity.id}:${hook.name}`, performance.now())
  }

  onHookEnd(hook) {
    const key = `${hook.entity.id}:${hook.name}`
    const started = this.pendingHooks.get(key)
    if (started === undefined) return
    this.hooks.push({ entity: hook.entity.id, name: hook.name, durationMs: performance.now() - started })
    this.pendingHooks.delete(key)
  }

  onTestModuleEnd(testModule) {
    const diagnostic = testModule.diagnostic()
    const filename = path.relative(this.root, testModule.moduleId).split(path.sep).join('/')
    const tests = [...testModule.children.allTests()].map((test) => ({
      id: createHash('sha256').update(`${filename}\0${test.fullName}`).digest('hex'),
      state: test.result().state,
      durationMs: test.diagnostic()?.duration ?? 0,
      retries: test.diagnostic()?.retryCount ?? 0,
    }))
    this.modules.push({
      filename,
      durationMs: diagnostic.duration,
      collectMs: diagnostic.collectDuration,
      setupMs: diagnostic.setupDuration,
      prepareMs: diagnostic.prepareDuration,
      environmentMs: diagnostic.environmentSetupDuration,
      hookMs: this.hooks
        .filter(
          (hook) =>
            hook.entity === testModule.id ||
            [...testModule.children.allTests()].some((test) => test.id === hook.entity) ||
            [...testModule.children.allSuites()].some((suite) => suite.id === hook.entity),
        )
        .reduce((sum, hook) => sum + hook.durationMs, 0),
      tests,
    })
  }

  onTestRunEnd(_modules, errors, reason) {
    const output = process.env.CI_SHARD_REPORT
    if (!output) throw new Error('CI_SHARD_REPORT is required for the diagnostic reporter.')
    mkdirSync(path.dirname(output), { recursive: true })
    writeFileSync(
      output,
      JSON.stringify({ version: 1, reason, unhandledErrors: errors.length, modules: this.modules }, null, 2),
    )
  }
}

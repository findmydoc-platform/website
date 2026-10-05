import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

export default class ShardDiagnosticReporter {
  modules = []
  hooks = []
  pendingHooks = new Map()
  unmatchedHookEnds = 0

  onInit(ctx) {
    this.root = ctx.config.root
  }

  onHookStart(hook) {
    this.pendingHooks.set(`${hook.entity.id}:${hook.name}`, performance.now())
  }

  onHookEnd(hook) {
    const key = `${hook.entity.id}:${hook.name}`
    const started = this.pendingHooks.get(key)
    if (started === undefined) {
      this.unmatchedHookEnds++
      return
    }
    const testModule = hook.entity.type === 'module' ? hook.entity : hook.entity.module
    this.hooks.push({
      filename: path.relative(this.root, testModule.moduleId).split(path.sep).join('/'),
      name: hook.name,
      durationMs: performance.now() - started,
    })
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
      tests,
    })
  }

  onTestRunEnd(_modules, errors, reason) {
    const output = process.env.CI_SHARD_REPORT
    if (!output) throw new Error('CI_SHARD_REPORT is required for the diagnostic reporter.')
    mkdirSync(path.dirname(output), { recursive: true })
    for (const testModule of this.modules) {
      const hooks = this.hooks.filter((hook) => hook.filename === testModule.filename)
      testModule.hookMs = hooks.reduce((sum, hook) => sum + hook.durationMs, 0)
      testModule.hookMsByName = Object.fromEntries(
        ['beforeAll', 'afterAll', 'beforeEach', 'afterEach'].map((name) => [
          name,
          hooks.filter((hook) => hook.name === name).reduce((sum, hook) => sum + hook.durationMs, 0),
        ]),
      )
    }
    writeFileSync(
      output,
      JSON.stringify(
        {
          version: 1,
          reason,
          unhandledErrors: errors.length,
          hookTimingComplete: this.pendingHooks.size === 0 && this.unmatchedHookEnds === 0,
          modules: this.modules,
        },
        null,
        2,
      ),
    )
  }
}

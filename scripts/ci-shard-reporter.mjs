import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export default class ShardDiagnosticReporter {
  modules = []
  onInit(ctx) {
    this.root = ctx.config.root
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
    const filename = process.env.CI_SHARD_HOOKS
    const workerHooks =
      filename && existsSync(filename)
        ? readFileSync(filename, 'utf8')
            .trim()
            .split('\n')
            .filter(Boolean)
            .map((line) => JSON.parse(line))
        : []
    for (const testModule of this.modules) {
      const hooks = workerHooks.filter((hook) => hook.filename === testModule.filename)
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
          hookTimingComplete:
            workerHooks.every((hook) => Number.isFinite(hook.durationMs) && hook.durationMs >= 0) &&
            this.modules.every((testModule) => workerHooks.some((hook) => hook.filename === testModule.filename)),
          modules: this.modules,
        },
        null,
        2,
      ),
    )
  }
}

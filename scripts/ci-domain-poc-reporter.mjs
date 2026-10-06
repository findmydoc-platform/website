import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
export default class DomainPocReporter {
  modules = []
  onTestModuleEnd(module) {
    const diagnostic = module.diagnostic()
    this.modules.push({
      filename: path.relative(process.cwd(), module.moduleId).split(path.sep).join('/'),
      collectMs: diagnostic.collectDuration,
      setupMs: diagnostic.setupDuration,
      durationMs: diagnostic.duration,
      tests: [...module.children.allTests()].map((test) => ({
        name: test.fullName,
        state: test.result().state,
        retries: test.diagnostic()?.retryCount ?? 0,
        durationMs: test.diagnostic()?.duration ?? 0,
      })),
    })
  }
  onTestRunEnd(_modules, errors, reason) {
    if (!process.env.DOMAIN_POC_REPORT) throw new Error('Missing domain POC report path.')
    mkdirSync(path.dirname(process.env.DOMAIN_POC_REPORT), { recursive: true })
    writeFileSync(
      process.env.DOMAIN_POC_REPORT,
      JSON.stringify({ modules: this.modules, unhandledErrors: errors.length, reason }, null, 2),
    )
  }
}

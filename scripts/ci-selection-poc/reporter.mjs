import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export default class SelectionReporter {
  modules = []
  onInit(context) {
    this.root = context.config.root
  }
  onTestModuleEnd(module) {
    const filename = path.relative(this.root, module.moduleId).split(path.sep).join('/')
    this.modules.push({
      filename,
      tests: [...module.children.allTests()].map((test, index) => ({
        id: createHash('sha256').update(`${filename}\0${index}\0${test.fullName}`).digest('hex'),
        state: test.result().state,
        retries: test.diagnostic()?.retryCount ?? 0,
      })),
    })
  }
  onTestRunEnd(_modules, errors, reason) {
    const output = process.env.CI_SELECTION_REPORT
    if (!output) throw new Error('CI_SELECTION_REPORT required')
    mkdirSync(path.dirname(output), { recursive: true })
    writeFileSync(output, JSON.stringify({ reason, unhandledErrors: errors.length, modules: this.modules }, null, 2))
  }
}

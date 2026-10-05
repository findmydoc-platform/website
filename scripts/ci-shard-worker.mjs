import { appendFileSync } from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { VitestTestRunner } from 'vitest/runners'

const phases = {
  'suite.beforeAll': 'beforeAll',
  'suite.afterAll': 'afterAll',
  'test.beforeEach': 'beforeEach',
  'test.afterEach': 'afterEach',
}

export default class DiagnosticWorker extends VitestTestRunner {
  constructor(config) {
    super(config)
    const originalTrace = this.trace
    this.trace = (name, attributes, callback) => {
      if (!phases[name]) return originalTrace(name, attributes, callback)
      const started = performance.now()
      const filename = this.currentFile
      const record = () => {
        const output = process.env.CI_SHARD_HOOKS
        if (!output || !filename) throw new Error('Worker hook measurement context is missing.')
        appendFileSync(
          output,
          JSON.stringify({
            filename: path.relative(process.cwd(), filename).split(path.sep).join('/'),
            name: phases[name],
            durationMs: performance.now() - started,
          }) + '\n',
        )
      }
      try {
        const result = originalTrace(name, attributes, callback)
        if (result && typeof result.then === 'function') return Promise.resolve(result).finally(record)
        record()
        return result
      } catch (error) {
        record()
        throw error
      }
    }
  }

  onBeforeRunSuite(suite) {
    this.currentFile = suite.file.filepath
    return super.onBeforeRunSuite(suite)
  }
}

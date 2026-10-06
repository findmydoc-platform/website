import { createHash } from 'node:crypto'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'

const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const read = (filename) => JSON.parse(readFileSync(filename, 'utf8'))

export function suiteEvidence(report, coverage, root = process.cwd()) {
  if (
    !report.success ||
    report.numFailedTests ||
    report.numPendingTests ||
    report.numTodoTests ||
    report.numFailedTestSuites
  )
    throw new Error('Suite is failed or incomplete')
  const cases = report.testResults
    .flatMap((file) => {
      const relative = path.relative(root, file.name).split(path.sep).join('/')
      if (relative.startsWith('../') || path.isAbsolute(relative)) throw new Error('Test path outside repository')
      return file.assertionResults.map((test, index) => {
        if (test.status !== 'passed') throw new Error('Case did not pass')
        return [relative, test.fullName, index]
      })
    })
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  if (!cases.length || cases.length !== report.numPassedTests || report.numTotalTests !== cases.length)
    throw new Error('Case count mismatch')
  const metrics = Object.entries(coverage)
    .map(([filename, value]) => [
      filename === 'total' ? filename : path.relative(root, filename).split(path.sep).join('/'),
      Object.fromEntries(
        ['lines', 'statements', 'functions', 'branches'].map((key) => [
          key,
          {
            total: value[key].total,
            covered: value[key].covered,
            skipped: value[key].skipped,
          },
        ]),
      ),
    ])
    .sort((a, b) => a[0].localeCompare(b[0]))
  return {
    success: true,
    files: report.numPassedTestSuites,
    cases: cases.length,
    casesDigest: digest(cases),
    coverageDigest: digest(metrics),
    coverage: coverage.total,
  }
}

export function runnerEvidence() {
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpu: os.cpus()[0]?.model ?? 'unknown',
    cpuCount: os.cpus().length,
    memoryBytes: os.totalmem(),
  }
}

export function buildEvidence(root = process.cwd()) {
  const names = ['BUILD_ID', 'routes-manifest.json', 'build-manifest.json', 'server/app-paths-manifest.json']
  if (names.some((filename) => !existsSync(path.join(root, '.next', filename))))
    throw new Error('Build output incomplete')
  const routes = read(path.join(root, '.next/server/app-paths-manifest.json'))
  return {
    success: true,
    outputVerified: true,
    routes: Object.keys(routes).length,
    routesDigest: digest(Object.keys(routes).sort()),
  }
}

export function requireGate(needs, decisions) {
  if (needs.classify.result !== 'success') throw new Error('Classification failed')
  for (const job of ['ci-static', 'unit-tests', 'storybook-tests']) {
    if (needs[job].result !== (decisions.validation ? 'success' : 'skipped')) throw new Error('Validation gate failed')
  }
  if (needs['integration-tests'].result !== (decisions.integration ? 'success' : 'skipped'))
    throw new Error('Integration gate failed')
  if (needs['coverage-merge'].result !== 'success') throw new Error('Coverage merge failed')
  const builds = ['build-late', 'build-early'].map((job) => needs[job].result)
  const shouldBuild = decisions.buildRequired && decisions.validation
  if (
    shouldBuild
      ? builds.filter((result) => result === 'success').length !== 1 ||
        builds.some((result) => !['success', 'skipped'].includes(result))
      : builds.some((result) => result !== 'skipped')
  )
    throw new Error('Build gate failed')
  return {
    success: true,
    status: shouldBuild ? 'built' : 'skipped',
    reason: shouldBuild
      ? 'required-build-passed'
      : decisions.validation
        ? 'non-build-inputs'
        : 'existing-validation-skip',
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { values } = parseArgs({
    options: {
      kind: { type: 'string' },
      output: { type: 'string' },
      report: { type: 'string' },
      coverage: { type: 'string' },
    },
  })
  let result
  try {
    if (values.kind === 'runner') result = runnerEvidence()
    else if (values.kind === 'suite') result = suiteEvidence(read(values.report), read(values.coverage))
    else if (values.kind === 'build') result = buildEvidence()
    else if (values.kind === 'gate')
      result = requireGate(JSON.parse(process.env.DIAGNOSTIC_NEEDS), {
        validation: process.env.DIAGNOSTIC_VALIDATION === 'true',
        buildRequired: process.env.DIAGNOSTIC_BUILD_REQUIRED === 'true',
        integration: process.env.DIAGNOSTIC_INTEGRATION === 'true',
      })
    else throw new Error('Unknown evidence kind')
  } catch {
    result = {
      success: false,
      failureStage:
        values.kind === 'suite' ? 'suite-evidence' : values.kind === 'build' ? 'build-evidence' : 'gate-evidence',
    }
    process.exitCode = 1
  }
  mkdirSync(path.dirname(values.output), { recursive: true })
  writeFileSync(values.output, `${JSON.stringify(result, null, 2)}\n`)
}

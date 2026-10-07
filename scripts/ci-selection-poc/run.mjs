import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createPlan } from './plan.mjs'
import { validateRun } from './results.mjs'

const args = process.argv.slice(2)
const arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback)
const topic = arg('--topic')
const variant = arg('--variant')
const output = path.resolve(arg('--output', 'tmp/ci-selection-poc/run'))
mkdirSync(output, { recursive: true })
const plan = createPlan(topic, variant)
if (topic === 'e2e' || plan.execution.mode === 'skip') throw new Error('No test worker required for this decision')
const started = performance.now()
const config = 'vitest.ci-selection-poc.config.ts'
const discovery = path.join(output, 'discovery.json')
const coverageDir = path.join(output, 'coverage')
const reportFile = path.join(output, 'tests.json')
const env = {
  ...process.env,
  NODE_ENV: 'test',
  CI_SELECTION_SUBSET: String(plan.coverageContract === 'partial-diagnostic'),
  CI_SELECTION_REPORT: reportFile,
  CI_SELECTION_COVERAGE: coverageDir,
}
const run = (commandArgs) => {
  const result = spawnSync('pnpm', ['exec', 'vitest', ...commandArgs], { env, stdio: 'inherit' })
  if (result.status !== 0) throw new Error('Vitest command failed')
}
const receipt = {
  version: 1,
  topic,
  variant,
  round: Number(arg('--round', '1')),
  scenario: plan.scenario,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  node: process.version,
  pnpm: execFileSync('pnpm', ['--version'], { encoding: 'utf8' }).trim(),
  topology: 'one-serial-runner',
  mode: plan.execution.mode,
  reasons: plan.execution.reasons,
  coverageContract: plan.coverageContract,
  hardware: { cpu: os.cpus()[0]?.model, cpus: os.cpus().length, memoryBytes: os.totalmem() },
  status: 'failure',
  expectedFiles: [],
}
try {
  run(['list', '--config', config, '--project', topic, '--filesOnly', `--json=${discovery}`])
  const entries = JSON.parse(readFileSync(discovery, 'utf8'))
  const all = entries
    .map((entry) => (typeof entry === 'string' ? entry : entry.file))
    .map((file) => (path.isAbsolute(file) ? path.relative(process.cwd(), file) : file))
    .map((file) => file.split(path.sep).join('/'))
    .sort()
  if (!all.length || new Set(all).size !== all.length) throw new Error('Invalid discovery')
  receipt.expectedFiles = plan.execution.mode === 'selected' ? [...plan.execution.files].sort() : all
  if (receipt.expectedFiles.some((file) => !all.includes(file))) throw new Error('Unknown selected test file')
  if (topic === 'integration' && all.length !== 98) throw new Error('Unexpected full integration inventory')
  if (plan.execution.mode === 'selected') {
    const selectedDiscovery = path.join(output, 'selected-discovery.json')
    run([
      'list',
      '--config',
      config,
      '--project',
      topic,
      '--filesOnly',
      `--json=${selectedDiscovery}`,
      ...receipt.expectedFiles,
    ])
    const selected = JSON.parse(readFileSync(selectedDiscovery, 'utf8'))
      .map((entry) => (typeof entry === 'string' ? entry : entry.file))
      .map((file) => (path.isAbsolute(file) ? path.relative(process.cwd(), file) : file))
      .map((file) => file.split(path.sep).join('/'))
      .sort()
    if (JSON.stringify(selected) !== JSON.stringify(receipt.expectedFiles))
      throw new Error('Positional filter differs from manifest')
  }
  run([
    'run',
    '--config',
    config,
    '--project',
    topic,
    '--coverage',
    '--reporter=default',
    '--reporter=./scripts/ci-selection-poc/reporter.mjs',
    ...(plan.execution.mode === 'selected' ? receipt.expectedFiles : []),
  ])
  receipt.report = JSON.parse(readFileSync(reportFile, 'utf8'))
  receipt.coverage = JSON.parse(readFileSync(path.join(coverageDir, 'coverage-summary.json'), 'utf8'))
  receipt.status = 'success'
  validateRun(receipt)
  if (
    topic === 'integration' &&
    variant === 'baseline' &&
    receipt.report.modules.flatMap((module) => module.tests).length !== 877
  )
    throw new Error('Unexpected full case count')
} catch (error) {
  receipt.status = 'failure'
  receipt.failure = error.message
  if (existsSync(reportFile)) receipt.report = JSON.parse(readFileSync(reportFile, 'utf8'))
  process.exitCode = 1
} finally {
  receipt.processSeconds = (performance.now() - started) / 1000
  writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2))
}

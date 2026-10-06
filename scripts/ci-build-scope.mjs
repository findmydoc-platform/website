import { createHash } from 'node:crypto'
import { appendFileSync, readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { parse } from 'yaml'

const root = path.resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)
// Match the pinned dorny action rather than the newer picomatch used by other tooling.
const picomatch = require(
  path.join(realpathSync(path.join(root, 'node_modules')), '.pnpm/picomatch@2.3.2/node_modules/picomatch'),
)
const hash = (value) => createHash('sha256').update(value).digest('hex')
const source = readFileSync(path.join(root, '.github/workflows/deploy.yml'), 'utf8')
export const workflowDigest = hash(source)
const workflow = parse(source)
const step = workflow.jobs.paths.steps.find((item) => item.id === 'filter')
if (
  step.uses !== 'dorny/paths-filter@fbd0ab8f3e69293af611ebaee6363fc25e6d187d' ||
  (step.with['predicate-quantifier'] ?? 'some') !== 'some'
)
  throw new Error('Unsupported source path-filter semantics.')
if (
  workflow.jobs.paths.outputs.validation.replace(/\s/g, '') !==
  "${{steps.filter.outputs.changed=='false'||steps.filter.outputs.non_markdown=='true'}}"
)
  throw new Error('Unsupported source validation expression.')
// Capture and compile the source once. Neither later disk edits nor caller changes affect this snapshot.
const sourceMatchers = Object.fromEntries(
  ['changed', 'non_markdown', 'deployable', 'integration'].map((name) => {
    const patterns = parse(step.with.filters)[name]
    if (!Array.isArray(patterns) || !patterns.length || !patterns.every((pattern) => typeof pattern === 'string'))
      throw new Error('Unsupported source filter rules.')
    return [name, patterns.map((pattern) => picomatch(pattern, { dot: true }))]
  }),
)

export const scenarios = Object.freeze({
  docs: Object.freeze(['README.md', 'docs/engineering/ci-optimization-results.md']),
  tests: Object.freeze(['tests/unit/example.test.ts']),
  metadata: Object.freeze(['.github/ISSUE_TEMPLATE/bug_report.yml', '.secrets.baseline']),
  runtime: Object.freeze(['src/app/(frontend)/page.tsx']),
})
export const fixtures = scenarios

export function filesFingerprint(files) {
  return hash(JSON.stringify([...new Set(files)].sort()))
}

function safePath(filename) {
  return (
    typeof filename === 'string' &&
    filename.length > 0 &&
    filename.length <= 4096 &&
    !/[\x00-\x1f\x7f\\]/.test(filename) &&
    !filename.startsWith('/') &&
    !/^[a-zA-Z]:/.test(filename) &&
    filename.split('/').every((part) => part && part !== '.' && part !== '..')
  )
}

function candidateNeedsBuild(filename) {
  // Executable CI helpers stay relevant even alongside non-executable metadata.
  if (filename.startsWith('.github/scripts/')) return !filename.endsWith('.md')
  if (filename.endsWith('.md')) return false
  if (filename.startsWith('docs/'))
    return !/\.(?:txt|rst|adoc|png|jpe?g|gif|webp|svg|pdf|csv|json|ya?ml)$/i.test(filename)
  // Workflow YAML can alter build commands or environment; pathname alone cannot prove it harmless.
  if (
    filename === '.secrets.baseline' ||
    filename === '.github/dependabot.yml' ||
    /^\.github\/ISSUE_TEMPLATE\/[^/]+\.ya?ml$/.test(filename)
  )
    return false
  if (
    filename.startsWith('.storybook/') ||
    filename.startsWith('src/stories/') ||
    /\.stories\.(?:ts|tsx|js|jsx|mdx)$/.test(filename)
  )
    return false
  if (filename.startsWith('tests/')) {
    // Setup affects the shared runtime; ordinary test cases do not feed the app compiler.
    return filename.startsWith('tests/setup/') || /(?:^|\/)(?:setup|globalSetup)(?:\.[^/]+)?$/.test(filename)
  }
  return true
}

/**
 * Accept untrusted manifests so runtime classification can fail closed on malformed input.
 * @param {{ files?: unknown, variant?: string, experiment?: string, classificationFailed?: boolean }} [options]
 */
export function classify({ files, variant = 'baseline', experiment = 'filter', classificationFailed = false } = {}) {
  if (!['baseline', 'candidate'].includes(variant)) throw new Error('Invalid variant.')
  if (!['filter', 'schedule'].includes(experiment)) throw new Error('Invalid experiment.')
  const validFiles = Array.isArray(files) && files.length > 0 && Array.from(files).every(safePath)
  const normalized = Array.isArray(files) ? [...new Set(files.filter(safePath))].sort() : []
  const failed = classificationFailed !== false
  const failClosed = failed || !validFiles
  const matches = Object.fromEntries(
    Object.entries(sourceMatchers).map(([name, matchers]) => [
      name,
      normalized.some((filename) => matchers.some((match) => match(filename))),
    ]),
  )
  const validation = failClosed || experiment === 'schedule' || !matches.changed || matches.non_markdown
  const integration = failClosed || experiment === 'schedule' || (validation && matches.integration)
  const buildRequired =
    failClosed ||
    experiment === 'schedule' ||
    (validation && (variant === 'baseline' ? matches.deployable : normalized.some(candidateNeedsBuild)))
  return {
    schemaVersion: 1,
    variant,
    experiment,
    files: normalized,
    filesDigest: filesFingerprint(normalized),
    workflowDigest,
    success: !failed,
    failureReason: failed ? 'classification' : null,
    failClosed,
    validation,
    buildRequired,
    integration,
    sourceFilters: matches,
    dependencies: { static: validation, unit: validation, storybook: validation },
    // Classification failure must fail static checks before a dependent build can run.
    buildRunnable: !failed && validation && buildRequired,
  }
}

// Only fixed booleans, enums and digests may be appended to the Actions output file.
export function githubOutputs(decision) {
  if (
    !/^[a-f0-9]{64}$/.test(decision.filesDigest) ||
    !/^[a-f0-9]{64}$/.test(decision.workflowDigest) ||
    !['baseline', 'candidate'].includes(decision.variant) ||
    !['filter', 'schedule'].includes(decision.experiment) ||
    ![null, 'classification', 'static'].includes(decision.failureReason)
  )
    throw new Error('Unsafe decision outputs.')
  const booleans = {
    validation: decision.validation,
    build_required: decision.buildRequired,
    integration: decision.integration,
    success: decision.success,
    classification_failed: decision.failureReason === 'classification',
    static_failed: decision.failureReason === 'static',
    fail_closed: decision.failClosed,
    build_runnable: decision.buildRunnable,
  }
  if (!Object.values(booleans).every((value) => typeof value === 'boolean')) throw new Error('Unsafe decision outputs.')
  const values = {
    ...booleans,
    files_digest: decision.filesDigest,
    workflow_digest: decision.workflowDigest,
    variant: decision.variant,
    experiment: decision.experiment,
    failure_reason: decision.failureReason ?? 'none',
  }
  return Object.entries(values)
    .map(([key, value]) => `${key}=${value}\n`)
    .join('')
}

export function scenarioDecision({ scenario, variant = 'baseline', experiment = 'filter', failure = 'none' }) {
  if (!Object.hasOwn(scenarios, scenario)) throw new Error('Invalid scenario.')
  if (!['none', 'classification', 'static'].includes(failure)) throw new Error('Invalid failure.')
  const decision = classify({
    files: scenarios[scenario],
    variant,
    experiment,
    classificationFailed: failure === 'classification',
  })
  // The workflow injects the static failure later; scope classification and early-build routing succeed.
  if (failure === 'static') return { ...decision, failureReason: 'static' }
  return decision
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({
      options: {
        scenario: { type: 'string' },
        variant: { type: 'string', default: 'baseline' },
        experiment: { type: 'string', default: 'filter' },
        failure: { type: 'string', default: 'none' },
      },
    })
    const decision = scenarioDecision(values)
    const round = Number(process.env.DIAGNOSTIC_ROUND ?? '1')
    const commit = process.env.GITHUB_SHA ?? null
    if (![1, 2, 3].includes(round) || (commit !== null && !/^[a-fA-F0-9]{40}$/.test(commit)))
      throw new Error('Invalid diagnostic provenance.')
    const receipt = { ...decision, scenario: values.scenario, failure: values.failure, round, commit }
    // Flush the receipt first, including controlled failures and output-file write failures.
    await new Promise((resolve, reject) => {
      process.stdout.write(JSON.stringify(receipt, null, 2) + '\n', (error) => (error ? reject(error) : resolve()))
    })
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, githubOutputs(decision))
    process.exitCode = decision.success ? 0 : 1
  } catch {
    console.error('Build scope classification failed; inputs or frozen source semantics are invalid.')
    process.exitCode = 1
  }
}

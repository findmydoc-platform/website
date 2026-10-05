import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { filesUnder } from './ci-shard-diagnostics.mjs'
import thresholds from '../config/coverage/vitest.thresholds.integration.js'

const read = (filename) => JSON.parse(readFileSync(filename, 'utf8'))
const categories = ['lines', 'statements', 'functions', 'branches']

export function validateReports(reports) {
  const files = new Set()
  const tests = new Set()
  for (const report of reports) {
    if (report.reason !== 'passed' || report.unhandledErrors !== 0) throw new Error('A test report is unsuccessful.')
    for (const testModule of report.modules) {
      if (files.has(testModule.filename)) throw new Error('A test file was executed more than once.')
      files.add(testModule.filename)
      for (const test of testModule.tests) {
        if (tests.has(test.id)) throw new Error('A test case was executed more than once.')
        if (test.state !== 'passed' || test.retries !== 0)
          throw new Error('A test failed, was skipped, or required a retry.')
        tests.add(test.id)
      }
    }
  }
  if (!files.size || !tests.size) throw new Error('An empty test selection is invalid.')
  return { files: [...files].sort(), tests: [...tests].sort() }
}

export function compareVariants(baseline, candidate, baselineCoverage, candidateCoverage, enforceThresholds = true) {
  const expected = validateReports(baseline)
  const actual = validateReports(candidate)
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('Test selection differs from the baseline.')
  const coverageFiles = (coverage) =>
    Object.keys(coverage)
      .filter((key) => key !== 'total')
      .map((key) => key.replace(/^.*\/(src\/|apps\/)/, '$1'))
      .sort()
  if (JSON.stringify(coverageFiles(baselineCoverage)) !== JSON.stringify(coverageFiles(candidateCoverage)))
    throw new Error('Coverage file selection differs.')
  for (const category of categories) {
    for (const field of ['total', 'covered', 'skipped']) {
      if (baselineCoverage.total[category][field] !== candidateCoverage.total[category][field])
        throw new Error('Coverage totals differ from the baseline.')
    }
    if (enforceThresholds && candidateCoverage.total[category].pct < thresholds.test.coverage.thresholds[category])
      throw new Error('Full-suite coverage threshold failed.')
  }
  return expected
}

export function distribution(values) {
  if (!values.length || values.some((value) => !Number.isFinite(value)))
    throw new Error('Measurements must be finite and nonempty.')
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return {
    median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    min: sorted[0],
    max: sorted.at(-1),
  }
}

function totals(reports, processes, merge) {
  const modules = reports.flatMap((report) => report.modules)
  return {
    processMs:
      processes.reduce((sum, record) => sum + record.wallMs + (record.cleanupMs ?? 0), 0) + (merge?.wallMs ?? 0),
    moduleMs: modules.reduce((sum, testModule) => sum + testModule.durationMs, 0),
    collectMs: modules.reduce((sum, testModule) => sum + testModule.collectMs, 0),
    setupMs: modules.reduce((sum, testModule) => sum + testModule.setupMs, 0),
    hookMs: modules.reduce((sum, testModule) => sum + testModule.hookMs, 0),
    cpuSeconds: processes.reduce(
      (sum, record) => sum + (record.userCpuSeconds ?? 0) + (record.systemCpuSeconds ?? 0),
      0,
    ),
    files: modules.map(({ filename, durationMs, collectMs, hookMs }) => ({ filename, durationMs, collectMs, hookMs })),
    phases: processes.map(({ phases }) => phases),
    elapsedMs:
      processes.length === 1
        ? processes[0].wallMs
        : new Date(merge?.endedAt ?? processes.at(-1).endedAt) - new Date(processes[0].startedAt),
  }
}

export function analyzeRound(directory) {
  const runs = filesUnder(directory)
    .filter((filename) => path.basename(filename) === 'run.json')
    .map((filename) => ({ filename, data: read(filename) }))
  if (!runs.length || runs.some(({ data }) => !data.valid))
    throw new Error('A required measurement is missing or invalid.')
  for (const field of ['commit', 'sourceFingerprint', 'round', 'stage', 'node']) {
    if (new Set(runs.map(({ data }) => data[field])).size !== 1) throw new Error(`Measurements disagree on ${field}.`)
  }
  const stage = runs[0].data.stage
  if (stage === 'smoke') {
    const filename = path.join(path.dirname(runs[0].filename), 'smoke-0/metrics.json')
    const selection = validateReports([read(filename)])
    return {
      stage,
      round: runs[0].data.round,
      commit: runs[0].data.commit,
      sourceFingerprint: runs[0].data.sourceFingerprint,
      selection,
      variants: {},
    }
  }
  /** @type {Record<string, ReturnType<typeof totals>>} */
  const variants = {}
  const reports = {}
  const coverage = {}
  for (const variant of stage === 'pilot' ? ['A', 'B'] : ['A', 'B', 'C']) {
    const items = runs
      .flatMap(({ filename, data }) =>
        data.results
          .filter((item) => item.variant === variant)
          .map((item) => ({ item, directory: path.join(path.dirname(filename), `${variant}-${item.shard}`) })),
      )
      .sort((a, b) => a.item.shard - b.item.shard)
    const expected = variant === 'A' ? [0] : [1, 2, 3, 4]
    if (JSON.stringify(items.map(({ item }) => item.shard)) !== JSON.stringify(expected))
      throw new Error('Every required shard must be present exactly once.')
    if (items.some(({ item }) => item.code !== 0 || item.timedOut || item.aborted)) throw new Error('A process failed.')
    reports[variant] = items.map(({ directory }) => read(path.join(directory, 'metrics.json')))
    const mergeFile =
      variant === 'A'
        ? null
        : filesUnder(directory).find((filename) => filename.endsWith(`/${variant}-merged/process.json`))
    if (variant !== 'A' && !mergeFile) throw new Error('A required native merge is missing.')
    const merge = mergeFile ? read(mergeFile) : null
    if (merge && merge.code !== 0) throw new Error('A native merge failed.')
    const coverageDirectory = variant === 'A' ? items[0].directory : path.dirname(mergeFile)
    coverage[variant] = read(path.join(coverageDirectory, 'coverage/coverage-summary.json'))
    variants[variant] = totals(
      reports[variant],
      items.map(({ item }) => item),
      merge,
    )
    if (variant === 'C')
      variants[variant].elapsedMs =
        new Date(merge.endedAt) -
        new Date(
          items.reduce(
            (first, entry) => (entry.item.startedAt < first ? entry.item.startedAt : first),
            items[0].item.startedAt,
          ),
        )
  }
  let selection
  for (const variant of ['B', ...(stage === 'full' ? ['C'] : [])])
    selection = compareVariants(reports.A, reports[variant], coverage.A, coverage[variant], stage === 'full')
  return {
    stage,
    round: runs[0].data.round,
    commit: runs[0].data.commit,
    sourceFingerprint: runs[0].data.sourceFingerprint,
    selection,
    variants,
    coverage: coverage.A.total,
  }
}

export function renderSummary(rounds) {
  if (!rounds.length) throw new Error('At least one round is required.')
  if (new Set(rounds.map((round) => `${round.commit}:${round.sourceFingerprint}:${round.stage}`)).size !== 1)
    throw new Error('Rounds have different source or stage.')
  if (new Set(rounds.map((round) => round.round)).size !== rounds.length)
    throw new Error('A round was supplied more than once.')
  if (rounds.some((round) => JSON.stringify(round.selection) !== JSON.stringify(rounds[0].selection)))
    throw new Error('Test selections differ between rounds.')
  const seconds = (ms) => (ms / 1000).toFixed(2)
  const lines = [
    '# Integration shard diagnostics',
    '',
    `Commit: \`${rounds[0].commit}\`. Stage: ${rounds[0].stage}. Repetitions: ${rounds.length}.`,
    '',
    `Matched files: ${rounds[0].selection.files.length}. Matched test cases: ${rounds[0].selection.tests.length}.`,
    '',
    '| Variant | Process time median, seconds | Minimum | Maximum | Feedback median, seconds |',
    '| --- | ---: | ---: | ---: | ---: |',
  ]
  for (const variant of Object.keys(rounds[0].variants)) {
    const duration = distribution(rounds.map((round) => round.variants[variant].processMs))
    const feedback = distribution(rounds.map((round) => round.variants[variant].elapsedMs))
    lines.push(
      `| ${variant} | ${seconds(duration.median)} | ${seconds(duration.min)} | ${seconds(duration.max)} | ${seconds(feedback.median)} |`,
    )
  }
  lines.push(
    '',
    'Process time includes measured test processes, service cleanup and native merge. It excludes dependency installation and VM startup. CPU time covers the test process tree, not Docker containers. GitHub job timestamps are required for total runner usage.',
    '',
    'Module time includes tests and hooks. Collection includes imports and suite callbacks. Reporter hook intervals include event-delivery overhead and overlap module time; these columns must not be added together.',
    '',
    '| Variant | Module median, seconds | Collection median | Hooks median | CPU median, seconds |',
    '| --- | ---: | ---: | ---: | ---: |',
  )
  for (const variant of Object.keys(rounds[0].variants)) {
    const get = (key) => distribution(rounds.map((round) => round.variants[variant][key])).median
    lines.push(
      `| ${variant} | ${seconds(get('moduleMs'))} | ${seconds(get('collectMs'))} | ${seconds(get('hookMs'))} | ${get('cpuSeconds').toFixed(2)} |`,
    )
  }
  if (rounds[0].variants.B) {
    lines.push('', '| Round | B / A process time | B minus A, seconds |', '| --- | ---: | ---: |')
    for (const round of rounds)
      lines.push(
        `| ${round.round} | ${(round.variants.B.processMs / round.variants.A.processMs).toFixed(3)} | ${seconds(round.variants.B.processMs - round.variants.A.processMs)} |`,
      )
    const ranked = rounds[0].selection.files
      .map((filename) => {
        const delta = rounds.map(
          (round) =>
            round.variants.B.files.find((file) => file.filename === filename).durationMs -
            round.variants.A.files.find((file) => file.filename === filename).durationMs,
        )
        return { filename, delta: distribution(delta) }
      })
      .sort((a, b) => b.delta.median - a.delta.median)
    lines.push('', '| File | B minus A module median, seconds | Minimum | Maximum |', '| --- | ---: | ---: | ---: |')
    for (const file of ranked.slice(0, 15))
      lines.push(
        `| ${file.filename} | ${seconds(file.delta.median)} | ${seconds(file.delta.min)} | ${seconds(file.delta.max)} |`,
      )
  }
  lines.push(
    '',
    'These measurements identify repeatable phase and file differences. They do not by themselves prove why a phase is slower. Remaining hypotheses require targeted follow-up measurements.',
    '',
  )
  return lines.join('\n')
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: { input: { type: 'string', multiple: true }, output: { type: 'string' } } })
    if (!values.input?.length || !values.output) throw new Error('--input and --output are required.')
    const rounds = values.input.map((directory) => analyzeRound(path.resolve(directory)))
    writeFileSync(values.output, renderSummary(rounds))
    writeFileSync(`${values.output}.json`, JSON.stringify(rounds, null, 2))
    console.log(`Validated ${rounds.length} measurement round(s).`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

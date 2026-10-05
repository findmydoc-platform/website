import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { filesUnder } from './ci-shard-diagnostics.mjs'
import { compareVariants, distribution, validateReports } from './ci-shard-summary.mjs'
import { hookFiles, validateHookMeasurement } from './ci-shard-hook-validation.mjs'

const read = (filename) => JSON.parse(readFileSync(filename, 'utf8'))
export const readPhaseEvents = (filename) =>
  readFileSync(filename, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))

export function analyzeHookRounds(directory, partial = false) {
  const runs = filesUnder(directory)
    .filter((filename) => path.basename(filename) === 'run.json')
    .map((filename) => ({ filename, data: read(filename) }))
    .sort((a, b) => a.data.round - b.data.round)
  const expected =
    partial && runs.length > 0 && runs.length <= 3
      ? Array.from({ length: runs.length }, (_, index) => index + 1)
      : [1, 2, 3]
  if (JSON.stringify(runs.map(({ data }) => data.round)) !== JSON.stringify(expected))
    throw new Error('Three complete hook repetitions are required exactly once.')
  for (const field of ['commit', 'sourceFingerprint', 'node', 'cpus', 'totalMemoryBytes']) {
    if (new Set(runs.map(({ data }) => JSON.stringify(data[field]))).size !== 1)
      throw new Error(`Hook measurements disagree on ${field}.`)
  }
  let baseline
  return runs.map(({ filename, data }) => {
    if (!data.valid || data.stage !== 'hooks' || data.results.length !== 1)
      throw new Error('A hook measurement is invalid.')
    const process = data.results[0]
    if (process.variant !== 'H' || process.shard !== 0 || process.code !== 0 || process.timedOut || process.aborted)
      throw new Error('A hook test process failed.')
    const target = path.join(path.dirname(filename), 'H-0')
    const metrics = read(path.join(target, 'metrics.json'))
    const coverage = read(path.join(target, 'coverage/coverage-summary.json'))
    const files = validateHookMeasurement(
      metrics,
      readPhaseEvents(path.join(target, 'phases.jsonl')),
      hookFiles(data.round),
    )
    const selection = validateReports([metrics])
    if (baseline) compareVariants([baseline.metrics], [metrics], baseline.coverage, coverage, false)
    else baseline = { metrics, coverage }
    return {
      round: data.round,
      commit: data.commit,
      sourceFingerprint: data.sourceFingerprint,
      node: data.node,
      cpus: data.cpus,
      totalMemoryBytes: data.totalMemoryBytes,
      selection,
      files,
      process,
    }
  })
}

export function renderHookSummary(rounds) {
  const seconds = (ms) => (ms / 1000).toFixed(3)
  const lines = [
    '# BeforeAll phase diagnostics',
    '',
    `Commit: \`${rounds[0].commit}\`. Three serial repetitions on one VM. Matched test cases: 37.`,
    '',
    '| Round | Position | File | BeforeAll, s | Payload, s | Baseline check, s | Seed execution, s | Seed calls | Cache hits | Fixtures, s | Residual, s |',
    '| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ]
  for (const round of rounds) {
    for (const file of round.files) {
      lines.push(
        `| ${round.round} | ${file.position} | ${file.filename} | ${seconds(file.hookMs)} | ${seconds(file.phases['payload-init'])} | ${seconds(file.phases['baseline-check'])} | ${seconds(file.seedMs)} | ${file.seedCalls} | ${file.cacheHits} | ${seconds(file.phases.fixtures)} | ${seconds(file.residualMs)} |`,
      )
    }
  }
  lines.push('', '| File | Phase | Median, s | Minimum, s | Maximum, s |', '| --- | --- | ---: | ---: | ---: |')
  for (const filename of hookFiles()) {
    for (const phase of ['payload-init', 'baseline-check', 'fixtures']) {
      const values = distribution(
        rounds.map((round) => round.files.find((file) => file.filename === filename).phases[phase]),
      )
      lines.push(
        `| ${filename} | ${phase} | ${seconds(values.median)} | ${seconds(values.min)} | ${seconds(values.max)} |`,
      )
    }
  }
  lines.push(
    '',
    'Seed execution is nested inside baseline check and must not be added to it. Residual is beforeAll minus the three outer phases, including instrumentation bookkeeping.',
    '',
    'Each repetition rebuilds the empty database template, uses fresh services and a new Vitest process, and deletes the Vite cache. Dependencies, OS page caches and Docker images remain on the same VM. Test isolation and V8 coverage instrumentation are unchanged.',
    '',
    'This sample diagnoses three selected files. It does not establish whole-suite savings, Payload reuse safety, or baseline-template compatibility.',
    '',
  )
  return lines.join('\n')
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({
      options: { input: { type: 'string' }, output: { type: 'string' }, partial: { type: 'boolean', default: false } },
    })
    if (!values.input || (!values.partial && !values.output))
      throw new Error('--input and final --output are required.')
    const rounds = analyzeHookRounds(path.resolve(values.input), values.partial)
    if (!values.partial) {
      writeFileSync(values.output, renderHookSummary(rounds))
      writeFileSync(`${values.output}.json`, JSON.stringify(rounds, null, 2))
    }
    console.log(`Validated ${rounds.length} hook measurement repetition(s).`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

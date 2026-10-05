import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { filesUnder } from './ci-shard-diagnostics.mjs'
import { compareVariants, distribution, validateReports } from './ci-shard-summary.mjs'
import thresholds from '../config/coverage/vitest.thresholds.integration.js'
import { extendedCopyStages, validateCopySelection } from './ci-shard-db-copy-selection.mjs'
import { hookFiles, validateHookMeasurement } from './ci-shard-hook-validation.mjs'
import { readPhaseEvents } from './ci-shard-hook-summary.mjs'

const read = (filename) => JSON.parse(readFileSync(filename, 'utf8'))

export function validateCopyCoverage(baseline, candidate, full = false) {
  const names = (report) =>
    Object.keys(report)
      .filter((key) => key !== 'total')
      .map((key) => key.replace(/^.*\/(src\/|apps\/)/, '$1'))
      .sort()
  if (JSON.stringify(names(baseline)) !== JSON.stringify(names(candidate)))
    throw new Error('Coverage file selection differs.')
  for (const category of ['lines', 'statements', 'functions', 'branches']) {
    const a = baseline.total[category],
      b = candidate.total[category]
    if (a.total !== b.total || b.covered < a.covered || b.skipped !== a.skipped)
      throw new Error(`Instrumented baseline copy coverage regresses for ${category}.`)
    if (
      full &&
      (a.pct < thresholds.test.coverage.thresholds[category] || b.pct < thresholds.test.coverage.thresholds[category])
    )
      throw new Error('Existing full-suite integration coverage threshold failed.')
  }
}

export function analyzeCopyRounds(directory, partial = false) {
  const runs = filesUnder(directory)
    .filter((file) => path.basename(file) === 'run.json')
    .map((filename) => ({ filename, data: read(filename) }))
    .sort((a, b) => a.data.round - b.data.round)
  const count = partial ? runs.length : 3
  if (
    count < 1 ||
    count > 3 ||
    JSON.stringify(runs.map(({ data }) => data.round)) !==
      JSON.stringify(Array.from({ length: count }, (_, index) => index + 1))
  )
    throw new Error('Complete consecutive database copy pairs are required.')
  for (const field of ['stage', 'commit', 'sourceFingerprint', 'node', 'cpus', 'totalMemoryBytes']) {
    if (new Set(runs.map(({ data }) => JSON.stringify(data[field]))).size !== 1)
      throw new Error(`Database copy measurements disagree on ${field}.`)
  }
  const previous = {}
  return runs.map(({ filename, data }) => {
    const order = data.round === 2 ? ['E', 'D'] : ['D', 'E']
    if (
      !data.valid ||
      !['db-copy', ...extendedCopyStages].includes(data.stage) ||
      JSON.stringify(data.results.map((item) => item.variant)) !== JSON.stringify(order)
    )
      throw new Error('Database copy pair is invalid or out of order.')
    const variants = {}
    for (const variant of order) {
      const process = data.results.find((item) => item.variant === variant)
      if (
        process.shard !== 0 ||
        process.code !== 0 ||
        process.timedOut ||
        process.aborted ||
        !Number.isFinite(process.wallMs) ||
        !Number.isFinite(process.cleanupMs)
      )
        throw new Error('A database copy process failed or lacks complete timings.')
      const target = path.join(path.dirname(filename), `${variant}-0`)
      const metrics = read(path.join(target, 'metrics.json'))
      const extended = extendedCopyStages.includes(data.stage)
      const coverage = read(
        path.join(
          target,
          extended && variant === 'E' ? 'seed-merged/coverage/coverage-summary.json' : 'coverage/coverage-summary.json',
        ),
      )
      if (extended) validateCopySelection(metrics, data.stage, data.round)
      const files = extended
        ? []
        : validateHookMeasurement(metrics, readPhaseEvents(path.join(target, 'phases.jsonl')), hookFiles(data.round))
      const selection = validateReports([metrics])
      if (!extended && files.reduce((sum, file) => sum + file.seedCalls, 0) !== (variant === 'D' ? 3 : 0))
        throw new Error('Database copy seed decisions differ from the protocol.')
      const copies = variant === 'E' ? readPhaseEvents(path.join(target, 'copies.jsonl')) : []
      if (
        variant === 'E' &&
        (copies.length !== metrics.modules.length ||
          copies.some(
            (item) =>
              item.status !== 'passed' ||
              (extended && item.isolationVerified !== true) ||
              !Number.isFinite(item.durationMs) ||
              item.durationMs < 0,
          ))
      )
        throw new Error(
          'Three successful per-file database copies are required for the original sample; expanded runs require one verified copy per selected file.',
        )
      if (extended && variant === 'E') {
        const seed = read(path.join(target, 'template-seed/metrics.json'))
        validateReports([seed])
        if (seed.modules.length !== 1 || seed.modules[0].tests.length !== 1)
          throw new Error('Exactly one instrumented template seed case is required.')
        const merge = read(path.join(target, 'seed-merged/process.json'))
        if (
          merge.code !== 0 ||
          merge.timedOut ||
          merge.aborted ||
          !Number.isFinite(process.mergeMs) ||
          merge.wallMs !== process.mergeMs
        )
          throw new Error('Native seed coverage merge is missing or invalid.')
      }
      if (previous[variant])
        compareVariants([previous[variant].metrics], [metrics], previous[variant].coverage, coverage, false)
      previous[variant] = { metrics, coverage }
      variants[variant] = {
        selection,
        files,
        process,
        coverage,
        totalMs: process.wallMs + process.cleanupMs + (process.mergeMs ?? 0),
        copyMs: copies.reduce((sum, copy) => sum + copy.durationMs, 0),
      }
    }
    if (JSON.stringify(variants.D.selection) !== JSON.stringify(variants.E.selection))
      throw new Error('Test selection differs between database copy variants.')
    if (extendedCopyStages.includes(data.stage))
      validateCopyCoverage(variants.D.coverage, variants.E.coverage, data.stage === 'db-copy-suite')
    return {
      stage: data.stage,
      round: data.round,
      commit: data.commit,
      variants,
      savedMs: variants.D.totalMs - variants.E.totalMs,
    }
  })
}

export function renderCopySummary(rounds) {
  const seconds = (ms) => (ms / 1000).toFixed(3)
  const lines = [
    '# Serial baseline database copy comparison',
    '',
    `Commit: \`${rounds[0].commit}\`. Repetitions: ${rounds.length}. Matched files: ${rounds[0].variants.D.selection.files.length}. Matched cases per variant: ${rounds[0].variants.D.selection.tests.length}.`,
    '',
    '| Round | Empty + file seeds, s | Baseline + file copies, s | Saved, s | Copies, s |',
    '| --- | ---: | ---: | ---: | ---: |',
  ]
  for (const round of rounds)
    lines.push(
      `| ${round.round} | ${seconds(round.variants.D.totalMs)} | ${seconds(round.variants.E.totalMs)} | ${seconds(round.savedMs)} | ${seconds(round.variants.E.copyMs)} |`,
    )
  lines.push(
    '',
    `Median paired savings: ${seconds(distribution(rounds.map((round) => round.savedMs)).median)} seconds.`,
    '',
    'Times include cold service startup, migrations, template preparation, baseline seeding, all per-file copies, V8-instrumented test execution, reporting and service cleanup. Dependencies and Docker images remain on the same VM. Pair order reverses in round 2; file order rotates.',
    '',
    rounds[0].stage !== 'db-copy'
      ? 'Template seeding runs once under Vitest. Its native blob and the copy test blob are merged, with merge time included. Coverage must repeat within each variant and must not decrease against the baseline; complete-suite runs also enforce the existing integration thresholds.'
      : 'Coverage is retained and must repeat within each variant. Seeding outside Vitest removes incidental seed-triggered coverage from the copy variant; coverage deltas below are reported, not treated as equivalence. Normal integration CI and its thresholds remain unchanged.',
    '',
    '| Round | Metric | Empty covered / total | Copy covered / total |',
    '| --- | --- | ---: | ---: |',
  )
  for (const round of rounds)
    for (const metric of ['lines', 'statements', 'functions', 'branches']) {
      const a = round.variants.D.coverage.total[metric],
        b = round.variants.E.coverage.total[metric]
      lines.push(`| ${round.round} | ${metric} | ${a.covered} / ${a.total} | ${b.covered} / ${b.total} |`)
    }
  lines.push(
    '',
    rounds[0].stage === 'db-copy-suite'
      ? 'This complete-suite comparison measures serial compatibility and paired savings at the recorded commit. SQL isolation is verified per file; S3Mock remains shared and existing fixture cleanup still runs.'
      : 'This sample does not establish whole-suite compatibility or savings. Database copies isolate SQL rows; S3Mock remains shared within each variant and existing fixture cleanup still runs.',
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
    const rounds = analyzeCopyRounds(path.resolve(values.input), values.partial)
    if (values.output) {
      writeFileSync(values.output, renderCopySummary(rounds))
      writeFileSync(`${values.output}.json`, JSON.stringify(rounds, null, 2))
    }
    console.log(`Validated ${rounds.length} database copy pair(s).`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

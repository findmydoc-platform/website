import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { filesUnder } from './ci-shard-diagnostics.mjs'
import { compareVariants, distribution, validateReports } from './ci-shard-summary.mjs'
import { hookFiles, validateHookMeasurement } from './ci-shard-hook-validation.mjs'
import { readPhaseEvents } from './ci-shard-hook-summary.mjs'

const read = (filename) => JSON.parse(readFileSync(filename, 'utf8'))

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
  for (const field of ['commit', 'sourceFingerprint', 'node', 'cpus', 'totalMemoryBytes']) {
    if (new Set(runs.map(({ data }) => JSON.stringify(data[field]))).size !== 1)
      throw new Error(`Database copy measurements disagree on ${field}.`)
  }
  const previous = {}
  return runs.map(({ filename, data }) => {
    const order = data.round === 2 ? ['E', 'D'] : ['D', 'E']
    if (
      !data.valid ||
      data.stage !== 'db-copy' ||
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
      const coverage = read(path.join(target, 'coverage/coverage-summary.json'))
      const files = validateHookMeasurement(
        metrics,
        readPhaseEvents(path.join(target, 'phases.jsonl')),
        hookFiles(data.round),
      )
      const selection = validateReports([metrics])
      if (files.reduce((sum, file) => sum + file.seedCalls, 0) !== (variant === 'D' ? 3 : 0))
        throw new Error('Database copy seed decisions differ from the protocol.')
      const copies = variant === 'E' ? readPhaseEvents(path.join(target, 'copies.jsonl')) : []
      if (
        variant === 'E' &&
        (copies.length !== 3 ||
          copies.some((item) => item.status !== 'passed' || !Number.isFinite(item.durationMs) || item.durationMs < 0))
      )
        throw new Error('Three successful per-file database copies are required.')
      if (previous[variant])
        compareVariants([previous[variant].metrics], [metrics], previous[variant].coverage, coverage, false)
      previous[variant] = { metrics, coverage }
      variants[variant] = {
        selection,
        files,
        process,
        coverage,
        totalMs: process.wallMs + process.cleanupMs,
        copyMs: copies.reduce((sum, copy) => sum + copy.durationMs, 0),
      }
    }
    if (JSON.stringify(variants.D.selection) !== JSON.stringify(variants.E.selection))
      throw new Error('Test selection differs between database copy variants.')
    return { round: data.round, commit: data.commit, variants, savedMs: variants.D.totalMs - variants.E.totalMs }
  })
}

export function renderCopySummary(rounds) {
  const seconds = (ms) => (ms / 1000).toFixed(3)
  const lines = [
    '# Serial baseline database copy comparison',
    '',
    `Commit: \`${rounds[0].commit}\`. Matched cases per variant: 37.`,
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
    'Coverage is retained and must repeat within each variant. Seeding outside Vitest removes incidental seed-triggered coverage from the copy variant; coverage deltas below are reported, not treated as equivalence. Normal integration CI and its thresholds remain unchanged.',
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
    'This three-file sample does not establish whole-suite compatibility or savings. Database copies isolate SQL rows; S3Mock remains shared within each variant and existing fixture cleanup still runs.',
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
    if (!values.partial) {
      writeFileSync(values.output, renderCopySummary(rounds))
      writeFileSync(`${values.output}.json`, JSON.stringify(rounds, null, 2))
    }
    console.log(`Validated ${rounds.length} database copy pair(s).`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

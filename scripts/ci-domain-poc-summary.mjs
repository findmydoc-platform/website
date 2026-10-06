import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateMeasurement } from './ci-domain-poc.mjs'

export function distribution(values) {
  if (!values.length || values.some((value) => !Number.isFinite(value)))
    throw new Error('No valid finite measurements.')
  const sorted = [...values].sort((a, b) => a - b),
    middle = Math.floor(sorted.length / 2)
  return {
    median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    min: sorted[0],
    max: sorted.at(-1),
    values,
  }
}
const identities = (receipt) =>
  Object.fromEntries(
    receipt.groups.map((group) => [
      group.name,
      group.report.modules.flatMap((item) => item.tests.map((test) => `${item.filename}:${test.name}`)).sort(),
    ]),
  )
export function comparePair(a, b, coverageA, coverageB) {
  validateMeasurement(a)
  validateMeasurement(b)
  if (
    a.variant !== 'baseline' ||
    b.variant !== 'candidate' ||
    ['commit', 'node', 'pnpm', 'experiment', 'group', 'scenario', 'round'].some((key) => a[key] !== b[key])
  )
    throw new Error('Pair provenance differs.')
  const left = identities(a),
    right = identities(b)
  for (const group of Object.keys(right)) {
    if (JSON.stringify(left[group]) !== JSON.stringify(right[group])) throw new Error('Test identities differ.')
    const first = coverageA[group],
      second = coverageB[group]
    if (!first || !second || JSON.stringify(Object.keys(first).sort()) !== JSON.stringify(Object.keys(second).sort()))
      throw new Error('Coverage scope differs.')
    for (const filename of Object.keys(first))
      for (const metric of ['lines', 'branches', 'functions', 'statements']) {
        if (
          first[filename][metric].total !== second[filename][metric].total ||
          first[filename][metric].covered !== second[filename][metric].covered
        )
          throw new Error('Coverage contract or hits differ.')
      }
  }
  if (a.experiment === 'config' && JSON.stringify(Object.keys(left)) !== JSON.stringify(Object.keys(right)))
    throw new Error('Configuration comparison workload differs.')
  return {
    durationSavingMs: a.durationMs - b.durationMs,
    avoidedCases: Object.keys(left)
      .filter((group) => !right[group])
      .reduce((sum, group) => sum + left[group].length, 0),
    sourceCommit: a.commit,
  }
}
export function summarize(directory) {
  const journal = JSON.parse(fs.readFileSync(path.join(directory, 'journal.json'), 'utf8'))
  const pairs = [],
    failures = [],
    uniqueRuns = new Map()
  for (const entry of journal.entries) {
    if (entry.runId && entry.actions) uniqueRuns.set(entry.runId, entry.actions)
    if (entry.error || entry.actions?.conclusion === 'failure')
      failures.push({ runId: entry.runId, error: entry.error ?? 'Actions failure' })
  }
  const coverage = (entry) =>
    Object.fromEntries(
      entry.receipt.groups.map((group) => [
        group.name,
        JSON.parse(
          fs.readFileSync(
            path.join(directory, String(entry.runId), 'measurement', group.name, 'coverage/coverage-summary.json'),
            'utf8',
          ),
        ),
      ]),
    )
  for (const baseline of journal.entries.filter((entry) => entry.variant === 'baseline' && entry.receipt)) {
    const candidate = journal.entries.find(
      (entry) =>
        entry.variant === 'candidate' &&
        entry.experiment === baseline.experiment &&
        entry.group === baseline.group &&
        entry.scenario === baseline.scenario &&
        entry.round === baseline.round &&
        entry.receipt,
    )
    if (!candidate) continue
    try {
      const comparison = comparePair(baseline.receipt, candidate.receipt, coverage(baseline), coverage(candidate))
      const workflowSeconds = (entry) =>
        (Date.parse(entry.actions.updated_at) - Date.parse(entry.actions.run_started_at)) / 1000
      pairs.push({
        experiment: baseline.experiment,
        group: baseline.group,
        scenario: baseline.scenario,
        round: baseline.round,
        baselineRunId: baseline.runId,
        candidateRunId: candidate.runId,
        ...comparison,
        workflowSavingSeconds: workflowSeconds(baseline) - workflowSeconds(candidate),
        runnerSavingSeconds: baseline.actions.runnerSeconds - candidate.actions.runnerSeconds,
        queueSeconds: [baseline.actions.queueSeconds, candidate.actions.queueSeconds],
        hardware: [baseline.hardware, candidate.hardware],
      })
    } catch (error) {
      failures.push({ runIds: [baseline.runId, candidate.runId], error: error.message })
    }
  }
  const aggregates = {}
  for (const pair of pairs) {
    const key = `${pair.experiment}/${pair.experiment === 'config' ? pair.group : pair.scenario}`
    aggregates[key] ??= []
    aggregates[key].push(pair)
  }
  return {
    pairs,
    failures,
    completedRuns: journal.entries.filter(
      (entry) => entry.receipt?.status === 'passed' && entry.actions?.conclusion === 'success',
    ).length,
    plannedRuns: journal.entries.length,
    costs: {
      uniqueRuns: uniqueRuns.size,
      runnerSeconds: [...uniqueRuns.values()].reduce((sum, run) => sum + run.runnerSeconds, 0),
    },
    aggregates: Object.fromEntries(
      Object.entries(aggregates).map(([key, values]) => [
        key,
        {
          pairs: values.length,
          workflowSavingSeconds: distribution(values.map((value) => value.workflowSavingSeconds)),
          runnerSavingSeconds: distribution(values.map((value) => value.runnerSavingSeconds)),
          durationSavingMs: distribution(values.map((value) => value.durationSavingMs)),
          avoidedCases: values.map((value) => value.avoidedCases),
        },
      ]),
    ),
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(JSON.stringify(summarize(process.argv[2]), null, 2))

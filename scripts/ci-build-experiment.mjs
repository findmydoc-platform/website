import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import { summarizeBuildRuns, measureBuildRun, renderBuildReport } from './ci-build-report.mjs'

const repository = 'findmydoc-platform/website'
const branch = 'agent/ci-shard-diagnostics'
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const gh = (args) => {
  const result = spawnSync('gh', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(`GitHub command failed: ${args[0]}`)
  return result.stdout
}
const json = (args) => JSON.parse(gh(args))
const jobsFor = (id) => {
  const pages = json(['api', `repos/${repository}/actions/runs/${id}/jobs?per_page=100`, '--paginate', '--slurp'])
  return pages.flatMap((page) => page.jobs)
}
const runs = () =>
  json([
    'run',
    'list',
    '--repo',
    repository,
    '--branch',
    branch,
    '--workflow',
    'ci-shard-diagnostics.yml',
    '--limit',
    '100',
    '--json',
    'databaseId,status,headSha,createdAt',
  ])
const write = (filename, value) => writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`)

export function experimentPlan() {
  const plan = []
  // The runtime control first checks the complete workload before expensive repetitions.
  for (const scenario of ['runtime', 'docs', 'tests', 'metadata'])
    for (let round = 1; round <= 3; round++)
      for (const variant of round === 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'])
        plan.push({ experiment: 'filter', scenario, round, variant, failure: 'none' })
  for (let round = 1; round <= 3; round++)
    for (const variant of round === 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'])
      plan.push({ experiment: 'schedule', scenario: 'runtime', round, variant, failure: 'none' })
  for (const failure of ['classification', 'static'])
    for (const variant of ['baseline', 'candidate'])
      plan.push({ experiment: 'schedule', scenario: 'runtime', round: 1, variant, failure })
  return plan
}

const key = (item) => [item.experiment, item.scenario, item.round, item.variant, item.failure].join('-')
const artifacts = (root) => {
  const evidence = { runners: {} }
  for (const name of readdirSync(root)) {
    const dir = path.join(root, name)
    if (!name.startsWith('build-')) continue
    for (const filename of readdirSync(dir))
      if (filename.endsWith('.json')) {
        if (filename.startsWith('runner-'))
          evidence.runners[filename.slice(7, -5)] = JSON.parse(readFileSync(path.join(dir, filename), 'utf8'))
        else if (filename === 'scope.json') evidence.scope = JSON.parse(readFileSync(path.join(dir, filename), 'utf8'))
        else if (filename.endsWith('-evidence.json'))
          evidence[filename.replace('-evidence.json', '')] = JSON.parse(readFileSync(path.join(dir, filename), 'utf8'))
        else if (filename === 'gate.json') evidence.gate = JSON.parse(readFileSync(path.join(dir, filename), 'utf8'))
      }
  }
  return evidence
}

export function matchesDispatch(item, measurement) {
  const scope = measurement.correctness?.scope
  return (
    !!scope &&
    scope.variant === item.variant &&
    scope.experiment === item.experiment &&
    scope.scenario === item.scenario &&
    scope.failure === item.failure &&
    scope.round === item.round &&
    scope.commit === measurement.commit
  )
}

export function validateFailureProbe(measurement) {
  const leaf = (name) => measurement.jobs.find((job) => job.name.split(' / ').at(-1) === name)
  if (measurement.run.conclusion !== 'failure') throw new Error('Controlled failure not visible')
  if (measurement.failure === 'classification') {
    if (leaf('Classify')?.conclusion !== 'failure') throw new Error('Wrong classification failure')
    for (const role of [
      'Static Checks',
      'Unit Tests',
      'Storybook Tests',
      'Build late',
      'Build early',
      'Integration Tests',
    ])
      if (leaf(role)?.conclusion !== 'skipped') throw new Error('Work escaped failed classification')
  } else if (measurement.failure === 'static') {
    if (leaf('Classify')?.conclusion !== 'success' || leaf('Static Checks')?.conclusion !== 'failure')
      throw new Error('Wrong static failure')
    const expected = measurement.variant === 'candidate' ? 'success' : 'skipped'
    if (leaf('Build early')?.conclusion !== expected || leaf('Build late')?.conclusion !== 'skipped')
      throw new Error('Unexpected failure build cost')
    for (const role of ['Unit Tests', 'Storybook Tests'])
      if (leaf(role)?.conclusion !== 'success') throw new Error('Unrelated validation failed')
    if (leaf('Integration Tests')?.conclusion !== 'skipped') throw new Error('Integration escaped failed static checks')
  } else throw new Error('Unknown failure probe')
  if (leaf('Build')?.conclusion !== 'failure') throw new Error('Final gate concealed failure')
  return true
}

export async function runExperiment({ commit, output, execute = false, stage = 'all' }) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Full frozen commit required')
  let plan = experimentPlan()
  if (stage === 'smoke')
    plan = plan.filter((item) => item.scenario === 'runtime' && item.experiment === 'filter' && item.round === 1)
  else if (stage !== 'all')
    plan = plan.filter((item) =>
      stage === 'failures' ? item.failure !== 'none' : item.experiment === stage && item.failure === 'none',
    )
  if (!plan.length) throw new Error('Unknown experiment stage')
  if (!execute) return { commit, plan, dryRun: true }
  mkdirSync(output, { recursive: true })
  const checkpoint = path.join(output, 'checkpoint.json')
  const state = existsSync(checkpoint) ? JSON.parse(readFileSync(checkpoint, 'utf8')) : { commit, entries: {} }
  if (state.commit !== commit) throw new Error('Mixed source commits')
  const previousSummary = summarizeBuildRuns(
    Object.values(state.entries).flatMap((entry) => (entry.measurement ? [entry.measurement] : [])),
  )
  if (
    previousSummary.groups.some((group) =>
      group.rows.some((row) => row.baselineRunId && row.candidateRunId && !row.accepted),
    )
  )
    throw new Error('Previous mismatched pair retained; diagnose before continuing')
  for (const item of plan) {
    const itemKey = key(item)
    let entry = state.entries[itemKey]
    if (entry?.measurement) {
      if (
        item.failure === 'none' &&
        (!measureBuildRun(entry.measurement).accepted || !matchesDispatch(item, entry.measurement))
      )
        throw new Error('Previous failed measurement retained; diagnose before continuing')
      if (item.failure !== 'none') validateFailureProbe(entry.measurement)
      continue
    }
    if (!entry) {
      const active = runs().filter((run) => run.status !== 'completed')
      if (active.length) throw new Error('Diagnostic run already active; do not dispatch again')
      const remote = json(['api', `repos/${repository}/git/ref/heads/${branch}`])
      if (remote.object.sha !== commit) throw new Error('Remote branch changed during experiment')
      const previous = new Set(runs().map((run) => run.databaseId))
      gh([
        'workflow',
        'run',
        'ci-shard-diagnostics.yml',
        '--repo',
        repository,
        '--ref',
        branch,
        '--field',
        'stage=build-diagnostics',
        '--field',
        `round=${item.round}`,
        '--field',
        `build_experiment=${item.experiment}`,
        '--field',
        `build_variant=${item.variant}`,
        '--field',
        `build_scenario=${item.scenario}`,
        '--field',
        `build_failure=${item.failure}`,
      ])
      entry = { ...item, dispatchedAt: new Date().toISOString(), previousIds: [...previous] }
      state.entries[itemKey] = entry
      write(checkpoint, state)
    }
    if (!entry.runId) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const found = runs().filter((run) => !entry.previousIds.includes(run.databaseId) && run.headSha === commit)
        if (found.length > 1) throw new Error('Ambiguous dispatched run; inspect checkpoint')
        if (found.length === 1) {
          entry.runId = found[0].databaseId
          write(checkpoint, state)
          break
        }
        await pause(5000)
      }
      if (!entry.runId) throw new Error('Dispatch outcome unknown; inspect before any retry')
    }
    process.stdout.write(`${itemKey}: https://github.com/${repository}/actions/runs/${entry.runId}\n`)
    let run
    do {
      run = json(['api', `repos/${repository}/actions/runs/${entry.runId}`])
      if (run.status !== 'completed') await pause(30000)
    } while (run.status !== 'completed')
    if (run.head_sha !== commit) throw new Error('Executed wrong source commit')
    const jobs = jobsFor(entry.runId)
    const dir = path.join(output, itemKey)
    mkdirSync(dir, { recursive: true })
    write(path.join(dir, 'jobs.json'), jobs)
    write(path.join(dir, 'run.json'), {
      id: run.id,
      status: run.status,
      conclusion: run.conclusion,
      created_at: run.created_at,
      run_started_at: run.run_started_at,
      updated_at: run.updated_at,
    })
    const artifactsDir = path.join(dir, 'artifacts')
    if (!existsSync(artifactsDir)) {
      mkdirSync(artifactsDir, { recursive: true })
      const downloaded = spawnSync(
        'gh',
        ['run', 'download', String(entry.runId), '--repo', repository, '--pattern', 'build-*', '--dir', artifactsDir],
        { encoding: 'utf8' },
      )
      if (downloaded.status !== 0) entry.artifactFailure = true
    }
    const evidence = artifacts(artifactsDir)
    const scope = evidence.scope ?? {}
    entry.measurement = {
      ...item,
      commit,
      contractDigest: scope.workflowDigest,
      filesDigest: scope.filesDigest,
      decisions: { validation: scope.validation, buildRequired: scope.buildRequired, integration: scope.integration },
      run: {
        id: run.id,
        status: run.status,
        conclusion: run.conclusion,
        created_at: run.created_at,
        run_started_at: run.run_started_at,
        updated_at: run.updated_at,
      },
      jobs,
      correctness: evidence,
    }
    write(path.join(dir, 'measurement.json'), entry.measurement)
    write(checkpoint, state)
    const measurements = Object.values(state.entries).flatMap((value) => (value.measurement ? [value.measurement] : []))
    write(path.join(output, 'measurements.json'), measurements)
    const summary = summarizeBuildRuns(measurements)
    write(path.join(output, 'summary.json'), summary)
    writeFileSync(path.join(output, 'summary.md'), renderBuildReport(summary))
    if (
      item.failure === 'none' &&
      (!measureBuildRun(entry.measurement).accepted || !matchesDispatch(item, entry.measurement))
    )
      throw new Error('Failed measurement retained; diagnose before continuing')
    if (item.failure !== 'none') validateFailureProbe(entry.measurement)
    if (
      summary.groups.some((group) => group.rows.some((row) => row.baselineRunId && row.candidateRunId && !row.accepted))
    )
      throw new Error('Mismatched pair retained; diagnose before continuing')
  }
  return { commit, complete: true, entries: Object.keys(state.entries).length }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { values } = parseArgs({
    options: {
      commit: { type: 'string' },
      output: { type: 'string', default: 'tmp/ci-diagnostics/build' },
      execute: { type: 'boolean', default: false },
      stage: { type: 'string', default: 'all' },
    },
  })
  runExperiment(values)
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(`${error.message}\n`)
      process.exitCode = 1
    })
}

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs'
import path from 'node:path'
import { comparePair, physicalRunnerSeconds, summarize } from './results.mjs'

const args = process.argv.slice(2)
const arg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const commit = arg('--commit')
const output = arg('--output')
if (!/^[a-f0-9]{40}$/.test(commit ?? '') || !output) throw new Error('Frozen commit and evidence output required')
const slots = ['integration', 'storybook'].flatMap((topic) =>
  [1, 2].flatMap((round) =>
    (round === 1 ? ['baseline', 'candidate'] : ['candidate', 'baseline']).map((variant) => ({ topic, round, variant })),
  ),
)
if (!args.includes('--execute')) {
  console.log(JSON.stringify(slots, null, 2))
  process.exit(0)
}
mkdirSync(output, { recursive: true })
const journalFile = path.join(output, 'journal.json')
const journal = existsSync(journalFile)
  ? JSON.parse(readFileSync(journalFile, 'utf8'))
  : { version: 1, commit, slots: slots.map((slot) => ({ ...slot, state: 'pending' })) }
if (journal.commit !== commit) throw new Error('Do not replace an existing series with another commit')
if (journal.halts?.length) throw new Error('Retained halt requires diagnosed selective recovery, not redispatch')
const save = () => {
  writeFileSync(`${journalFile}.tmp`, JSON.stringify(journal, null, 2))
  renameSync(`${journalFile}.tmp`, journalFile)
}
const gh = (...ghArgs) => execFileSync('gh', ghArgs, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
const api = (endpoint) => JSON.parse(gh('api', endpoint))
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const repository = 'repos/findmydoc-platform/website'
const workflow = 375094132
const branch = 'feature/ci-selection-poc'
let dispatchLock = Promise.resolve()

async function discover(slot) {
  const title = `Selection ${slot.topic} ${slot.variant} round ${slot.round}`
  for (let attempt = 0; attempt < 12; attempt++) {
    const inventory = api(
      `${repository}/actions/workflows/${workflow}/runs?branch=${encodeURIComponent(branch)}&event=workflow_dispatch&per_page=100`,
    ).workflow_runs
    const matches = inventory.filter(
      (run) =>
        run.head_sha === commit &&
        run.display_title === title &&
        Date.parse(run.created_at) >= Date.parse(slot.dispatchedAt) - 2000,
    )
    if (matches.length > 1) throw new Error('Ambiguous dispatch; no additional run will be started')
    if (matches.length === 1) {
      slot.runId = matches[0].id
      slot.state = 'active'
      save()
      return
    }
    await sleep(5000)
  }
  throw new Error('Dispatch discovery uncertain; retained slot must be reconciled, never blindly repeated')
}
async function dispatch(slot) {
  const previous = dispatchLock
  let release
  dispatchLock = new Promise((resolve) => {
    release = resolve
  })
  await previous
  try {
    if (slot.state === 'dispatched') return await discover(slot)
    const ref = api(`${repository}/git/ref/heads/${branch}`)
    if (ref.object.sha !== commit) throw new Error('Experiment branch moved')
    slot.dispatchedAt = new Date().toISOString()
    slot.state = 'dispatched'
    save()
    gh(
      'workflow',
      'run',
      String(workflow),
      '--ref',
      branch,
      '--field',
      `topic=${slot.topic}`,
      '--field',
      `variant=${slot.variant}`,
      '--field',
      `round=${slot.round}`,
    )
    await discover(slot)
  } finally {
    release()
  }
}
function summarizeJournal() {
  const pairs = {}
  for (const topic of ['integration', 'storybook']) {
    const accepted = []
    for (const round of [1, 2]) {
      const baseline = journal.slots.find(
        (slot) => slot.topic === topic && slot.round === round && slot.variant === 'baseline',
      )
      const candidate = journal.slots.find(
        (slot) => slot.topic === topic && slot.round === round && slot.variant === 'candidate',
      )
      if (baseline?.state === 'complete' && candidate?.state === 'complete')
        accepted.push(comparePair(baseline.receipt, candidate.receipt))
    }
    pairs[topic] = {
      pairs: accepted,
      runnerSaving: accepted.length ? summarize(accepted.map((pair) => pair.runnerSecondsSaved)) : null,
      diagnosticSaving: accepted.length ? summarize(accepted.map((pair) => pair.diagnosticSecondsSaved)) : null,
    }
  }
  const runs = new Map(
    journal.slots
      .filter((slot) => slot.runId && slot.runnerSeconds !== undefined)
      .map((slot) => [slot.runId, slot.runnerSeconds]),
  )
  const summary = {
    commit,
    pairs,
    completedSlots: journal.slots.filter((slot) => slot.state === 'complete').length,
    investigationRunnerSeconds: [...runs.values()].reduce((sum, value) => sum + value, 0),
    uniqueMeasuredRuns: runs.size,
    halts: journal.halts ?? [],
  }
  writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2))
}
async function collect(slot) {
  let run
  while (true) {
    run = api(`${repository}/actions/runs/${slot.runId}`)
    if (run.status === 'completed') break
    await sleep(30000)
  }
  const directory = path.join(output, String(slot.runId))
  mkdirSync(directory, { recursive: true })
  const jobs = api(`${repository}/actions/runs/${slot.runId}/jobs?per_page=100`).jobs
  writeFileSync(path.join(directory, 'run.json'), JSON.stringify(run, null, 2))
  writeFileSync(path.join(directory, 'jobs.json'), JSON.stringify(jobs, null, 2))
  slot.runnerSeconds = physicalRunnerSeconds(jobs)
  save()
  if (run.head_sha !== commit || run.conclusion !== 'success') {
    slot.state = 'failed'
    save()
    try {
      gh('run', 'download', String(slot.runId), '--dir', path.join(directory, 'failed-artifacts'))
    } catch {
      /* Missing artifacts remain a failed measurement. */
    }
    throw new Error(`Failed measurement ${slot.runId}; preserve and diagnose before selective recovery`)
  }
  const artifacts = path.join(directory, 'result')
  if (!existsSync(path.join(artifacts, 'result.json')))
    gh('run', 'download', String(slot.runId), '--name', 'selection-result', '--dir', artifacts)
  const receipt = JSON.parse(readFileSync(path.join(artifacts, 'result.json'), 'utf8'))
  const starts = jobs
    .filter((job) => job.runner_id && job.conclusion !== 'skipped')
    .map((job) => Date.parse(job.started_at))
  const first = Math.min(...starts)
  slot.receipt = {
    ...receipt,
    runId: slot.runId,
    runnerSeconds: slot.runnerSeconds,
    workflowSeconds: (Date.parse(run.updated_at) - first) / 1000,
    queueSeconds: (first - Date.parse(run.created_at)) / 1000,
  }
  slot.state = 'complete'
  save()
  summarizeJournal()
  console.log(
    JSON.stringify({
      completed: journal.slots.filter((item) => item.state === 'complete').length,
      total: 8,
      ...slot,
      receipt: undefined,
    }),
  )
}
save()
const outcomes = await Promise.allSettled(
  ['integration', 'storybook'].map(async (topic) => {
    for (const slot of journal.slots.filter((item) => item.topic === topic)) {
      if (slot.state === 'complete') continue
      if (slot.state === 'failed') throw new Error(`Retained failure ${slot.runId}`)
      if (!slot.runId) await dispatch(slot)
      await collect(slot)
    }
  }),
)
journal.halts = outcomes.filter((result) => result.status === 'rejected').map((result) => String(result.reason))
journal.complete = journal.slots.every((slot) => slot.state === 'complete') && !journal.halts.length
save()
summarizeJournal()
if (!journal.complete) process.exitCode = 1

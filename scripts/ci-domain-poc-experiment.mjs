import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { summarize } from './ci-domain-poc-summary.mjs'

const output = process.argv[2],
  commit = process.argv[3]
if (!output || !/^[a-f0-9]{40}$/.test(commit ?? ''))
  throw new Error('Usage: node scripts/ci-domain-poc-experiment.mjs OUTPUT COMMIT')
fs.mkdirSync(output, { recursive: true })
const journalFile = path.join(output, 'journal.json'),
  lockFile = path.join(output, 'controller.lock')
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
const api = (suffix) => {
  let failure
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return JSON.parse(gh(['api', `repos/findmydoc-platform/website/${suffix}`]))
    } catch (error) {
      failure = error
    }
  }
  throw failure
}
if (fs.existsSync(lockFile)) {
  try {
    process.kill(Number(fs.readFileSync(lockFile, 'utf8')), 0)
    throw new Error('A controller is active.')
  } catch (error) {
    if (error.code !== 'ESRCH') throw error
    fs.rmSync(lockFile)
  }
}
const lock = fs.openSync(lockFile, 'wx')
fs.writeFileSync(lock, String(process.pid))
fs.closeSync(lock)
const entries = ['config-location', 'config-gallery', 'selection-country', 'selection-gallery'].flatMap((pocCase) =>
  [1, 2].flatMap((round) =>
    (round === 1 ? ['baseline', 'candidate'] : ['candidate', 'baseline']).map((variant) => ({
      pocCase,
      experiment: pocCase.startsWith('config-') ? 'config' : 'selection',
      group: pocCase === 'config-gallery' ? 'gallery' : 'location',
      scenario: pocCase === 'selection-gallery' ? 'gallery' : 'country',
      round,
      variant,
    })),
  ),
)
const journal = fs.existsSync(journalFile) ? JSON.parse(fs.readFileSync(journalFile, 'utf8')) : { commit, entries }
if (journal.commit !== commit) throw new Error('Resume the existing frozen journal.')
const save = () => fs.writeFileSync(journalFile, JSON.stringify(journal, null, 2))
let dispatchQueue = Promise.resolve()
const serializeDispatch = (work) => {
  const next = dispatchQueue.then(work)
  dispatchQueue = next.catch(() => {})
  return next
}
const inventory = () =>
  api(
    'actions/workflows/ci-shard-diagnostics.yml/runs?branch=agent%2Fci-shard-diagnostics&event=workflow_dispatch&per_page=100',
  ).workflow_runs
async function discover(entry) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const owned = new Set(journal.entries.filter((item) => item.runId).map((item) => item.runId))
    const runs = inventory()
    if (!Array.isArray(runs) || !runs.length)
      throw new Error('Empty Actions inventory; preserve dispatch intent and reconcile.')
    const matches = runs.filter(
      (run) =>
        !owned.has(run.id) &&
        run.head_sha === commit &&
        Date.parse(run.created_at) >= Date.parse(entry.dispatchedAt) - 2000,
    )
    if (matches.length === 1) {
      entry.runId = matches[0].id
      save()
      return
    }
    if (matches.length > 1) throw new Error('Ambiguous dispatch; reconcile original receipts before continuation.')
    await delay(5000)
  }
  throw new Error('Dispatch discovery incomplete; do not dispatch again.')
}
async function collect(entry) {
  if (entry.error) throw new Error(`Retained failure ${entry.runId ?? entry.pocCase}: ${entry.error}`)
  if (entry.receipt?.status === 'passed' && entry.actions?.conclusion === 'success') return
  if (!entry.runId && entry.dispatchedAt) await discover(entry)
  if (!entry.runId)
    await serializeDispatch(async () => {
      const head = api('git/ref/heads/agent/ci-shard-diagnostics').object.sha
      if (head !== commit) throw new Error('Experiment branch moved; preserve journal and diagnose before dispatch.')
      // Ensure no undiscovered experiment dispatch can be silently duplicated.
      const active = inventory().filter((run) => run.status !== 'completed')
      const owned = new Set(journal.entries.map((item) => item.runId))
      if (active.some((run) => !owned.has(run.id)))
        throw new Error('Unowned active diagnostic run; reconcile before dispatch.')
      entry.dispatchedAt = new Date().toISOString()
      save()
      gh([
        'workflow',
        'run',
        'ci-shard-diagnostics.yml',
        '--ref',
        'agent/ci-shard-diagnostics',
        '--field',
        'stage=domain-poc',
        '--field',
        `domain_case=${entry.pocCase}`,
        '--field',
        `build_variant=${entry.variant}`,
        '--field',
        `round=${entry.round}`,
      ])
      await discover(entry)
    })
  while (true) {
    const run = api(`actions/runs/${entry.runId}`)
    if (run.head_sha !== commit) throw new Error('Run sources differ from frozen commit.')
    if (run.status === 'completed') {
      const jobs = JSON.parse(
        gh([
          'api',
          '--paginate',
          '--slurp',
          `repos/findmydoc-platform/website/actions/runs/${entry.runId}/jobs?per_page=100`,
        ]),
      ).flatMap((page) => page.jobs)
      entry.actions = {
        status: run.status,
        conclusion: run.conclusion,
        created_at: run.created_at,
        run_started_at: run.run_started_at,
        updated_at: run.updated_at,
        queueSeconds: (Date.parse(run.run_started_at) - Date.parse(run.created_at)) / 1000,
        runnerSeconds: jobs
          .filter((job) => job.started_at && job.completed_at)
          .reduce((sum, job) => sum + (Date.parse(job.completed_at) - Date.parse(job.started_at)) / 1000, 0),
        jobs: jobs.map((job) => ({
          name: job.name,
          conclusion: job.conclusion,
          started_at: job.started_at,
          completed_at: job.completed_at,
        })),
      }
      save()
      const directory = path.join(output, String(entry.runId))
      fs.mkdirSync(directory, { recursive: true })
      if (!fs.existsSync(path.join(directory, 'measurement/receipt.json')))
        gh(['run', 'download', String(entry.runId), '--name', `domain-poc-${entry.runId}`, '--dir', directory])
      if (fs.existsSync(path.join(directory, 'runner.json')))
        entry.hardware = JSON.parse(fs.readFileSync(path.join(directory, 'runner.json'), 'utf8'))
      if (fs.existsSync(path.join(directory, 'measurement/receipt.json')))
        entry.receipt = JSON.parse(fs.readFileSync(path.join(directory, 'measurement/receipt.json'), 'utf8'))
      if (run.conclusion !== 'success' || !entry.receipt || entry.receipt.status !== 'passed')
        throw new Error(`Measurement failed: ${run.conclusion}; preserve attempt and diagnose.`)
      for (const key of ['experiment', 'variant', 'group', 'scenario', 'round'])
        if (entry.receipt[key] !== entry[key]) throw new Error(`Mismatched receipt ${key}.`)
      save()
      console.log(`Collected ${entry.runId}: ${entry.pocCase}/${entry.round}/${entry.variant}`)
      return
    }
    await delay(15000)
  }
}
async function lane(pocCase) {
  for (const entry of journal.entries.filter((item) => item.pocCase === pocCase)) {
    try {
      await collect(entry)
    } catch (error) {
      entry.error = error.message
      save()
      throw error
    }
  }
}
try {
  save()
  // Two lanes at most. Configuration compatibility gates all selection measurements.
  let results = await Promise.allSettled(['config-location', 'config-gallery'].map(lane))
  if (results.some((result) => result.status === 'rejected'))
    throw new Error('Configuration lane failed; no selection jobs dispatched.')
  let summary = summarize(output)
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2))
  if (summary.failures.length) throw new Error('Configuration comparisons rejected; inspect retained evidence.')
  results = await Promise.allSettled(['selection-country', 'selection-gallery'].map(lane))
  summary = summarize(output)
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2))
  journal.complete = results.every((result) => result.status === 'fulfilled') && summary.failures.length === 0
  save()
  if (!journal.complete) throw new Error('Selection comparison incomplete or rejected.')
} catch (error) {
  journal.controllerError = error.message
  save()
  console.error(error.message)
  process.exitCode = 1
} finally {
  fs.rmSync(lockFile, { force: true })
}

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, appendFileSync, readdirSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'

export function cacheIdentity({ experiment, commit, round, kind, lock, config, node, pnpm, os, arch }) {
  if (!/^[a-z][a-z0-9-]{2,39}$/.test(experiment)) throw new Error('Invalid experiment identifier')
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid source commit')
  if (![1, 2, 3].includes(Number(round))) throw new Error('Invalid comparison round')
  if (!['pnpm', 'compiler', 'combined'].includes(kind)) throw new Error('Invalid cache kind')
  const digest = createHash('sha256').update(`${lock}:${config}`).digest('hex')
  return `ci-cache-${experiment}-${commit}-${round}-${kind}-${os}-${arch}-node${node}-pnpm${pnpm}-${digest}`
}

export function validateMeasurement(result) {
  if (result.schemaVersion !== 1 || !result.success || !result.cleanupSucceeded) {
    throw new Error('Failed measurement or cleanup')
  }
  if (!/^[a-f0-9]{40}$/.test(result.commit)) throw new Error('Missing frozen source commit')
  if (
    !result.phases?.length ||
    result.phases.some((p) => p.exitCode !== 0 || !Number.isFinite(p.durationMs) || p.durationMs < 0)
  ) {
    throw new Error('Failed or missing measured phase')
  }
  if (['pnpm', 'combined'].includes(result.kind)) {
    if (!result.packages || !Object.values(result.packages).every((n) => Number.isInteger(n) && n >= 0)) {
      throw new Error('Missing package reuse counters')
    }
    if (['warm', 'warm-fallback'].includes(result.variant) && result.packages.reused === 0) {
      throw new Error('Restored store did not reuse packages')
    }
    if (['baseline', 'populate', 'lock-change'].includes(result.variant) && result.packages.reused !== 0) {
      throw new Error('Cold comparison unexpectedly reused packages')
    }
    if (result.kind === 'combined') validateCacheReceipt(result, result.pnpmCache)
  }
  if (['compiler', 'combined'].includes(result.kind)) {
    if (!result.builds?.length || result.builds.some((b) => b.exitCode !== 0 || !b.compilers?.length)) {
      throw new Error('Missing successful instrumented build')
    }
    if (result.variant === 'incremental' && !result.builds.every((b) => b.sourceMarkerVerified === true)) {
      throw new Error('Changed source is missing from generated output')
    }
    if (
      ['warm', 'incremental'].includes(result.variant) &&
      !result.builds.some((b) => b.compilers.some((c) => c.cachedModules > 0))
    ) {
      throw new Error('Compiler did not reuse cached modules')
    }
  }
  return result
}

export function validateCacheReceipt(result, receipt) {
  const expected =
    result.variant === 'warm'
      ? 'exact'
      : result.variant === 'warm-fallback' || result.variant === 'incremental'
        ? 'fallback'
        : 'miss'
  if (result.variant === 'baseline') {
    if (receipt.attempted) throw new Error('Baseline attempted a cache restore')
  } else if (receipt.state !== expected) throw new Error(`Expected ${expected} cache receipt`)
  if (['populate', 'incremental'].includes(result.variant) && receipt.saveOutcome !== 'success') {
    throw new Error('Cache population was not saved')
  }
  return receipt
}

export function median(values) {
  if (!values.length || values.some((n) => !Number.isFinite(n))) throw new Error('Missing durations')
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function findResults(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? findResults(join(root, entry.name))
      : entry.name === 'result.json'
        ? [join(root, entry.name)]
        : [],
  )
}

export function summarize(results, jobs, kind) {
  const selected = results.filter((r) => r.kind === kind && r.mode !== 'diagnose')
  const rows = []
  for (const round of [1, 2, 3]) {
    const variants = ['baseline', 'populate', 'warm']
    const group = variants.map((variant) => {
      const matches = selected.filter((r) => Number(r.round) === round && r.variant === variant)
      if (matches.length !== 1) throw new Error(`Missing or duplicate ${kind} ${round} ${variant}`)
      const result = validateMeasurement(matches[0])
      validateCacheReceipt(result, result.cache)
      const matchedJobs = jobs.filter((j) => j.id === result.jobId || j.id.endsWith(` / ${result.jobId}`))
      const job = matchedJobs.length === 1 ? matchedJobs[0] : undefined
      if (!job || job.conclusion !== 'success' || !job.completedAt) throw new Error('Missing successful completed job')
      const durationMs = Date.parse(job.completedAt) - Date.parse(job.startedAt)
      if (!(durationMs > 0)) throw new Error('Invalid complete runner time')
      return { variant, durationMs, result }
    })
    if (new Set(group.map((g) => `${g.result.commit}:${g.result.node}:${g.result.pnpm}`)).size !== 1)
      throw new Error('Incompatible comparison inputs')
    const [baseline, populate, warm] = group
    const savedMs = baseline.durationMs - warm.durationMs
    rows.push({
      round,
      baselineMs: baseline.durationMs,
      populateMs: populate.durationMs,
      warmMs: warm.durationMs,
      savedMs,
      populationOverheadMs: populate.durationMs - baseline.durationMs,
    })
  }
  if (new Set(selected.map((r) => r.commit)).size !== 1) throw new Error('Mixed measurement commits')
  return {
    kind,
    rows,
    medianSavedMs: median(rows.map((r) => r.savedMs)),
    minSavedMs: Math.min(...rows.map((r) => r.savedMs)),
    maxSavedMs: Math.max(...rows.map((r) => r.savedMs)),
  }
}

async function main() {
  const { values } = parseArgs({
    options: Object.fromEntries(
      ['command', 'kind', 'round', 'input', 'output', 'mode'].map((name) => [name, { type: 'string' }]),
    ),
  })
  if (values.command === 'identity') {
    const lock = createHash('sha256').update(readFileSync('pnpm-lock.yaml')).digest('hex')
    const config = createHash('sha256')
      .update(readFileSync('package.json'))
      .update(readFileSync('next.config.js'))
      .digest('hex')
    const key = cacheIdentity({
      experiment: process.env.CACHE_EXPERIMENT,
      commit: process.env.GITHUB_SHA,
      round: values.round,
      kind: values.kind,
      lock,
      config,
      node: process.env.NODE_VERSION,
      pnpm: process.env.PNPM_VERSION,
      os: process.platform,
      arch: process.arch,
    })
    const fallbackKey = `${key}-probe`
    const primary =
      process.env.CACHE_VARIANT === 'warm-fallback' || process.env.CACHE_VARIANT === 'incremental' ? fallbackKey : key
    appendFileSync(process.env.GITHUB_OUTPUT, `key=${primary}\nrestore=${primary === key ? '' : key}\n`)
    return
  }
  if (values.command === 'receipt') {
    const file = join(values.input, 'result.json')
    const result = JSON.parse(readFileSync(file, 'utf8'))
    const attempted = process.env.CACHE_VARIANT !== 'baseline'
    result.cache = {
      attempted,
      state: !attempted
        ? 'disabled'
        : process.env.CACHE_HIT === 'true'
          ? 'exact'
          : process.env.CACHE_MATCHED
            ? 'fallback'
            : 'miss',
      saveOutcome: process.env.CACHE_SAVE_OUTCOME || 'skipped',
    }
    result.jobId = process.env.CACHE_JOB_ID
    writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`)
    return
  }
  if (values.command === 'combine') {
    const pnpm = JSON.parse(readFileSync(join(values.input, 'pnpm/result.json'), 'utf8'))
    const compiler = JSON.parse(readFileSync(join(values.input, 'compiler/result.json'), 'utf8'))
    validateMeasurement(pnpm)
    validateMeasurement(compiler)
    validateCacheReceipt(pnpm, pnpm.cache)
    validateCacheReceipt(compiler, compiler.cache)
    if (pnpm.commit !== compiler.commit || pnpm.variant !== compiler.variant)
      throw new Error('Incompatible combined inputs')
    const result = {
      ...compiler,
      kind: 'combined',
      success: pnpm.success && compiler.success,
      packages: pnpm.packages,
      pnpmCache: pnpm.cache,
      phases: [...pnpm.phases, ...compiler.phases],
      cleanupSucceeded: pnpm.cleanupSucceeded && compiler.cleanupSucceeded,
    }
    mkdirSync(dirname(values.output), { recursive: true })
    writeFileSync(values.output, `${JSON.stringify(result, null, 2)}\n`)
    return
  }
  if (values.command === 'summary') {
    const results = findResults(values.input).map((file) => JSON.parse(readFileSync(file, 'utf8')))
    const response = await fetch(
      `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/jobs?per_page=100`,
      { headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json' } },
    )
    if (!response.ok) throw new Error(`Cannot read job timings: ${response.status}`)
    const data = await response.json()
    if (data.total_count > 100) throw new Error('Job timing pagination required')
    const jobs = data.jobs.map((j) => ({
      id: j.name,
      startedAt: j.started_at,
      completedAt: j.completed_at,
      conclusion: j.conclusion,
      steps: j.steps.map((s) => ({
        name: s.name,
        startedAt: s.started_at,
        completedAt: s.completed_at,
        conclusion: s.conclusion,
      })),
    }))
    const summaries =
      values.mode === 'combined'
        ? [summarize(results, jobs, 'combined')]
        : ['pnpm', 'compiler'].map((kind) => summarize(results, jobs, kind))
    for (const result of results.filter((r) => ['warm-fallback', 'lock-change', 'incremental'].includes(r.variant))) {
      validateMeasurement(result)
      validateCacheReceipt(result, result.cache)
    }
    const accepted = summaries.every((s) => s.medianSavedMs > 0)
    mkdirSync(dirname(values.output), { recursive: true })
    writeFileSync(`${values.output}.json`, `${JSON.stringify({ summaries, accepted, jobs, results }, null, 2)}\n`)
    const lines = [
      '# Cache experiment measurements',
      '',
      '| Kind | Round | Baseline seconds | Populate seconds | Warm seconds | Saved seconds |',
      '| --- | ---: | ---: | ---: | ---: | ---: |',
    ]
    for (const summary of summaries)
      for (const row of summary.rows)
        lines.push(
          `| ${summary.kind} | ${row.round} | ${(row.baselineMs / 1000).toFixed(1)} | ${(row.populateMs / 1000).toFixed(1)} | ${(row.warmMs / 1000).toFixed(1)} | ${(row.savedMs / 1000).toFixed(1)} |`,
        )
    lines.push(
      '',
      `Positive median net savings in every compared kind: ${accepted}.`,
      '',
      'Complete runner durations include setup, restore, save, reporting and cleanup. The initial population cost is reported separately; these are experimental job comparisons, not entire production workflow savings.',
    )
    writeFileSync(values.output, `${lines.join('\n')}\n`)
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `accepted=${accepted}\n`)
    return
  }
  throw new Error('Unknown cache report command')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })

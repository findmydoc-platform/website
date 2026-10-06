import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const EXPERIMENTS = ['filter', 'schedule']
const SCENARIOS = ['docs', 'tests', 'metadata', 'runtime']
const VARIANTS = ['baseline', 'candidate']
const FAILURES = ['none', 'classification', 'static']
const METRICS = [
  'elapsedMs',
  'runnerMs',
  'initialQueueMs',
  'buildReadyMs',
  'validationReadyMs',
  'buildRunnerMs',
  'buildStepMs',
]
const SUITES = ['static', 'unit', 'storybook', 'integration', 'coverage']

function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : null
}

function boolean(value) {
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  return null
}

function identity(value, lengths) {
  return typeof value === 'string' && lengths.some((length) => new RegExp(`^[a-f0-9]{${length}}$`, 'i').test(value))
    ? value.toLowerCase()
    : null
}

function apiId(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

function role(name) {
  if (typeof name !== 'string') return 'other'
  const leaf = name.split('/').at(-1).trim()
  if (/\bclassif(?:y|ication)\b/i.test(leaf)) return 'classify'
  if (/\bstatic checks?\b/i.test(leaf)) return 'static'
  if (/\bunit tests?\b/i.test(leaf)) return 'unit'
  if (/\bstorybook tests?\b/i.test(leaf)) return 'storybook'
  if (/\bintegration tests?\b/i.test(leaf)) return 'integration'
  if (/\bcombined coverage\b/i.test(leaf)) return 'coverage'
  if (/^build\s+(?:early|late)$/i.test(leaf)) return 'build'
  if (/^build$/i.test(leaf)) return 'gate'
  if (/^result$/i.test(leaf)) return 'result'
  return 'other'
}

function conclusion(value) {
  return [
    'success',
    'failure',
    'cancelled',
    'skipped',
    'timed_out',
    'action_required',
    'neutral',
    'stale',
    'startup_failure',
  ].includes(value)
    ? value
    : null
}

function status(value) {
  return ['completed', 'queued', 'in_progress', 'waiting', 'pending', 'requested'].includes(value) ? value : null
}

function duration(start, end) {
  return start !== null && end !== null && end >= start ? end - start : null
}

function jobMeasurement(job) {
  const started = timestamp(job?.started_at)
  const completed = timestamp(job?.completed_at)
  const skipped = job?.conclusion === 'skipped'
  const elapsed = skipped ? 0 : duration(started, completed)
  const steps = Array.isArray(job?.steps) ? job.steps : []
  const buildSteps = steps.filter((step) => step?.name === 'Build application (static check)')
  const buildStep = buildSteps.length === 1 ? buildSteps[0] : null
  const buildStepStart = timestamp(buildStep?.started_at)
  const buildStepEnd = timestamp(buildStep?.completed_at)
  const buildStepValid =
    buildStep?.status === 'completed' &&
    buildStep?.conclusion === 'success' &&
    duration(buildStepStart, buildStepEnd) !== null &&
    started !== null &&
    completed !== null &&
    buildStepStart >= started &&
    buildStepEnd <= completed
  return {
    id: apiId(job?.id),
    role: role(job?.name),
    status: status(job?.status),
    conclusion: conclusion(job?.conclusion),
    buildLane: /\bbuild early$/i.test(job?.name ?? '')
      ? 'early'
      : /\bbuild late$/i.test(job?.name ?? '')
        ? 'late'
        : null,
    executed: !skipped,
    startedAt: started === null ? null : new Date(started).toISOString(),
    completedAt: completed === null ? null : new Date(completed).toISOString(),
    durationMs: elapsed,
    buildStepCompletedAt: buildStepValid ? new Date(buildStepEnd).toISOString() : null,
    buildStepCount: buildSteps.length,
    buildStepDurationMs: buildStepValid ? duration(buildStepStart, buildStepEnd) : null,
  }
}

function coverageNumbers(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
  if (
    !entries.length ||
    entries.some(
      ([key]) => !['lines', 'statements', 'functions', 'branches', 'total', 'covered', 'skipped', 'pct'].includes(key),
    )
  )
    return null
  const parsed = entries.map(([key, item]) => [key, coverageNumbers(item)])
  return parsed.some(([, item]) => item === null) ? null : Object.fromEntries(parsed)
}

function suiteReceipt(value) {
  const coverage = coverageNumbers(value?.coverage)
  const receipt = {
    success: value?.success === true,
    files: Number.isSafeInteger(value?.files) && value.files > 0 ? value.files : null,
    cases: Number.isSafeInteger(value?.cases) && value.cases > 0 ? value.cases : null,
    casesDigest: identity(value?.casesDigest, [64]),
    coverageDigest: identity(value?.coverageDigest, [64]),
    coverage,
  }
  return {
    receipt,
    valid:
      receipt.success &&
      receipt.files !== null &&
      receipt.cases !== null &&
      receipt.casesDigest !== null &&
      receipt.coverageDigest !== null &&
      coverage !== null &&
      typeof coverage === 'object',
  }
}

function buildReceipt(value) {
  const routes =
    Number.isSafeInteger(value?.routes) && value.routes > 0
      ? value.routes
      : Array.isArray(value?.routes) &&
          value.routes.length > 0 &&
          value.routes.every((route) => typeof route === 'string' && /^\/[A-Za-z0-9_/@().[\]-]*$/.test(route))
        ? value.routes.length
        : null
  const receipt = {
    success: value?.success === true,
    outputVerified: value?.outputVerified === true,
    routesDigest: identity(value?.routesDigest, [64]),
    routes,
  }
  return {
    receipt,
    valid: receipt.success && receipt.outputVerified && receipt.routesDigest !== null && routes !== null,
  }
}

/**
 * Project API data to an allowlisted report. Never copy raw names, URLs, messages,
 * correctness payloads or arbitrary caller fields into JSON or Markdown.
 */
export function measureBuildRun(measurement) {
  const input = measurement && typeof measurement === 'object' ? measurement : {}
  const reasons = new Set()
  const reject = (reason) => reasons.add(reason)
  const experiment = EXPERIMENTS.includes(input.experiment) ? input.experiment : null
  const scenario = SCENARIOS.includes(input.scenario) ? input.scenario : null
  const variant = VARIANTS.includes(input.variant) ? input.variant : null
  const round = [1, 2, 3].includes(input.round) ? input.round : null
  const commit = identity(input.commit, [40, 64])
  const contractDigest = identity(input.contractDigest, [64])
  const filesDigest = identity(input.filesDigest, [64])
  const failure = FAILURES.includes(input.failure) ? input.failure : null
  if (!experiment || !scenario || !variant || !round || !commit || !contractDigest || !filesDigest || !failure)
    reject('invalid-measurement-identity')
  if (failure && failure !== 'none') reject('failure-probe-not-performance-evidence')
  const decisions = {
    validation: boolean(input.decisions?.validation),
    buildRequired: boolean(input.decisions?.buildRequired),
    integration: boolean(input.decisions?.integration),
  }
  if (Object.values(decisions).includes(null)) reject('missing-classification-decisions')
  const run = input.run ?? {}
  const created = timestamp(run.created_at)
  const started = timestamp(run.run_started_at)
  const updated = timestamp(run.updated_at)
  if (apiId(run.id) === null) reject('missing-run-id')
  if (run.status !== 'completed' || run.conclusion !== 'success') reject('run-not-successful-complete')
  const initialQueueMs = duration(created, started)
  if (initialQueueMs === null) reject('invalid-run-queue-timestamps')
  if (duration(started, updated) === null) reject('invalid-workflow-completion-timestamp')
  const jobs = Array.isArray(input.jobs) ? input.jobs.map(jobMeasurement) : []
  if (!jobs.length) reject('missing-jobs')
  const ids = jobs.map((job) => job.id)
  if (ids.includes(null) || new Set(ids).size !== ids.length) reject('missing-or-duplicate-job-id')
  for (const job of jobs) {
    if (job.status !== 'completed' || !['success', 'skipped'].includes(job.conclusion))
      reject('job-not-successful-complete')
    if (job.executed && job.durationMs === null) reject('missing-job-timestamps')
    const begin = timestamp(job.startedAt)
    const end = timestamp(job.completedAt)
    if (
      job.executed &&
      ((begin !== null && created !== null && begin < created) || (end !== null && updated !== null && end > updated))
    )
      reject('job-outside-run-timestamps')
  }
  const byRole = (name) => jobs.filter((job) => job.role === name)
  const requireSuccess = (name) => {
    const matches = byRole(name)
    if (
      matches.length !== 1 ||
      matches[0].status !== 'completed' ||
      matches[0].conclusion !== 'success' ||
      matches[0].durationMs === null
    )
      reject(`required-${name}-job-not-successful`)
  }
  const requireSkipped = (name) => {
    const matches = byRole(name)
    if (matches.length !== 1 || matches[0].status !== 'completed' || matches[0].conclusion !== 'skipped')
      reject(`expected-${name}-skip-mismatch`)
  }
  requireSuccess('classify')
  requireSuccess('gate')
  if (experiment === 'schedule') {
    if (Object.values(decisions).some((decision) => decision !== true)) reject('schedule-decisions-mismatch')
    for (const name of SUITES) requireSuccess(name)
  } else if (experiment === 'filter') {
    if (scenario === 'docs') {
      if (decisions.validation !== false || decisions.integration !== false) reject('docs-decisions-mismatch')
      for (const name of ['static', 'unit', 'storybook', 'integration']) requireSkipped(name)
      requireSuccess('coverage')
    } else {
      if (decisions.validation !== true) reject('validation-decision-mismatch')
      for (const name of ['static', 'unit', 'storybook']) requireSuccess(name)
      if (decisions.integration === true) {
        requireSuccess('integration')
        requireSuccess('coverage')
      } else {
        requireSkipped('integration')
        requireSuccess('coverage')
      }
    }
    if (variant === 'candidate' && decisions.buildRequired !== (scenario === 'runtime'))
      reject('filter-build-decision-mismatch')
  }
  const builds = byRole('build')
  const executedBuilds = builds.filter((job) => job.executed)
  if (builds.length !== 2 || new Set(builds.map((job) => job.buildLane)).size !== 2)
    reject('missing-or-duplicate-build-lane')
  if (executedBuilds.length > 1) reject('multiple-executed-builds')
  // Baseline docs can classify buildRequired=true while skipped validation
  // dependencies prevent the build. Report the observed zero build saving.
  const docsDependencySkip =
    experiment === 'filter' && scenario === 'docs' && variant === 'baseline' && executedBuilds.length === 0
  if (decisions.buildRequired === true && !docsDependencySkip && executedBuilds.length !== 1)
    reject('required-build-skipped')
  if (decisions.buildRequired === false && executedBuilds.length !== 0) reject('unexpected-build-execution')
  const executedBuild = executedBuilds.length === 1 ? executedBuilds[0] : null
  if (
    executedBuild &&
    executedBuild.buildLane !== (experiment === 'schedule' && variant === 'candidate' ? 'early' : 'late')
  )
    reject('build-lane-mismatch')
  if (
    executedBuild &&
    (executedBuild.conclusion !== 'success' ||
      executedBuild.status !== 'completed' ||
      !executedBuild.buildStepCompletedAt)
  )
    reject('missing-successful-build-step')
  const scope = {
    success: input.correctness?.scope?.success === true,
    workflowDigest: identity(input.correctness?.scope?.workflowDigest, [64]),
    filesDigest: identity(input.correctness?.scope?.filesDigest, [64]),
    validation: boolean(input.correctness?.scope?.validation),
    buildRequired: boolean(input.correctness?.scope?.buildRequired),
    integration: boolean(input.correctness?.scope?.integration),
  }
  if (
    !scope.success ||
    scope.workflowDigest !== contractDigest ||
    scope.filesDigest !== filesDigest ||
    Object.keys(decisions).some((name) => scope[name] !== decisions[name])
  )
    reject('scope-receipt-mismatch')
  const correctness = {
    scope,
    unit: null,
    storybook: null,
    integration: null,
    build: null,
    gate: {
      success: input.correctness?.gate?.success === true,
      status: ['built', 'skipped'].includes(input.correctness?.gate?.status) ? input.correctness.gate.status : null,
    },
  }
  for (const name of ['unit', 'storybook', 'integration']) {
    if (!byRole(name).some((job) => job.executed)) continue
    const parsed = suiteReceipt(input.correctness?.[name])
    correctness[name] = parsed.receipt
    if (!parsed.valid) reject(`missing-successful-${name}-receipt`)
    if (
      experiment === 'schedule' &&
      name === 'integration' &&
      (parsed.receipt.files !== 98 || parsed.receipt.cases !== 877)
    )
      reject('schedule-integration-selection-mismatch')
  }
  if (executedBuild) {
    const parsed = buildReceipt(input.correctness?.build)
    correctness.build = parsed.receipt
    if (!parsed.valid) reject('missing-verified-build-receipt')
  }
  if (!correctness.gate.success || correctness.gate.status !== (executedBuilds.length === 1 ? 'built' : 'skipped'))
    reject('gate-receipt-mismatch')
  const timed = jobs.filter((job) => job.executed && job.durationMs !== null)
  const starts = timed.map((job) => timestamp(job.startedAt))
  const ends = timed.map((job) => timestamp(job.completedAt))
  const earliest = starts.length ? Math.min(...starts) : null
  const latest = ends.length ? Math.max(...ends) : null
  const suiteJobs = jobs.filter((job) => SUITES.includes(job.role) && job.executed)
  const validationReadyAt =
    suiteJobs.length &&
    suiteJobs.every((job) => job.status === 'completed' && job.conclusion === 'success' && job.durationMs !== null)
      ? Math.max(...suiteJobs.map((job) => timestamp(job.completedAt)))
      : null
  const buildReadyAt = executedBuild ? timestamp(executedBuild.buildStepCompletedAt) : null
  return {
    experiment,
    scenario,
    variant,
    round,
    commit,
    contractDigest,
    filesDigest,
    failure,
    runId: apiId(run.id),
    accepted: reasons.size === 0,
    rejectionReasons: [...reasons].sort(),
    decisions,
    correctness,
    jobs,
    metrics: {
      elapsedMs: duration(earliest, latest),
      runnerMs: timed.reduce((total, job) => total + job.durationMs, 0),
      initialQueueMs,
      buildReadyMs: duration(earliest, buildReadyAt),
      validationReadyMs: duration(earliest, validationReadyAt),
      executedJobCount: jobs.filter((job) => job.executed).length,
      timedJobCount: timed.length,
      buildJobCount: executedBuilds.length,
      buildStepMs: executedBuild ? executedBuild.buildStepDurationMs : 0,
      buildRunnerMs: executedBuilds.reduce((total, job) => total + (job.durationMs ?? 0), 0),
    },
    buildReadyAt: buildReadyAt === null ? null : new Date(buildReadyAt).toISOString(),
    validationReadyAt: validationReadyAt === null ? null : new Date(validationReadyAt).toISOString(),
    workflowCompletion: {
      source: 'updated_at',
      preliminary: true,
      status: status(run.status),
      conclusion: conclusion(run.conclusion),
      reportedAt: updated === null ? null : new Date(updated).toISOString(),
      elapsedFromCreatedMs: duration(created, updated),
      elapsedFromStartedMs: duration(started, updated),
    },
  }
}

function distribution(values) {
  if (values.length !== 3 || values.some((value) => !Number.isFinite(value))) return null
  const sorted = [...values].sort((left, right) => left - right)
  return { medianMs: sorted[1], minMs: sorted[0], maxMs: sorted[2] }
}

function costs(entries) {
  return {
    measuredRunnerMs: entries.reduce((sum, entry) => sum + entry.metrics.runnerMs, 0),
    acceptedRunnerMs: entries.filter((entry) => entry.accepted).reduce((sum, entry) => sum + entry.metrics.runnerMs, 0),
    rejectedRunnerMs: entries
      .filter((entry) => !entry.accepted)
      .reduce((sum, entry) => sum + entry.metrics.runnerMs, 0),
    complete: entries.every((entry) => entry.metrics.executedJobCount === entry.metrics.timedJobCount),
    measurementCount: entries.length,
  }
}

function summarizeGroup(experiment, scenario, entries) {
  const reasons = new Set()
  if (entries.some((entry) => !entry.accepted)) reasons.add('rejected-measurement')
  for (const [field, reason] of [
    ['commit', 'mixed-commits'],
    ['contractDigest', 'mixed-contracts'],
    ['filesDigest', 'mixed-scenario-files'],
  ]) {
    if (new Set(entries.map((entry) => entry[field])).size !== 1) reasons.add(reason)
  }
  const rows = []
  for (const round of [1, 2, 3]) {
    const baseline = entries.filter((entry) => entry.round === round && entry.variant === 'baseline')
    const candidate = entries.filter((entry) => entry.round === round && entry.variant === 'candidate')
    if (baseline.length !== 1 || candidate.length !== 1) {
      reasons.add('missing-or-duplicate-round-pair')
      rows.push({
        round,
        accepted: false,
        baselineRunIds: baseline.map((entry) => entry.runId),
        candidateRunIds: candidate.map((entry) => entry.runId),
        deltas: null,
      })
      continue
    }
    const left = baseline[0]
    const right = candidate[0]
    const comparable =
      left.accepted &&
      right.accepted &&
      ['commit', 'contractDigest', 'filesDigest'].every((field) => left[field] === right[field])
    const receiptReasons = []
    for (const name of ['unit', 'storybook', 'integration']) {
      const leftReceipt = left.correctness[name]
      const rightReceipt = right.correctness[name]
      if (leftReceipt || rightReceipt) {
        if (
          !leftReceipt ||
          !rightReceipt ||
          ['files', 'cases', 'casesDigest', 'coverageDigest', 'coverage'].some(
            (field) => JSON.stringify(leftReceipt[field]) !== JSON.stringify(rightReceipt[field]),
          )
        ) {
          receiptReasons.push(`${name}-receipt-mismatch`)
        }
      }
    }
    if (
      left.correctness.build &&
      right.correctness.build &&
      ['routesDigest', 'routes'].some((field) => left.correctness.build[field] !== right.correctness.build[field])
    )
      receiptReasons.push('build-routes-mismatch')
    for (const reason of receiptReasons) reasons.add(reason)
    const pairAccepted = comparable && receiptReasons.length === 0
    const deltas = pairAccepted
      ? Object.fromEntries(
          METRICS.map((metric) => [
            metric.replace('Ms', 'SavedMs'),
            left.metrics[metric] !== null && right.metrics[metric] !== null
              ? left.metrics[metric] - right.metrics[metric]
              : null,
          ]),
        )
      : null
    rows.push({
      round,
      accepted: pairAccepted,
      rejectionReasons: receiptReasons,
      baselineRunId: left.runId,
      candidateRunId: right.runId,
      baseline: left.metrics,
      candidate: right.metrics,
      deltas,
      buildJobsAvoided: pairAccepted ? left.metrics.buildJobCount - right.metrics.buildJobCount : null,
      buildRunnerSavedMs: pairAccepted ? left.metrics.buildRunnerMs - right.metrics.buildRunnerMs : null,
    })
  }
  const accepted = reasons.size === 0 && rows.every((row) => row.accepted)
  const gainBounds = accepted
    ? Object.fromEntries(
        METRICS.map((metric) => {
          const name = metric.replace('Ms', 'SavedMs')
          return [name, distribution(rows.map((row) => row.deltas[name]))]
        }),
      )
    : null
  return {
    experiment,
    scenario,
    accepted,
    rejectionReasons: [...reasons].sort(),
    commit: new Set(entries.map((entry) => entry.commit)).size === 1 ? entries[0].commit : null,
    contractDigest: new Set(entries.map((entry) => entry.contractDigest)).size === 1 ? entries[0].contractDigest : null,
    filesDigest: new Set(entries.map((entry) => entry.filesDigest)).size === 1 ? entries[0].filesDigest : null,
    rows,
    gainBounds,
    cumulativeCost: costs(entries),
  }
}

/** Independent experiments and scenario groups; never calculate a pooled median. */
export function summarizeBuildRuns(measurements) {
  if (!Array.isArray(measurements)) throw new Error('Expected measurement array')
  const entries = measurements.map(measureBuildRun)
  const failureProbes = entries.filter((entry) => ['classification', 'static'].includes(entry.failure))
  // An invalid failure selector remains rejected performance input, rather than
  // allowing malformed measurements to disappear behind the probe exclusion.
  const performanceEntries = entries.filter((entry) => !['classification', 'static'].includes(entry.failure))
  const groups = EXPERIMENTS.flatMap((experiment) =>
    SCENARIOS.flatMap((scenario) => {
      const selected = entries.filter(
        (entry) => entry.experiment === experiment && entry.scenario === scenario && entry.failure === 'none',
      )
      return selected.length ? [summarizeGroup(experiment, scenario, selected)] : []
    }),
  )
  const approaches = EXPERIMENTS.flatMap((experiment) => {
    const selected = groups.filter((group) => group.experiment === experiment)
    if (!selected.length) return []
    const reasons = new Set()
    if (selected.some((group) => !group.accepted)) reasons.add('incomplete-or-rejected-scenario')
    if (new Set(selected.map((group) => group.commit)).size !== 1) reasons.add('mixed-commits')
    if (new Set(selected.map((group) => group.contractDigest)).size !== 1) reasons.add('mixed-contracts')
    const accepted = reasons.size === 0
    const observedGainBounds = accepted
      ? Object.fromEntries(
          METRICS.map((metric) => {
            const name = metric.replace('Ms', 'SavedMs')
            const bounds = selected.map((group) => group.gainBounds[name])
            return [
              name,
              bounds.some((bound) => bound === null)
                ? null
                : {
                    minMs: Math.min(...bounds.map((bound) => bound.minMs)),
                    maxMs: Math.max(...bounds.map((bound) => bound.maxMs)),
                  },
            ]
          }),
        )
      : null
    return [
      {
        experiment,
        accepted,
        rejectionReasons: [...reasons].sort(),
        scenarios: selected.map((group) => group.scenario),
        observedGainBounds,
        cumulativeCost: costs(entries.filter((entry) => entry.experiment === experiment)),
      },
    ]
  })
  return {
    schemaVersion: 1,
    kind: 'build',
    accepted:
      performanceEntries.length > 0 &&
      performanceEntries.every((entry) => entry.accepted) &&
      approaches.every((approach) => approach.accepted),
    rejectionReasons: [
      ...new Set([
        ...(entries.length ? [] : ['no-measurements']),
        ...(entries.length && !performanceEntries.length ? ['no-performance-measurements'] : []),
        ...(performanceEntries.some((entry) => !entry.accepted) ? ['rejected-measurement'] : []),
        ...groups.flatMap((group) => group.rejectionReasons),
        ...approaches.flatMap((approach) => approach.rejectionReasons),
      ]),
    ].sort(),
    entries,
    rejectedEntries: entries.filter((entry) => !entry.accepted),
    failureProbes,
    groups,
    approaches,
    cumulativeCost: costs(entries),
    interpretation: {
      positiveDelta: 'baseline minus candidate, in milliseconds',
      acceptance:
        'Complete comparable performance evidence. Controlled failure probes retain their own rejection reasons and costs; the parent validates their expected failure shape separately. Acceptance is not an automatic recommendation to adopt a change.',
      elapsed: 'Earliest executed job start to latest executed job completion, including setup and report jobs.',
      runner:
        'Sum of all timed executed jobs. Skipped jobs contribute zero. Missing timestamps make cost a lower bound.',
      queue: 'Initial run start minus creation, reported separately from elapsed job time.',
      readiness:
        'Build readiness uses the successful build application step; validation readiness uses actual suite completions.',
      workflow: 'API updated_at is a preliminary completion timestamp; workflow completion is not job elapsed time.',
      gainBounds:
        'Observed bounds for supplied scenarios only. Experiments and scenarios have no pooled median or additive gain.',
    },
  }
}

export function renderBuildReport(report) {
  const seconds = (value) => (value === null || value === undefined ? 'n/a' : (value / 1000).toFixed(3))
  const lines = [
    '# Build experiment report',
    '',
    `Comparable evidence accepted: ${report.accepted}.`,
    '',
    'Positive savings mean baseline minus candidate. Filter and schedule are independent experiments.',
    '',
    '| Experiment | Scenario | Round | Accepted | Elapsed saved (s) | Runner saved (s) | Queue saved (s) | Build ready saved (s) | Validation ready saved (s) | Builds avoided |',
    '| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ]
  for (const group of report.groups)
    for (const row of group.rows)
      lines.push(
        `| ${group.experiment} | ${group.scenario} | ${row.round} | ${row.accepted} | ${seconds(row.deltas?.elapsedSavedMs)} | ${seconds(row.deltas?.runnerSavedMs)} | ${seconds(row.deltas?.initialQueueSavedMs)} | ${seconds(row.deltas?.buildReadySavedMs)} | ${seconds(row.deltas?.validationReadySavedMs)} | ${row.buildJobsAvoided ?? 'n/a'} |`,
      )
  lines.push(
    '',
    '## Observed gain bounds',
    '',
    '| Experiment | Scenario | Metric | Median saved (s) | Range saved (s) |',
    '| --- | --- | --- | ---: | --- |',
  )
  for (const group of report.groups) {
    if (!group.accepted) {
      lines.push(`| ${group.experiment} | ${group.scenario} | rejected | n/a | ${group.rejectionReasons.join(', ')} |`)
      continue
    }
    for (const [metric, bounds] of Object.entries(group.gainBounds))
      lines.push(
        `| ${group.experiment} | ${group.scenario} | ${metric} | ${seconds(bounds?.medianMs)} | ${bounds ? `${seconds(bounds.minMs)} to ${seconds(bounds.maxMs)}` : 'n/a'} |`,
      )
  }
  lines.push(
    '',
    '## Cost and rejected evidence',
    '',
    `Total measured runner cost: ${seconds(report.cumulativeCost.measuredRunnerMs)} s. Rejected entries cost: ${seconds(report.cumulativeCost.rejectedRunnerMs)} s. Complete cost accounting: ${report.cumulativeCost.complete}.`,
    '',
    '| Run | Experiment | Scenario | Variant | Round | Measured runner (s) | Rejection reasons |',
    '| ---: | --- | --- | --- | ---: | ---: | --- |',
  )
  for (const entry of report.rejectedEntries)
    lines.push(
      `| ${entry.runId ?? 'n/a'} | ${entry.experiment ?? 'invalid'} | ${entry.scenario ?? 'invalid'} | ${entry.variant ?? 'invalid'} | ${entry.round ?? 'n/a'} | ${seconds(entry.metrics.runnerMs)} | ${entry.rejectionReasons.join(', ')} |`,
    )
  lines.push(
    '',
    '## Workflow completion',
    '',
    'API updated_at is preliminary and reported separately from job elapsed time.',
    '',
    '| Run | Completed successfully | API updated_at | From creation (s) | From run start (s) |',
    '| ---: | --- | --- | ---: | ---: |',
  )
  for (const entry of report.entries)
    lines.push(
      `| ${entry.runId ?? 'n/a'} | ${entry.workflowCompletion.status === 'completed' && entry.workflowCompletion.conclusion === 'success'} | ${entry.workflowCompletion.reportedAt ?? 'n/a'} | ${seconds(entry.workflowCompletion.elapsedFromCreatedMs)} | ${seconds(entry.workflowCompletion.elapsedFromStartedMs)} |`,
    )
  lines.push(
    '',
    'Bounds describe only the supplied scenarios. No pooled median, additive optimization gain, production extrapolation, or automatic adoption decision is made.',
    '',
    'Runner cost includes failed timed jobs. Missing end timestamps leave a lower bound. Skipped build jobs are counted as zero, including baseline docs builds blocked by skipped validation dependencies.',
    '',
  )
  return lines.join('\n')
}

async function main() {
  const { values } = parseArgs({
    options: { input: { type: 'string' }, output: { type: 'string' } },
    allowPositionals: false,
  })
  if (!values.input || !values.output || !values.output.endsWith('.json'))
    throw new Error('Expected input and JSON output paths')
  const report = summarizeBuildRuns(JSON.parse(await readFile(values.input, 'utf8')))
  await mkdir(dirname(resolve(values.output)), { recursive: true })
  await writeFile(values.output, `${JSON.stringify(report, null, 2)}\n`)
  await writeFile(values.output.replace(/\.json$/, '.md'), renderBuildReport(report))
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    process.stderr.write('Build report failed: check the measurement array and output paths.\n')
    process.exitCode = 1
  })
}

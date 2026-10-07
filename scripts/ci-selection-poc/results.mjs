export function validateRun(receipt) {
  if (!receipt || receipt.status !== 'success') throw new Error('Measurement did not pass')
  if (receipt.mode === 'skip') {
    if (receipt.report || !receipt.reasons?.length) throw new Error('Invalid intentional skip')
    return
  }
  const report = receipt.report
  if (!report || report.reason !== 'passed' || report.unhandledErrors || !report.modules?.length)
    throw new Error('Missing or failed test report')
  const actual = report.modules.map((module) => module.filename).sort()
  if (JSON.stringify(actual) !== JSON.stringify([...receipt.expectedFiles].sort()))
    throw new Error('Executed file manifest differs')
  const tests = report.modules.flatMap((module) => module.tests)
  if (!tests.length || tests.some((test) => test.state !== 'passed' || test.retries))
    throw new Error('Failed, skipped or retried cases')
  if (new Set(tests.map((test) => test.id)).size !== tests.length) throw new Error('Duplicate case identities')
  if (!receipt.coverage?.total) throw new Error('Coverage missing')
}

export function physicalRunnerSeconds(jobs) {
  return jobs.reduce((total, job) => {
    if (!job.runner_id || job.conclusion === 'skipped') return total
    const seconds = (Date.parse(job.completed_at) - Date.parse(job.started_at)) / 1000
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Incomplete physical job timing')
    return total + seconds
  }, 0)
}

export function comparePair(baseline, candidate) {
  for (const receipt of [baseline, candidate]) validateRun(receipt)
  for (const key of ['commit', 'topic', 'round', 'node', 'pnpm', 'scenario', 'topology'])
    if (baseline[key] !== candidate[key]) throw new Error(`Mismatched ${key}`)
  if (baseline.variant !== 'baseline' || candidate.variant !== 'candidate') throw new Error('Incorrect variants')
  if (candidate.mode !== 'skip') {
    const selectedFiles = new Set(candidate.expectedFiles)
    const baselineIds = baseline.report.modules
      .filter((module) => selectedFiles.has(module.filename))
      .flatMap((module) => module.tests.map((test) => test.id))
      .sort()
    const candidateIds = candidate.report.modules.flatMap((module) => module.tests.map((test) => test.id)).sort()
    if (JSON.stringify(baselineIds) !== JSON.stringify(candidateIds)) throw new Error('Changed case identities')
    const scope = (coverage) =>
      Object.keys(coverage)
        .filter((key) => key !== 'total')
        .sort()
    if (JSON.stringify(scope(baseline.coverage)) !== JSON.stringify(scope(candidate.coverage)))
      throw new Error('Changed coverage source scope')
  }
  return {
    baselineRun: baseline.runId,
    candidateRun: candidate.runId,
    runnerSecondsSaved: baseline.runnerSeconds - candidate.runnerSeconds,
    diagnosticSecondsSaved: baseline.workflowSeconds - candidate.workflowSeconds,
    casesAvoided:
      baseline.report.modules.reduce((sum, module) => sum + module.tests.length, 0) -
      (candidate.report?.modules.reduce((sum, module) => sum + module.tests.length, 0) ?? 0),
  }
}

export function summarize(values) {
  if (!values.length || values.some((value) => !Number.isFinite(value))) throw new Error('Missing observations')
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return {
    values,
    median: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
    min: sorted[0],
    max: sorted.at(-1),
  }
}

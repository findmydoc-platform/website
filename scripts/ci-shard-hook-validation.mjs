/** @type {Record<string, number>} */
export const hookTestCounts = {
  'tests/integration/doctors.lifecycle.test.ts': 13,
  'tests/integration/clinicRegistration.atomic.test.ts': 16,
  'tests/integration/inquiryRetention.lifecycle.test.ts': 8,
}

export function hookFiles(round = 1) {
  if (![1, 2, 3].includes(round)) throw new Error('Hook rounds must be 1, 2 or 3.')
  const files = Object.keys(hookTestCounts)
  return [...files.slice(round - 1), ...files.slice(0, round - 1)]
}

export function validateHookMeasurement(report, events, order) {
  if (report.reason !== 'passed' || report.unhandledErrors !== 0 || report.hookTimingComplete !== true)
    throw new Error('Hook test execution is unsuccessful or incomplete.')
  if (JSON.stringify(report.modules.map((item) => item.filename)) !== JSON.stringify(order))
    throw new Error('Hook test execution order differs.')
  const phases = ['payload-init', 'baseline-check', 'fixtures', 'baseline-seed', 'baseline-cache']
  if (
    events.some(
      (event) =>
        !order.includes(event.filename) ||
        !phases.includes(event.phase) ||
        event.status !== 'passed' ||
        !Number.isFinite(event.durationMs) ||
        event.durationMs < 0,
    )
  )
    throw new Error('Hook phase events are invalid.')
  return report.modules.map((item, index) => {
    if (
      item.tests.length !== hookTestCounts[item.filename] ||
      item.tests.some((test) => test.state !== 'passed' || test.retries !== 0) ||
      new Set(item.tests.map((test) => test.id)).size !== item.tests.length
    )
      throw new Error('The expected 37 passing hook diagnostic cases are required without retries.')
    const measured = {}
    for (const phase of phases.slice(0, 3)) {
      const selected = events.filter((event) => event.filename === item.filename && event.phase === phase)
      if (selected.length !== 1) throw new Error('Each outer hook phase is required exactly once.')
      measured[phase] = selected[0].durationMs
    }
    const decisions = events.filter(
      (event) => event.filename === item.filename && ['baseline-seed', 'baseline-cache'].includes(event.phase),
    )
    if (decisions.length !== 1) throw new Error('Exactly one baseline seed or cache decision is required.')
    if (decisions[0].durationMs > measured['baseline-check'] + 1)
      throw new Error('Nested seed time exceeds the baseline phase.')
    if (decisions[0].phase === 'baseline-cache' && decisions[0].durationMs !== 0)
      throw new Error('A cache decision must not contain seed execution time.')
    const hookMs = item.hookMsByName.beforeAll
    const residualMs = hookMs - Object.values(measured).reduce((sum, value) => sum + value, 0)
    if (!Number.isFinite(hookMs) || hookMs < 0 || residualMs < -1)
      throw new Error('Hook time does not contain the measured phases.')
    return {
      filename: item.filename,
      position: index + 1,
      hookMs,
      phases: measured,
      seedMs: decisions[0].phase === 'baseline-seed' ? decisions[0].durationMs : 0,
      seedCalls: decisions[0].phase === 'baseline-seed' ? 1 : 0,
      cacheHits: decisions[0].phase === 'baseline-cache' ? 1 : 0,
      residualMs,
    }
  })
}

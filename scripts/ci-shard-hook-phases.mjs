import { AsyncLocalStorage } from 'node:async_hooks'
import { appendFileSync } from 'node:fs'

const monotonicNow = process.hrtime.bigint
const context = new AsyncLocalStorage()
const outerPhases = ['payload-init', 'baseline-check', 'fixtures']

function record(filename, phase, started, status) {
  appendFileSync(
    process.env.CI_SHARD_PHASES,
    JSON.stringify({ filename, phase, durationMs: Number(monotonicNow() - started) / 1e6, status }) + '\n',
  )
}

async function measured(filename, phase, callback) {
  const started = monotonicNow()
  let status = 'failed'
  try {
    const result = await callback()
    status = 'passed'
    return result
  } finally {
    record(filename, phase, started, status)
  }
}

/** Measure selected beforeAll operations only when the diagnostic output is enabled. */
export function measureHookPhase(filename, phase, callback) {
  if (!process.env.CI_SHARD_PHASES) return callback()
  if (!/^tests\/integration\/[A-Za-z0-9._/-]+\.test\.ts$/.test(filename) || filename.includes('..'))
    throw new Error('Hook phase filenames must be relative integration test paths.')
  if (!outerPhases.includes(phase)) throw new Error('Unknown beforeAll phase.')
  return context.run({ filename, phase }, () => measured(filename, phase, callback))
}

/** Distinguish a real seed invocation from a cached ensureBaseline call. */
export function measureBaselineSeed(callback) {
  const active = context.getStore()
  if (!process.env.CI_SHARD_PHASES || active?.phase !== 'baseline-check') return callback()
  return measured(active.filename, 'baseline-seed', callback)
}

export function recordBaselineCacheHit() {
  const active = context.getStore()
  if (!process.env.CI_SHARD_PHASES || active?.phase !== 'baseline-check') return
  appendFileSync(
    process.env.CI_SHARD_PHASES,
    JSON.stringify({ filename: active.filename, phase: 'baseline-cache', durationMs: 0, status: 'passed' }) + '\n',
  )
}

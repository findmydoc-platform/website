import { createHash } from 'node:crypto'
import type { Payload } from 'payload'

const ACQUIRE_TIMEOUT = 3_000
const CONTROL_TIMEOUT = 1_000
const EXECUTION_TIMEOUT = 30_000

export type RecoveryExecution = { signal: AbortSignal; assertActive: () => void }

function unavailable() {
  return new Error('RECOVERY_TEMPORARILY_UNAVAILABLE')
}

async function bounded<Result>(work: Promise<Result>, milliseconds: number): Promise<Result> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(unavailable()), milliseconds)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

/** ADR 034 permits only transaction control and an Auth-specific advisory lock on this reserved connection. */
export async function withWebsiteRecoveryExecution<Result>(
  payload: Payload,
  environment: string,
  actionId: number,
  subject: string,
  work: (execution: RecoveryExecution) => Promise<Result>,
): Promise<Result> {
  const connecting = payload.db.pool.connect()
  let client: Awaited<typeof connecting>
  try {
    client = await bounded(connecting, ACQUIRE_TIMEOUT)
  } catch {
    // A connection arriving after the deadline must never stay checked out or authorize work.
    void connecting
      .then(
        (late) => late.release(true),
        () => {},
      )
      .catch(() => {})
    throw unavailable()
  }
  const controller = new AbortController()
  let rejectLost!: (error: Error) => void
  const lost = new Promise<never>((_, reject) => {
    rejectLost = reject
  })
  void lost.catch(() => {})
  let broken = false
  let finished = false
  let transaction = false
  const deadline = Date.now() + EXECUTION_TIMEOUT
  function lose() {
    if (finished || broken) return
    broken = true
    controller.abort()
    rejectLost(unavailable())
  }
  const timer = setTimeout(lose, EXECUTION_TIMEOUT)
  client.on('error', lose)
  client.on('end', lose)
  const execution: RecoveryExecution = {
    signal: controller.signal,
    assertActive() {
      if (Date.now() >= deadline) lose()
      if (broken || finished) throw unavailable()
    },
  }
  async function control(text: string, values?: string[]) {
    try {
      return await bounded(client.query({ text, values }), CONTROL_TIMEOUT)
    } catch {
      lose()
      throw unavailable()
    }
  }
  try {
    await control('BEGIN')
    transaction = true
    for (const scope of [
      ['website-recovery-action-v1', environment, actionId],
      ['website-recovery-subject-v1', environment, subject],
    ]) {
      const lock = createHash('sha256').update(JSON.stringify(scope)).digest().readBigInt64BE().toString()
      const result = await control('SELECT pg_try_advisory_xact_lock($1::bigint) AS acquired', [lock])
      execution.assertActive()
      if (result.rows[0]?.acquired !== true) throw unavailable()
    }
    // External effects run once, outside the lifecycle's independently retried Local API transactions.
    const value = await Promise.race([work(execution), lost])
    execution.assertActive()
    await control('COMMIT')
    transaction = false
    execution.assertActive()
    return value
  } finally {
    clearTimeout(timer)
    try {
      if (transaction && !broken) await control('ROLLBACK')
    } finally {
      finished = true
      controller.abort()
      client.removeListener('error', lose)
      client.removeListener('end', lose)
      try {
        client.release(broken)
      } catch {
        throw unavailable()
      }
    }
  }
}

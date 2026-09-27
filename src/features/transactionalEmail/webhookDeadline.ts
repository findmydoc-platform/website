import { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'
import { TransactionalEmailError } from './errors'
import { isActiveTransaction } from './transactions'

// ADR 030 permits only transaction-local safety controls through this private bridge.
// See docs/adrs/030-adr-bound-transactional-email-webhook-processing.md.
export class WebhookDeadline {
  readonly #expiresAt = performance.now() + 5000
  #expired = false
  #timer: ReturnType<typeof setTimeout> | undefined
  readonly #expiration: Promise<never>

  constructor() {
    this.#expiration = new Promise((_, reject) => {
      this.#timer = setTimeout(() => {
        this.#expired = true
        reject(new TransactionalEmailError('storage-unavailable'))
      }, 5000)
    })
    // The same deadline can expire while native cleanup is still settling.
    void this.#expiration.catch(() => {})
  }

  check() {
    if (this.#expired || performance.now() >= this.#expiresAt) throw new TransactionalEmailError('storage-unavailable')
  }

  async wait<Result>(work: Promise<Result>): Promise<Result> {
    const result = await Promise.race([work, this.#expiration])
    this.check()
    return result
  }

  dispose() {
    this.#expired = true
    clearTimeout(this.#timer)
  }

  async beforeOperation(req: PayloadRequest, transactionID: number | string) {
    this.check()
    // Reserve time for the error path; never turn a depleted budget into PostgreSQL's unlimited zero.
    const remaining = Math.floor(this.#expiresAt - performance.now() - 100)
    if (
      !Number.isSafeInteger(remaining) ||
      remaining < 1 ||
      remaining > 5000 ||
      !isActiveTransaction(req, transactionID) ||
      req.payload.db.name !== 'postgres'
    )
      throw new TransactionalEmailError('storage-unavailable')
    const transaction = req.payload.db.sessions?.[transactionID]?.db
    if (
      !transaction ||
      typeof transaction !== 'object' ||
      !('execute' in transaction) ||
      typeof transaction.execute !== 'function'
    )
      throw new TransactionalEmailError('storage-unavailable')
    const milliseconds = `${remaining}ms`
    const result: unknown = await transaction.execute(sql`
      SELECT set_config('statement_timeout', ${milliseconds}, true) AS statement_timeout,
             set_config('idle_in_transaction_session_timeout', ${milliseconds}, true) AS idle_timeout
    `)
    this.check()
    const rows = result && typeof result === 'object' && 'rows' in result ? result.rows : undefined
    const row: unknown = Array.isArray(rows) && rows.length === 1 ? rows[0] : undefined
    const applied = (value: unknown) => value === milliseconds || value === `${remaining / 1000}s`
    if (
      !row ||
      typeof row !== 'object' ||
      !('statement_timeout' in row) ||
      !applied(row.statement_timeout) ||
      !('idle_timeout' in row) ||
      !applied(row.idle_timeout)
    )
      throw new TransactionalEmailError('storage-unavailable')
  }

  async cleanup(work: Promise<void>) {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new TransactionalEmailError('storage-unavailable')), 100)
        }),
      ])
    } finally {
      clearTimeout(timer)
    }
  }
}

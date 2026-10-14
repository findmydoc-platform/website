import { randomUUID } from 'node:crypto'
import { createLocalReq, ValidationError, type PayloadRequest } from 'payload'
import { requireNotificationTransaction } from '@/collections/clinicNotifications/common'
import type { ClinicNotificationControl } from '@/payload-types'
import { recordRetentionDiagnostic, type RetentionSignal } from './retentionDiagnostics'

const intervalMs = 300_000
const leaseMs = 240_000
class RetentionFailure extends Error {
  constructor(readonly outcome: 'not_committed' | 'unknown' = 'not_committed') {
    super('Notification retention is unavailable.')
  }
}
class RetentionBudgetExceeded extends Error {}
function retryable(error: unknown): boolean {
  const seen = new Set<unknown>()
  let value = error
  while (value && typeof value === 'object' && !seen.has(value)) {
    seen.add(value)
    const details = value as Record<string, unknown>
    if (details.code === '40001' || details.code === '40P01') return true
    if (
      value instanceof ValidationError &&
      value.data.collection === 'clinicNotificationControls' &&
      value.data.errors.some(({ path }) => path === 'key')
    )
      return true
    value = details.cause
  }
  return false
}

export async function runClinicNotificationRetention(
  req: PayloadRequest,
  options: { deadline?: number; maxBatches?: number } = {},
): Promise<RetentionSignal> {
  const started = Date.now()
  const deadline = Math.min(options.deadline ?? started + 220_000, started + 220_000)
  const maxBatches = Math.min(Math.max(options.maxBatches ?? 100, 0), 100)
  const signal: RetentionSignal = {
    result: 'failure',
    transactionOutcome: 'not_committed',
    elapsedMs: 0,
    attemptCount: 0,
    occurrencesDeleted: 0,
    receiptsDeleted: 0,
    missedSlots: 0,
    recoveredInterruptedRun: false,
  }
  const token = randomUUID()
  let controlId: number | undefined
  const checkBudget = () => {
    if (Date.now() >= deadline) throw new RetentionBudgetExceeded()
  }
  async function transaction<T>(work: (transactionReq: PayloadRequest) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      checkBudget()
      signal.attemptCount++
      let id: string | number | null = null
      let committing = false
      try {
        id = await req.payload.db.beginTransaction({ accessMode: 'read write', isolationLevel: 'serializable' })
        requireNotificationTransaction(req, id)
        const transactionReq = await createLocalReq(
          { context: { clinicNotificationRetention: true }, req: { transactionID: Promise.resolve(id) } },
          req.payload,
        )
        const result = await work(transactionReq)
        checkBudget()
        requireNotificationTransaction(transactionReq, id)
        committing = true
        await req.payload.db.commitTransaction(id)
        return result
      } catch (error) {
        if (id !== null) {
          try {
            await req.payload.db.rollbackTransaction(id)
          } catch {
            throw new RetentionFailure(committing ? 'unknown' : 'not_committed')
          }
        }
        if (error instanceof RetentionBudgetExceeded) throw error
        if (!committing && retryable(error) && attempt < 2) continue
        throw new RetentionFailure(committing ? 'unknown' : 'not_committed')
      }
    }
    throw new RetentionFailure()
  }
  async function ownedControl(transactionReq: PayloadRequest): Promise<ClinicNotificationControl> {
    const control = await req.payload.findByID({
      collection: 'clinicNotificationControls',
      id: controlId!,
      overrideAccess: true,
      depth: 0,
      req: transactionReq,
    })
    if (control.retentionLeaseToken !== token || Date.parse(control.retentionLeaseExpiresAt ?? '') <= Date.now())
      throw new RetentionFailure()
    // The persisted mutation coordinates each batch with any replacement lease owner.
    return req.payload.update({
      collection: 'clinicNotificationControls',
      id: control.id,
      data: { nonce: randomUUID() },
      overrideAccess: true,
      req: transactionReq,
    })
  }
  try {
    if (typeof req.transactionID !== 'undefined') throw new RetentionFailure()
    const claim = await transaction(async (transactionReq) => {
      const prior = (
        await req.payload.find({
          collection: 'clinicNotificationControls',
          where: { key: { equals: 'notification-retention' } },
          overrideAccess: true,
          depth: 0,
          pagination: false,
          limit: 1,
          req: transactionReq,
        })
      ).docs[0]
      if (prior?.retentionLeaseToken && Date.parse(prior.retentionLeaseExpiresAt ?? '') > Date.now()) return null
      const slot = Math.floor(Date.now() / intervalMs)
      const missedSlots = prior?.retentionSlot == null ? 0 : Math.max(0, slot - prior.retentionSlot - 1)
      const recoveredInterruptedRun = prior?.retentionResult === 'running'
      const data = {
        nonce: randomUUID(),
        retentionStartedAt: new Date(
          Math.max(Date.now(), Date.parse(prior?.retentionStartedAt ?? '') || 0),
        ).toISOString(),
        retentionSlot: Math.max(slot, prior?.retentionSlot ?? slot),
        retentionLeaseToken: token,
        retentionLeaseExpiresAt: new Date(Date.now() + leaseMs).toISOString(),
        retentionResult: 'running' as const,
      }
      const control = prior
        ? await req.payload.update({
            collection: 'clinicNotificationControls',
            id: prior.id,
            data,
            overrideAccess: true,
            req: transactionReq,
          })
        : await req.payload.create({
            collection: 'clinicNotificationControls',
            data: { ...data, key: 'notification-retention', active: false },
            overrideAccess: true,
            req: transactionReq,
          })
      return { id: control.id, missedSlots, recoveredInterruptedRun }
    })
    if (!claim) {
      signal.result = 'busy'
      signal.transactionOutcome = 'committed'
    } else {
      controlId = claim.id
      signal.missedSlots = claim.missedSlots
      signal.recoveredInterruptedRun = claim.recoveredInterruptedRun
      for (let batch = 0; batch < maxBatches; batch++) {
        const removed = await transaction(async (transactionReq) => {
          await ownedControl(transactionReq)
          const due = (
            await req.payload.find({
              collection: 'clinicNotificationOccurrences',
              where: { expiresAt: { less_than_equal: new Date().toISOString() } },
              overrideAccess: true,
              depth: 0,
              pagination: false,
              limit: 10,
              sort: 'expiresAt',
              req: transactionReq,
            })
          ).docs
          let receiptsDeleted = 0
          for (const occurrence of due) {
            checkBudget()
            requireNotificationTransaction(transactionReq, await transactionReq.transactionID)
            if (Date.parse(occurrence.expiresAt) > Date.now()) continue
            while (true) {
              const receipts = (
                await req.payload.find({
                  collection: 'clinicNotificationReadReceipts',
                  where: { occurrence: { equals: occurrence.id } },
                  overrideAccess: true,
                  depth: 0,
                  pagination: false,
                  limit: 100,
                  req: transactionReq,
                })
              ).docs
              if (!receipts.length) break
              for (const receipt of receipts) {
                checkBudget()
                requireNotificationTransaction(transactionReq, await transactionReq.transactionID)
                await req.payload.delete({
                  collection: 'clinicNotificationReadReceipts',
                  depth: 0,
                  id: receipt.id,
                  overrideAccess: true,
                  req: transactionReq,
                })
                receiptsDeleted++
              }
            }
            checkBudget()
            requireNotificationTransaction(transactionReq, await transactionReq.transactionID)
            await req.payload.delete({
              collection: 'clinicNotificationOccurrences',
              depth: 0,
              id: occurrence.id,
              overrideAccess: true,
              req: transactionReq,
            })
          }
          return { occurrencesDeleted: due.length, receiptsDeleted }
        })
        signal.occurrencesDeleted += removed.occurrencesDeleted
        signal.receiptsDeleted += removed.receiptsDeleted
        if (removed.occurrencesDeleted < 10) break
      }
      const completed = await transaction(async (transactionReq) => {
        const control = await ownedControl(transactionReq)
        const remaining = await req.payload.find({
          collection: 'clinicNotificationOccurrences',
          where: { expiresAt: { less_than_equal: new Date().toISOString() } },
          limit: 1,
          pagination: false,
          depth: 0,
          overrideAccess: true,
          req: transactionReq,
        })
        const complete = remaining.docs.length === 0
        await req.payload.update({
          collection: 'clinicNotificationControls',
          id: controlId!,
          overrideAccess: true,
          req: transactionReq,
          data: {
            retentionResult: complete ? 'success' : 'incomplete',
            retentionLeaseToken: null,
            retentionLeaseExpiresAt: null,
            ...(complete
              ? {
                  retentionCompletedAt: new Date(
                    Math.max(
                      Date.now(),
                      Date.parse(control.retentionCompletedAt ?? '') || 0,
                      Date.parse(control.retentionStartedAt ?? '') || 0,
                    ),
                  ).toISOString(),
                }
              : {}),
          },
        })
        return complete
      })
      signal.result = completed ? 'success' : 'incomplete'
      signal.transactionOutcome = 'committed'
    }
  } catch (error) {
    signal.result = error instanceof RetentionBudgetExceeded ? 'incomplete' : 'failure'
    signal.transactionOutcome = error instanceof RetentionFailure ? error.outcome : 'not_committed'
    if (controlId !== undefined && signal.transactionOutcome !== 'unknown' && Date.now() < deadline) {
      try {
        await transaction(async (transactionReq) => {
          await ownedControl(transactionReq)
          await req.payload.update({
            collection: 'clinicNotificationControls',
            id: controlId!,
            depth: 0,
            overrideAccess: true,
            req: transactionReq,
            data: {
              retentionResult: signal.result === 'incomplete' ? 'incomplete' : 'failure',
              retentionLeaseToken: null,
              retentionLeaseExpiresAt: null,
            },
          })
        })
      } catch {
        /* A crashed or unavailable owner recovers through its bounded lease. */
      }
    }
  }
  signal.elapsedMs = Math.max(0, Math.floor(Date.now() - started))
  await recordRetentionDiagnostic(req, signal)
  return signal
}

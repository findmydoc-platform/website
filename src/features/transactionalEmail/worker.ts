import { randomUUID } from 'node:crypto'
import type { PayloadRequest, Where } from 'payload'
import type { TransactionalEmailOutbox } from '@/payload-types'
import { commandCatalog, resolveCatalogEntry, type CommandCatalog } from './catalog'
import { validateCommand } from './commands'
import { selectTransactionalEmailRuntime } from './environment'
import { TransactionalEmailError } from './errors'
import { recipientDigest } from './recipientBinding'
import { fakeLinks, renderSyntheticNotification, type LinkGenerator } from './preparation'
import { createFakeDeliveryAdapter, type DeliveryAdapter, type DeliveryLog, type DeliveryOutcome } from './delivery'
import { effectiveDeliveryDeadline as deadline } from './deliveryDeadline'
import { transientFields } from './retentionPolicy'
import { sweepTransactionalEmail } from './retention'
import { workerTransaction } from './workerStorage'

const leaseMilliseconds = 120_000
const stepBudgetMilliseconds = 5_000
const retryDelays = [60_000, 300_000, 1_800_000, 7_200_000, 28_800_000] as const
async function boundedStep<Result>(work: (signal: AbortSignal) => Promise<Result>): Promise<Result> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new TransactionalEmailError('storage-unavailable'))
        }, 4_000)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

export type WorkerClaim = { operationId: string; token: string }
type WorkerOptions = {
  catalog?: CommandCatalog
  now?: () => number
  links?: LinkGenerator
  delivery?: DeliveryAdapter
  log?: (event: DeliveryLog) => void
  crashAfterDelivery?: () => void
}

export function createTransactionalEmailWorker(req: PayloadRequest, options: WorkerOptions = {}) {
  const runtime = selectTransactionalEmailRuntime()
  if (options.delivery && (runtime.environment !== 'test' || process.env.VITEST !== 'true'))
    throw new TransactionalEmailError('environment-unavailable')
  if (options.crashAfterDelivery && (!['test', 'ci'].includes(runtime.environment) || process.env.VITEST !== 'true'))
    throw new TransactionalEmailError('environment-unavailable')
  const now = options.now ?? Date.now
  const catalog = options.catalog ?? commandCatalog
  const links = options.links ?? fakeLinks
  const delivery = options.delivery ?? createFakeDeliveryAdapter()
  const log = options.log ?? ((event: DeliveryLog) => req.payload.logger.info(event))
  const validLease = (record: TransactionalEmailOutbox, claim: WorkerClaim) =>
    record.leaseToken === claim.token && Date.parse(record.leaseExpiresAt ?? '') > now()
  const enoughBudget = (record: TransactionalEmailOutbox) =>
    Date.parse(record.leaseExpiresAt ?? '') - now() > stepBudgetMilliseconds
  const transaction = <Result>(claim: WorkerClaim, work: Parameters<typeof workerTransaction<Result>>[2]) =>
    workerTransaction(req, { kind: 'worker', token: claim.token, now }, work)
  const read = (claim: WorkerClaim) =>
    transaction(claim, async (storage) => {
      const record = await storage.read(Number(claim.operationId))
      if (!validLease(record, claim)) return null
      return record
    })
  const finish = (
    claim: WorkerClaim,
    state: 'accepted' | 'suppressed' | 'failed' | 'expired',
    outcomeCode:
      'fake-accepted' | 'recipient-changed' | 'ineligible' | 'preparation-failed' | 'permanent-failure' | 'expired',
    providerMessageId?: string,
  ) =>
    transaction(claim, async (storage) => {
      const record = await storage.read(Number(claim.operationId))
      if (!validLease(record, claim)) return false
      const timestamp = new Date(now()).toISOString()
      await storage.write(
        record,
        {
          state,
          ...transientFields,
          terminalAt: timestamp,
          scrubbedAt: timestamp,
          ...(state === 'accepted' ? { providerAcceptedAt: timestamp, providerMessageId } : {}),
        },
        [
          {
            type:
              outcomeCode === 'preparation-failed'
                ? 'preparation.failed'
                : state === 'accepted'
                  ? 'delivery.accepted'
                  : state === 'suppressed'
                    ? 'delivery.suppressed'
                    : state === 'expired'
                      ? 'delivery.expired'
                      : 'delivery.failed',
            outcomeCode,
            attemptNumber: record.attemptCount || undefined,
          },
          { type: 'payload.scrubbed' },
        ],
      )
      return true
    })
  const revalidate = async (claim: WorkerClaim, record: TransactionalEmailOutbox) => {
    if (deadline(record) - now() <= stepBudgetMilliseconds || (record.attemptCount ?? 0) >= 6) {
      await finish(claim, 'expired', 'expired')
      return false
    }
    if (!enoughBudget(record)) return false
    const command = validateCommand(record.commandPayload)
    const entry = resolveCatalogEntry(catalog, command).worker
    if (!entry) throw new TransactionalEmailError('unsupported-command')
    const current = await boundedStep(() => entry.revalidate(command))
    if (
      !current ||
      current.address !== record.recipientAddress ||
      recipientDigest(current) !== record.recipientDigest
    ) {
      await finish(claim, entry.terminalState, current ? 'recipient-changed' : 'ineligible')
      return false
    }
    if (deadline(record) - now() <= stepBudgetMilliseconds) {
      await finish(claim, 'expired', 'expired')
      return false
    }
    return enoughBudget(record)
  }

  const dueAt = (record: TransactionalEmailOutbox) =>
    record.nextAttemptAt
      ? Date.parse(record.nextAttemptAt)
      : record.attemptCount && record.lastAttemptAt
        ? Date.parse(record.lastAttemptAt) + (retryDelays[record.attemptCount - 1] ?? 0)
        : 0

  async function claim(operationId: string, mayClaim: () => boolean = () => true): Promise<WorkerClaim | null> {
    if (!mayClaim()) return null
    const token = randomUUID()
    return workerTransaction(req, { kind: 'claim', token, now }, async (storage) => {
      if (!mayClaim()) return null
      const record = await storage.read(Number(operationId))
      if (
        !mayClaim() ||
        record.runtimeEnvironment !== runtime.environment ||
        !['queued', 'prepared'].includes(record.state) ||
        (record.leaseExpiresAt && Date.parse(record.leaseExpiresAt) > now()) ||
        (dueAt(record) > now() && deadline(record) - now() > stepBudgetMilliseconds)
      )
        return null
      await storage.write(
        record,
        { leaseToken: token, leaseExpiresAt: new Date(now() + leaseMilliseconds).toISOString() },
        [{ type: 'lease.acquired' }],
      )
      return { operationId, token }
    })
  }

  async function processClaim(claim: WorkerClaim) {
    let record = await read(claim)
    if (!record) return
    if (record.attemptCount && !record.nextAttemptAt && record.lastAttemptAt && !record.firstAmbiguousAt) {
      const recovered = await transaction(claim, async (storage) => {
        const current = await storage.read(Number(claim.operationId))
        if (!validLease(current, claim)) return null
        return storage.write(current, { firstAmbiguousAt: current.lastAttemptAt }, [
          { type: 'delivery.ambiguous', outcomeCode: 'ambiguous', attemptNumber: current.attemptCount! },
        ])
      })
      if (!recovered) return
      record = recovered
    }
    if (!(await revalidate(claim, record))) return
    if (record.state === 'queued') {
      let prepared
      try {
        const actionLink = await boundedStep(() => links.generate())
        if (!(await revalidate(claim, record))) return
        const recipientAddress = record.recipientAddress!
        prepared = await boundedStep(() => renderSyntheticNotification(recipientAddress, actionLink))
      } catch {
        await finish(claim, 'failed', 'preparation-failed')
        return
      }
      const saved = await transaction(claim, async (storage) => {
        const current = await storage.read(Number(claim.operationId))
        if (!validLease(current, claim)) return null
        return storage.write(
          current,
          {
            state: 'prepared',
            preparedSubject: prepared.subject,
            preparedHtml: prepared.html,
            preparedText: prepared.text,
            preparedAt: new Date(now()).toISOString(),
          },
          [{ type: 'preparation.completed' }],
        )
      })
      if (!saved) return
      record = saved
    }
    if (record.state !== 'prepared' || !(await revalidate(claim, record))) return
    const started = await transaction(claim, async (storage) => {
      const current = await storage.read(Number(claim.operationId))
      if (
        !validLease(current, claim) ||
        !enoughBudget(current) ||
        deadline(current) - now() <= stepBudgetMilliseconds ||
        (current.attemptCount ?? 0) >= 6
      )
        return null
      return storage.write(
        current,
        {
          attemptCount: (current.attemptCount ?? 0) + 1,
          lastAttemptAt: new Date(now()).toISOString(),
          nextAttemptAt: null,
        },
        [{ type: 'delivery.attempt-started', attemptNumber: (current.attemptCount ?? 0) + 1 }],
      )
    })
    const afterAttempt = started ?? (await read(claim))
    if (afterAttempt && deadline(afterAttempt) - now() <= stepBudgetMilliseconds) {
      await finish(claim, 'expired', 'expired')
      return
    }
    if (!started || !enoughBudget(started)) return
    let result: DeliveryOutcome
    try {
      result = await boundedStep((signal) =>
        delivery.deliver(
          {
            recipientAddress: started.recipientAddress!,
            subject: started.preparedSubject!,
            html: started.preparedHtml!,
            text: started.preparedText!,
            providerIdempotencyKey: started.providerIdempotencyKey,
          },
          signal,
        ),
      )
    } catch {
      result = { type: 'ambiguous' }
    }
    options.crashAfterDelivery?.()
    const outcomeCode =
      result.type === 'accepted'
        ? 'fake-accepted'
        : result.type === 'retryable'
          ? 'retryable-failure'
          : result.type === 'ambiguous'
            ? 'ambiguous'
            : result.type === 'suppressed'
              ? 'ineligible'
              : 'permanent-failure'
    log({
      operationId: claim.operationId,
      commandType: started.commandType,
      attemptNumber: started.attemptCount!,
      outcomeCode,
      environment: runtime.environment,
    })
    if (result.type === 'retryable' || result.type === 'ambiguous') {
      const next = retryDelays[started.attemptCount! - 1]
      if (
        next === undefined ||
        now() + next + stepBudgetMilliseconds >=
          Math.min(
            deadline(started),
            result.type === 'ambiguous'
              ? Date.parse(started.firstAmbiguousAt ?? started.lastAttemptAt!) + 86_400_000
              : Infinity,
          )
      ) {
        await finish(claim, 'expired', 'expired')
        return
      }
      await transaction(claim, async (storage) => {
        const current = await storage.read(Number(claim.operationId))
        if (!validLease(current, claim)) return
        await storage.write(
          current,
          {
            nextAttemptAt: new Date(now() + retryDelays[current.attemptCount! - 1]!).toISOString(),
            leaseToken: null,
            leaseExpiresAt: null,
            ...(result.type === 'ambiguous'
              ? { firstAmbiguousAt: current.firstAmbiguousAt ?? current.lastAttemptAt }
              : {}),
          },
          [
            {
              type: result.type === 'ambiguous' ? 'delivery.ambiguous' : 'delivery.retry-scheduled',
              outcomeCode,
              attemptNumber: current.attemptCount!,
            },
          ],
        )
      })
      return
    }
    await finish(
      claim,
      result.type === 'accepted' ? 'accepted' : result.type === 'suppressed' ? 'suppressed' : 'failed',
      result.type === 'accepted' ? 'fake-accepted' : result.type === 'suppressed' ? 'ineligible' : 'permanent-failure',
      result.type === 'accepted' ? result.messageId : undefined,
    )
  }
  return {
    sweepForBatch: (mayContinue: () => boolean) =>
      sweepTransactionalEmail(req, runtime.environment, now, { mayContinue }),
    candidatesForBatch: async (afterId: number) => {
      const timestamp = now()
      const legacyDue: Where[] = [
        { lastAttemptAt: { exists: false } },
        ...retryDelays.map((delay, index) => ({
          attemptCount: { equals: index + 1 },
          lastAttemptAt: { less_than_equal: new Date(timestamp - delay).toISOString() },
        })),
        {
          attemptCount: { greater_than_equal: 6 },
          lastAttemptAt: { less_than_equal: new Date(timestamp).toISOString() },
        },
      ]
      const records = await workerTransaction(req, { kind: 'claim', token: randomUUID(), now }, (storage) =>
        storage.find({
          and: [
            { runtimeEnvironment: { equals: runtime.environment } },
            { state: { in: ['queued', 'prepared'] } },
            { id: { greater_than: afterId } },
            {
              or: [
                { nextAttemptAt: { less_than_equal: new Date(timestamp).toISOString() } },
                { and: [{ nextAttemptAt: { exists: false } }, { or: legacyDue }] },
              ],
            },
          ],
        }),
      )
      return records.map(({ id }) => id)
    },
    claimForBatch: (operationId: string, mayClaim: () => boolean) => claim(operationId, mayClaim),
    processClaimForBatch: processClaim,
    async claim(operationId: string) {
      await sweepTransactionalEmail(req, runtime.environment, now)
      return claim(operationId)
    },
    async processClaim(acquired: WorkerClaim) {
      await sweepTransactionalEmail(req, runtime.environment, now)
      return processClaim(acquired)
    },
    async run(operationId?: string) {
      await sweepTransactionalEmail(req, runtime.environment, now)
      if (!operationId) return
      const acquired = await claim(operationId)
      if (acquired) await processClaim(acquired)
    },
  }
}

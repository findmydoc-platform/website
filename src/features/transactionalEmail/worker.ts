import {
  createLettermintDeliveryAdapter,
  lettermintTimeoutMilliseconds,
  type LettermintHttpTransport,
} from './lettermintDelivery'
import { randomUUID } from 'node:crypto'
import type { PayloadRequest, Where } from 'payload'
import type { TransactionalEmailOutbox, TransactionalEmailEvent } from '@/payload-types'
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
import { requireActivationPolicy, type ActivationPolicy } from './activationPolicy'
import { createSuppressionLookup, type SuppressionLookup } from './suppression'
import { requireVerifiedHostedBinding, type HostedLettermintBinding } from './hostedConfiguration'
import { prepareProviderRequest, providerBindingFields, storedProviderRequest } from './providerPreparation'
import {
  createDeliveryEdgeSignals,
  durationBucketFor,
  queueAgeBucketFor,
  type DeliveryEdgeMetricSink,
} from './operationalSignals'

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
  httpTransport?: LettermintHttpTransport
  log?: (event: DeliveryLog) => void
  metric?: DeliveryEdgeMetricSink
  crashAfterDelivery?: () => void
  activationPolicy?: ActivationPolicy
  suppression?: SuppressionLookup
  providerBinding?: HostedLettermintBinding
}

export function createTransactionalEmailWorker(req: PayloadRequest, options: WorkerOptions = {}) {
  const runtime = selectTransactionalEmailRuntime()
  const providerBinding = options.providerBinding
  const suppressionLookup = providerBinding ? createSuppressionLookup(req, providerBinding) : options.suppression
  if (options.activationPolicy) {
    if (runtime.environment !== 'test' || process.env.VITEST !== 'true')
      throw new TransactionalEmailError('environment-unavailable')
    requireActivationPolicy(options.activationPolicy)
  }
  const activationPolicy = options.activationPolicy ?? runtime.activationPolicy
  if (providerBinding) {
    if (runtime.environment !== 'test' || process.env.VITEST !== 'true')
      throw new TransactionalEmailError('environment-unavailable')
    requireVerifiedHostedBinding(providerBinding)
    requireActivationPolicy(activationPolicy, providerBinding)
  }
  if (options.delivery && (runtime.environment !== 'test' || process.env.VITEST !== 'true'))
    throw new TransactionalEmailError('environment-unavailable')
  if ((options.log || options.metric) && (runtime.environment !== 'test' || process.env.VITEST !== 'true'))
    throw new TransactionalEmailError('environment-unavailable')
  if (options.crashAfterDelivery && (!['test', 'ci'].includes(runtime.environment) || process.env.VITEST !== 'true'))
    throw new TransactionalEmailError('environment-unavailable')
  const now = options.now ?? Date.now
  const catalog = options.catalog ?? commandCatalog
  const links = options.links ?? fakeLinks
  if (options.httpTransport && (!providerBinding || options.delivery))
    throw new TransactionalEmailError('environment-unavailable')
  const delivery =
    options.httpTransport && providerBinding
      ? createLettermintDeliveryAdapter(providerBinding, options.httpTransport)
      : (options.delivery ?? createFakeDeliveryAdapter())
  const deliveryBudget = options.httpTransport
    ? lettermintTimeoutMilliseconds + stepBudgetMilliseconds
    : stepBudgetMilliseconds
  const log = options.log ?? ((event: DeliveryLog) => req.payload.logger.info(event))
  const signals = createDeliveryEdgeSignals({ log, metric: options.metric })
  const emit = (event: Omit<DeliveryLog, 'environment'> & { environment?: DeliveryLog['environment'] }) =>
    signals.emit({ ...event, environment: runtime.environment })
  const validLease = (record: TransactionalEmailOutbox, claim: WorkerClaim) =>
    record.leaseToken === claim.token && Date.parse(record.leaseExpiresAt ?? '') > now()
  const enoughBudget = (record: TransactionalEmailOutbox, budget = stepBudgetMilliseconds) =>
    Date.parse(record.leaseExpiresAt ?? '') - now() > budget
  const transaction = <Result>(claim: WorkerClaim, work: Parameters<typeof workerTransaction<Result>>[2]) =>
    workerTransaction(req, { kind: 'worker', token: claim.token, now }, work)
  const read = (claim: WorkerClaim) =>
    transaction(claim, async (storage) => {
      const record = await storage.read(Number(claim.operationId))
      if (!validLease(record, claim)) return null
      return record
    })
  const observeState = async (claim: WorkerClaim) => {
    try {
      return await transaction(claim, async (storage) => (await storage.read(Number(claim.operationId))).state)
    } catch {
      return undefined
    }
  }
  const finish = async (
    claim: WorkerClaim,
    state: 'accepted' | 'suppressed' | 'failed' | 'expired',
    outcomeCode: NonNullable<TransactionalEmailEvent['outcomeCode']>,
    providerMessageId?: string,
  ) => {
    const result = await transaction(claim, async (storage) => {
      const record = await storage.read(Number(claim.operationId))
      // Verified feedback can establish acceptance and clear the lease before this worker resumes.
      if (state === 'accepted' && record.providerMessageId) {
        if (record.providerMessageId !== providerMessageId) return 'provider-event-mismatch'
        if (['accepted', 'delivered', 'bounced', 'complained'].includes(record.state)) return record.state
      }
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
      return state
    })
    if (result === 'provider-event-mismatch') {
      emit({ outcomeCode: result })
      return false
    }
    return result
  }
  const revalidate = async (claim: WorkerClaim, record: TransactionalEmailOutbox) => {
    if (deadline(record) - now() <= stepBudgetMilliseconds || (record.attemptCount ?? 0) >= 6) {
      if (await finish(claim, 'expired', 'expired'))
        emit({
          operationId: claim.operationId,
          commandType: record.commandType,
          attemptNumber: record.attemptCount || undefined,
          outcomeCode: 'expired',
          outboxState: 'expired',
        })
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
      const outcomeCode = current ? 'recipient-changed' : 'ineligible'
      if (await finish(claim, entry.terminalState, outcomeCode))
        emit({
          operationId: claim.operationId,
          commandType: record.commandType,
          attemptNumber: record.attemptCount || undefined,
          outcomeCode,
          outboxState: entry.terminalState,
        })
      return false
    }
    const suppression = activationPolicy.evaluate(command.type, current.address)
    if (suppression) {
      if (await finish(claim, 'suppressed', suppression))
        emit({
          operationId: claim.operationId,
          commandType: record.commandType,
          attemptNumber: record.attemptCount || undefined,
          outcomeCode: suppression,
          outboxState: 'suppressed',
        })
      return false
    }
    let decision: Awaited<ReturnType<SuppressionLookup>> = 'unavailable'
    try {
      if (suppressionLookup)
        decision = await boundedStep((signal) =>
          suppressionLookup(
            { address: current.address, environment: providerBinding?.target.environment ?? runtime.environment },
            signal,
          ),
        )
      if (decision === 'cleared' && providerBinding && options.suppression)
        decision = await boundedStep((signal) =>
          options.suppression!({ address: current.address, environment: providerBinding.target.environment }, signal),
        )
    } catch {
      emit({
        operationId: claim.operationId,
        commandType: record.commandType,
        attemptNumber: record.attemptCount || undefined,
        outcomeCode: 'suppression-unavailable',
        outboxState: record.state,
      })
      return false
    }
    if (decision !== 'cleared') {
      if (decision === 'suppressed') {
        if (await finish(claim, 'suppressed', 'ineligible'))
          emit({
            operationId: claim.operationId,
            commandType: record.commandType,
            attemptNumber: record.attemptCount || undefined,
            outcomeCode: 'suppression-hit',
            outboxState: 'suppressed',
          })
      } else {
        emit({
          operationId: claim.operationId,
          commandType: record.commandType,
          attemptNumber: record.attemptCount || undefined,
          outcomeCode: 'suppression-unavailable',
          outboxState: record.state,
        })
      }
      return false
    }
    if (deadline(record) - now() <= stepBudgetMilliseconds) {
      if (await finish(claim, 'expired', 'expired'))
        emit({
          operationId: claim.operationId,
          commandType: record.commandType,
          attemptNumber: record.attemptCount || undefined,
          outcomeCode: 'expired',
          outboxState: 'expired',
        })
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
    if (record.preparedProviderRequest || providerBindingFields.some((field) => record![field] != null)) {
      if (!providerBinding) throw new TransactionalEmailError('environment-unavailable')
      prepareProviderRequest(record, providerBinding)
    }
    if (record.state === 'queued') {
      let prepared
      try {
        const actionLink = await boundedStep(() => links.generate())
        if (!(await revalidate(claim, record))) return
        const recipientAddress = record.recipientAddress!
        prepared = await boundedStep(() => renderSyntheticNotification(recipientAddress, actionLink))
      } catch {
        if (await finish(claim, 'failed', 'preparation-failed'))
          emit({
            operationId: claim.operationId,
            commandType: record.commandType,
            attemptNumber: record.attemptCount || undefined,
            outcomeCode: 'preparation-failed',
            outboxState: 'failed',
          })
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
    if (deadline(record) - now() <= deliveryBudget) {
      if (await finish(claim, 'expired', 'expired'))
        emit({
          operationId: claim.operationId,
          commandType: record.commandType,
          attemptNumber: record.attemptCount || undefined,
          outcomeCode: 'expired',
          outboxState: 'expired',
        })
      return
    }
    const started = await transaction(claim, async (storage) => {
      const current = await storage.read(Number(claim.operationId))
      if (
        !validLease(current, claim) ||
        !enoughBudget(current, deliveryBudget) ||
        deadline(current) - now() <= deliveryBudget ||
        (current.attemptCount ?? 0) >= 6
      )
        return null
      return storage.write(
        current,
        {
          ...(providerBinding ? prepareProviderRequest(current, providerBinding) : {}),
          attemptCount: (current.attemptCount ?? 0) + 1,
          lastAttemptAt: new Date(now()).toISOString(),
          nextAttemptAt: null,
        },
        [{ type: 'delivery.attempt-started', attemptNumber: (current.attemptCount ?? 0) + 1 }],
      )
    })
    const afterAttempt = started ?? (await read(claim))
    if (afterAttempt && deadline(afterAttempt) - now() <= deliveryBudget) {
      if (await finish(claim, 'expired', 'expired'))
        emit({
          operationId: claim.operationId,
          commandType: afterAttempt.commandType,
          attemptNumber: afterAttempt.attemptCount || undefined,
          outcomeCode: 'expired',
          outboxState: 'expired',
        })
      return
    }
    if (!started || !enoughBudget(started, deliveryBudget)) return
    let result: DeliveryOutcome
    try {
      const deliver = (signal?: AbortSignal) =>
        delivery.deliver(
          {
            recipientAddress: started.recipientAddress!,
            subject: started.preparedSubject!,
            html: started.preparedHtml!,
            text: started.preparedText!,
            providerIdempotencyKey: started.providerIdempotencyKey,
            ...(providerBinding ? { providerRequest: storedProviderRequest(started) } : {}),
          },
          signal,
        )
      result = options.httpTransport ? await deliver() : await boundedStep(deliver)
    } catch {
      result = { type: 'ambiguous' }
    }
    options.crashAfterDelivery?.()
    const outcomeCode =
      result.outcomeCode ??
      (result.type === 'accepted'
        ? (result.outcomeCode ?? 'fake-accepted')
        : result.type === 'retryable'
          ? 'retryable-failure'
          : result.type === 'ambiguous'
            ? 'ambiguous'
            : result.type === 'suppressed'
              ? 'ineligible'
              : 'permanent-failure')
    const deliveryLog: Omit<DeliveryLog, 'outboxState'> = {
      operationId: claim.operationId,
      commandType: started.commandType,
      attemptNumber: started.attemptCount!,
      outcomeCode: result.alert === 'configuration' ? 'configuration-drift' : outcomeCode,
      environment: runtime.environment,
      durationBucket: durationBucketFor(now() - Date.parse(started.lastAttemptAt!)),
      queueAgeBucket: queueAgeBucketFor(Date.parse(started.lastAttemptAt!) - Date.parse(started.createdAt)),
    }
    if (result.type === 'retryable' || result.type === 'ambiguous') {
      const next = retryDelays[started.attemptCount! - 1]
      if (
        next === undefined ||
        now() + next + deliveryBudget >=
          Math.min(
            deadline(started),
            result.type === 'ambiguous'
              ? Date.parse(started.firstAmbiguousAt ?? started.lastAttemptAt!) + 86_400_000
              : Infinity,
          )
      ) {
        if (await finish(claim, 'expired', 'expired'))
          emit({
            operationId: claim.operationId,
            commandType: started.commandType,
            attemptNumber: started.attemptCount ?? undefined,
            outcomeCode: 'expired',
            outboxState: 'expired',
          })
        return
      }
      const scheduled = await transaction(claim, async (storage) => {
        const current = await storage.read(Number(claim.operationId))
        if (!validLease(current, claim)) return current
        return storage.write(
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
      if (scheduled) signals.emit({ ...deliveryLog, outboxState: scheduled.state })
      return
    }
    const completed = await finish(
      claim,
      result.type === 'accepted' ? 'accepted' : result.type === 'suppressed' ? 'suppressed' : 'failed',
      outcomeCode,
      result.type === 'accepted' ? result.messageId : undefined,
    )
    const outboxState = completed || (await observeState(claim))
    if (outboxState) signals.emit({ ...deliveryLog, outboxState })
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

import { randomUUID } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import type { TransactionalEmailOutbox } from '@/payload-types'
import { commandCatalog, resolveCatalogEntry, type CommandCatalog } from './catalog'
import { validateCommand } from './commands'
import { selectTransactionalEmailRuntime } from './environment'
import { TransactionalEmailError } from './errors'
import { recipientDigest } from './recipientBinding'
import { fakeLinks, renderSyntheticNotification, type LinkGenerator } from './preparation'
import { createFakeDeliveryAdapter, type DeliveryAdapter, type DeliveryLog } from './delivery'
import { workerTransaction } from './workerStorage'

const leaseMilliseconds = 120_000
const stepBudgetMilliseconds = 5_000
export type WorkerClaim = { operationId: string; token: string }
type WorkerOptions = {
  catalog?: CommandCatalog
  now?: () => number
  links?: LinkGenerator
  delivery?: DeliveryAdapter
  log?: (event: DeliveryLog) => void
}

export function createTransactionalEmailWorker(req: PayloadRequest, options: WorkerOptions = {}) {
  const runtime = selectTransactionalEmailRuntime()
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
    state: 'accepted' | 'suppressed' | 'failed',
    outcomeCode: 'fake-accepted' | 'recipient-changed' | 'ineligible' | 'preparation-failed' | 'permanent-failure',
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
          commandPayload: null,
          recipientAddress: null,
          preparedSubject: null,
          preparedHtml: null,
          preparedText: null,
          leaseToken: null,
          leaseExpiresAt: null,
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
    if (!enoughBudget(record)) return false
    const command = validateCommand(record.commandPayload)
    const entry = resolveCatalogEntry(catalog, command).worker
    if (!entry) throw new TransactionalEmailError('unsupported-command')
    const current = await entry.revalidate(command)
    if (
      !current ||
      current.address !== record.recipientAddress ||
      recipientDigest(current) !== record.recipientDigest
    ) {
      await finish(claim, entry.terminalState, current ? 'recipient-changed' : 'ineligible')
      return false
    }
    return enoughBudget(record)
  }

  async function claim(operationId: string): Promise<WorkerClaim | null> {
    const token = randomUUID()
    return workerTransaction(req, { kind: 'claim', token, now }, async (storage) => {
      const record = await storage.read(Number(operationId))
      if (
        record.runtimeEnvironment !== runtime.environment ||
        !['queued', 'prepared'].includes(record.state) ||
        (record.leaseExpiresAt && Date.parse(record.leaseExpiresAt) > now()) ||
        record.attemptCount
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
    if (!record || !(await revalidate(claim, record))) return
    if (record.state === 'queued') {
      let prepared
      try {
        const actionLink = await links.generate()
        if (!(await revalidate(claim, record))) return
        prepared = await renderSyntheticNotification(record.recipientAddress!, actionLink)
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
      if (!validLease(current, claim) || !enoughBudget(current) || current.attemptCount) return null
      return storage.write(current, { attemptCount: 1, lastAttemptAt: new Date(now()).toISOString() }, [
        { type: 'delivery.attempt-started', attemptNumber: 1 },
      ])
    })
    if (!started || !enoughBudget(started)) return
    const result = await delivery.deliver({
      recipientAddress: started.recipientAddress!,
      subject: started.preparedSubject!,
      html: started.preparedHtml!,
      text: started.preparedText!,
      providerIdempotencyKey: started.providerIdempotencyKey,
    })
    const outcomeCode = result.type === 'accepted' ? 'fake-accepted' : 'permanent-failure'
    log({
      operationId: claim.operationId,
      commandType: started.commandType,
      attemptNumber: 1,
      outcomeCode,
      environment: runtime.environment,
    })
    await finish(
      claim,
      result.type === 'accepted' ? 'accepted' : 'failed',
      outcomeCode,
      result.type === 'accepted' ? result.messageId : undefined,
    )
  }
  return {
    claim,
    processClaim,
    async run(operationId: string) {
      const acquired = await claim(operationId)
      if (acquired) await processClaim(acquired)
    },
  }
}

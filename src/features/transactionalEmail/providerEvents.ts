import { createLocalReq, type PayloadRequest } from 'payload'
import { authorizeEventAppends, openStorageCapability } from './capability'
import { TransactionalEmailError } from './errors'
import { selectTransactionalEmailRuntime } from './environment'
import { runOwnedTransaction } from './transactions'
import { lettermintEventMapping, type VerifiedLettermintEvent } from './lettermintEvent'
import { transientFields } from './retentionPolicy'
import type { WebhookDeadline } from './webhookDeadline'
import type { TransactionalEmailEvent, TransactionalEmailOutbox } from '@/payload-types'
import { applyVerifiedSuppression } from './suppression'
import { requireVerifiedLettermintEvent } from './lettermintEvent'

type EventResult = Pick<TransactionalEmailEvent, 'type'> &
  Partial<
    Pick<TransactionalEmailEvent, 'providerEventId' | 'providerEventType' | 'providerMessageId' | 'sourceOccurredAt'>
  >

type ProviderOutcome = 'delivered' | 'bounced' | 'complained'
type ProviderEventInput = {
  outbox: number
  providerEventId: string
  type: `delivery.${ProviderOutcome}`
  sourceOccurredAt?: string
  transitionTo?: ProviderOutcome
}

/** Private verified-event transaction. Correlation, replay comparison and every effect share its commit. */
export async function applyLettermintEvent(
  req: PayloadRequest,
  verified: VerifiedLettermintEvent,
  deadline: WebhookDeadline,
) {
  requireVerifiedLettermintEvent(verified)
  deadline.check()
  const { envelope: event, environment } = verified
  const metadata = event.data.metadata
  const operationId = metadata?.operation_id
  // Payload's current operation identifiers are positive PostgreSQL int4 values.
  if (!operationId || !/^[1-9][0-9]*$/.test(operationId) || Number(operationId) > 2147483647)
    return 'provider-event-unmatched'
  return runOwnedTransaction(
    req,
    async (_, transactionID) => {
      const capability = openStorageCapability(transactionID, { kind: 'provider', token: '', now: Date.now })
      try {
        const internalReq = await createLocalReq(
          { context: capability.context, req: { transactionID: Promise.resolve(transactionID) } },
          req.payload,
        )
        await deadline.beforeOperation(internalReq, transactionID)
        const {
          docs: [found],
        } = await req.payload.find({
          collection: 'transactionalEmailOutbox',
          req: internalReq,
          depth: 0,
          limit: 1,
          where: { id: { equals: Number(operationId) } },
        })
        if (!found) return 'provider-event-unmatched'
        let record: TransactionalEmailOutbox = found
        if (
          record.runtimeEnvironment !== environment ||
          metadata?.environment !== environment ||
          record.commandType !== metadata.command_type ||
          record.providerTeamId !== event.context.team_id ||
          record.providerProjectId !== event.context.project_id ||
          record.providerRouteId !== event.context.route_id ||
          (verified.recipientDigest !== undefined && record.providerRecipientDigest !== verified.recipientDigest) ||
          (event.data.message_id && record.providerMessageId && record.providerMessageId !== event.data.message_id)
        )
          return 'provider-event-mismatch'
        await deadline.beforeOperation(internalReq, transactionID)
        const {
          docs: [existing],
        } = await req.payload.find({
          collection: 'transactionalEmailEvents',
          req: internalReq,
          depth: 0,
          limit: 1,
          where: { providerEventId: { equals: event.id } },
        })
        if (existing)
          return existing.outbox === record.id &&
            existing.providerEventType === event.event &&
            existing.sourceOccurredAt === event.timestamp &&
            existing.providerMessageId === (event.data.message_id ?? null)
            ? 'provider-event-duplicate'
            : 'provider-event-mismatch'
        const type = Object.hasOwn(lettermintEventMapping, event.event)
          ? lettermintEventMapping[event.event as keyof typeof lettermintEventMapping]
          : 'provider.event-ignored'
        await applyVerifiedSuppression(internalReq, verified, deadline)
        // This writer remains inside the owning transaction so later suppression effects can share its commit.
        const write = async (data: Partial<TransactionalEmailOutbox>, events: EventResult[]) => {
          const sequence = record.latestEventSequence
          await deadline.beforeOperation(internalReq, transactionID)
          record = await req.payload.update({
            collection: 'transactionalEmailOutbox',
            req: internalReq,
            id: record.id,
            depth: 0,
            data: { ...data, latestEventSequence: sequence + events.length },
          })
          authorizeEventAppends(
            internalReq,
            record.id,
            events.map((_, index) => sequence + index + 1),
          )
          for (const [index, result] of events.entries()) {
            await deadline.beforeOperation(internalReq, transactionID)
            await req.payload.create({
              collection: 'transactionalEmailEvents',
              req: internalReq,
              depth: 0,
              data: { ...result, source: 'provider', outbox: record.id, sequence: sequence + index + 1 },
            })
          }
        }
        if (record.state === 'prepared' && type !== 'provider.event-ignored') {
          const rejected = type === 'provider.suppressed' || type === 'provider.policy-rejected'
          const timestamp = new Date(Date.now()).toISOString()
          await write(
            {
              ...transientFields,
              state: rejected ? 'failed' : 'accepted',
              providerMessageId: event.data.message_id,
              ...(!rejected ? { providerAcceptedAt: timestamp } : {}),
              terminalAt: timestamp,
              scrubbedAt: timestamp,
            },
            [{ type: rejected ? 'delivery.failed' : 'delivery.accepted' }, { type: 'payload.scrubbed' }],
          )
        }
        const terminalState =
          type === 'delivery.delivered'
            ? 'delivered'
            : type === 'delivery.bounced'
              ? 'bounced'
              : type === 'delivery.complained'
                ? 'complained'
                : undefined
        await write(
          {
            ...(type !== 'provider.event-ignored' && !record.providerMessageId
              ? { providerMessageId: event.data.message_id }
              : {}),
            ...(record.state === 'accepted' && terminalState ? { state: terminalState } : {}),
          },
          [
            {
              type,
              providerEventId: event.id,
              providerEventType: event.event,
              providerMessageId: event.data.message_id,
              sourceOccurredAt: event.timestamp,
            },
          ],
        )
        return type === 'provider.event-ignored' ? 'provider-event-ignored' : 'provider-event-applied'
      } finally {
        capability.close()
      }
    },
    deadline,
  )
}

/** Private storage seam. The delivery edge owns verification and whether an outcome should change state. */
export async function appendProviderEvent(req: PayloadRequest, input: ProviderEventInput) {
  const runtime = selectTransactionalEmailRuntime()
  if (
    !input ||
    Object.keys(input).some(
      (key) => !['outbox', 'providerEventId', 'type', 'sourceOccurredAt', 'transitionTo'].includes(key),
    ) ||
    !Number.isSafeInteger(input.outbox) ||
    input.outbox <= 0 ||
    typeof input.providerEventId !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,200}$/.test(input.providerEventId) ||
    !['delivery.delivered', 'delivery.bounced', 'delivery.complained'].includes(input.type) ||
    (input.transitionTo !== undefined && input.type !== `delivery.${input.transitionTo}`) ||
    (input.sourceOccurredAt !== undefined && !Number.isFinite(Date.parse(input.sourceOccurredAt)))
  )
    throw new TransactionalEmailError('invalid-command')
  return runOwnedTransaction(req, async (_, transactionID) => {
    const capability = openStorageCapability(transactionID, { kind: 'provider', token: '', now: Date.now })
    try {
      const internalReq = await createLocalReq(
        { context: capability.context, req: { transactionID: Promise.resolve(transactionID) } },
        req.payload,
      )
      const record = await req.payload.findByID({
        collection: 'transactionalEmailOutbox',
        id: input.outbox,
        req: internalReq,
        depth: 0,
      })
      if (record.runtimeEnvironment !== runtime.environment) throw new TransactionalEmailError('access-denied')
      const existing = await req.payload.find({
        collection: 'transactionalEmailEvents',
        req: internalReq,
        depth: 0,
        limit: 1,
        where: { providerEventId: { equals: input.providerEventId } },
      })
      if (existing.docs[0]) {
        if (existing.docs[0].outbox !== input.outbox) throw new TransactionalEmailError('access-denied')
        return existing.docs[0]
      }
      const sequence = record.latestEventSequence + 1
      await req.payload.update({
        collection: 'transactionalEmailOutbox',
        id: record.id,
        req: internalReq,
        depth: 0,
        data: { latestEventSequence: sequence, ...(input.transitionTo ? { state: input.transitionTo } : {}) },
      })
      authorizeEventAppends(internalReq, record.id, [sequence])
      return await req.payload.create({
        collection: 'transactionalEmailEvents',
        req: internalReq,
        depth: 0,
        data: {
          outbox: record.id,
          sequence,
          source: 'provider',
          type: input.type,
          providerEventId: input.providerEventId,
          sourceOccurredAt: input.sourceOccurredAt,
        },
      })
    } finally {
      capability.close()
    }
  })
}

import { createLocalReq, type PayloadRequest } from 'payload'
import { authorizeEventAppends, openStorageCapability } from './capability'
import { TransactionalEmailError } from './errors'
import { selectTransactionalEmailRuntime } from './environment'
import { runOwnedTransaction } from './transactions'

type ProviderOutcome = 'delivered' | 'bounced' | 'complained'
type ProviderEventInput = {
  outbox: number
  providerEventId: string
  type: `delivery.${ProviderOutcome}`
  sourceOccurredAt?: string
  transitionTo?: ProviderOutcome
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

import type { EmailEnvironment } from './environment'
import {
  createLocalReq,
  type PayloadRequest,
  type CollectionBeforeOperationHook,
  type CollectionBeforeChangeHook,
  type CollectionAfterReadHook,
} from 'payload'
import { requireStorageCapability } from './capability'
import { TransactionalEmailError } from './errors'
import { runOwnedTransaction, isActiveTransaction } from './transactions'
import { recipientAddressDigest } from './recipientBinding'
import { requireVerifiedHostedBinding, type HostedLettermintBinding } from './hostedConfiguration'
import type { WebhookDeadline } from './webhookDeadline'
import type { VerifiedLettermintEvent } from './lettermintEvent'
import { requireVerifiedLettermintEvent } from './lettermintEvent'

type SuppressionIdentity = { runtimeEnvironment: 'preview' | 'production'; recipientDigest: string }
type SuppressionWrite = SuppressionIdentity & {
  reason: 'hard-bounce' | 'spam-complaint'
  firstObservedAt: string
  lastObservedAt: string
  source: 'lettermint'
}
const scopes = new WeakMap<object, SuppressionIdentity & { transactionID: string | number; write?: SuppressionWrite }>()

async function scopeFor(req: PayloadRequest) {
  const identity: unknown = req.context.transactionalEmailSuppression
  const scope = identity && typeof identity === 'object' ? scopes.get(identity) : undefined
  if (!scope || scope.transactionID !== (await req.transactionID) || !isActiveTransaction(req, scope.transactionID))
    throw new TransactionalEmailError('access-denied')
  return scope
}

export const guardSuppressionOperation: CollectionBeforeOperationHook = async ({ req, operation }) => {
  await scopeFor(req)
  if (!['read', 'create', 'update'].includes(operation)) throw new TransactionalEmailError('access-denied')
}

export const guardSuppressionRead: CollectionAfterReadHook = async ({ req, doc }) => {
  const scope = await scopeFor(req)
  if (doc.runtimeEnvironment !== scope.runtimeEnvironment || doc.recipientDigest !== scope.recipientDigest)
    throw new TransactionalEmailError('access-denied')
  return doc
}

export const guardSuppressionWrite: CollectionBeforeChangeHook = async ({ req, data, originalDoc, operation }) => {
  const scope = await scopeFor(req)
  const write = scope.write
  scope.write = undefined
  if (
    !write ||
    Object.entries(write).some(([key, value]) => data[key] !== value) ||
    (operation === 'update' &&
      (originalDoc.runtimeEnvironment !== write.runtimeEnvironment ||
        originalDoc.recipientDigest !== write.recipientDigest ||
        originalDoc.firstObservedAt !== write.firstObservedAt ||
        (originalDoc.reason === 'spam-complaint' && write.reason !== 'spam-complaint')))
  )
    throw new TransactionalEmailError('access-denied')
  return data
}

async function withScope<Result>(
  req: PayloadRequest,
  identity: SuppressionIdentity,
  work: (scoped: PayloadRequest, scope: NonNullable<ReturnType<typeof scopes.get>>) => Promise<Result>,
) {
  const transactionID = await req.transactionID
  if (!isActiveTransaction(req, transactionID) || !/^[A-Za-z0-9_-]{1,128}:[a-f0-9]{64}$/.test(identity.recipientDigest))
    throw new TransactionalEmailError('access-denied')
  const token = Object.freeze({})
  const scope = { ...identity, transactionID }
  scopes.set(token, scope)
  try {
    const scoped = await createLocalReq(
      { context: { transactionalEmailSuppression: token }, req: { transactionID: Promise.resolve(transactionID) } },
      req.payload,
    )
    return await work(scoped, scope)
  } finally {
    scopes.delete(token)
  }
}

/** Called only after verified recipient correlation, inside the provider result's owned transaction. */
export async function applyVerifiedSuppression(
  req: PayloadRequest,
  event: VerifiedLettermintEvent,
  deadline: WebhookDeadline,
) {
  requireVerifiedLettermintEvent(event)
  await requireStorageCapability(req)
  const reason =
    event.envelope.event === 'message.spam_complaint'
      ? 'spam-complaint'
      : event.envelope.event === 'message.hard_bounced'
        ? 'hard-bounce'
        : null
  if (!reason) return
  if (!event.recipientDigest) throw new TransactionalEmailError('access-denied')
  const identity: SuppressionIdentity = {
    runtimeEnvironment: event.environment,
    recipientDigest: event.recipientDigest,
  }
  await withScope(req, identity, async (scoped, scope) => {
    await deadline.beforeOperation(scoped, scope.transactionID)
    const {
      docs: [existing],
    } = await req.payload.find({
      collection: 'transactionalEmailSuppressions',
      req: scoped,
      depth: 0,
      limit: 1,
      where: {
        runtimeEnvironment: { equals: identity.runtimeEnvironment },
        recipientDigest: { equals: identity.recipientDigest },
      },
    })
    const observed = event.envelope.timestamp
    const data: SuppressionWrite = {
      ...identity,
      source: 'lettermint',
      reason: existing?.reason === 'spam-complaint' ? 'spam-complaint' : reason,
      firstObservedAt: existing?.firstObservedAt ?? observed,
      lastObservedAt: existing && existing.lastObservedAt > observed ? existing.lastObservedAt : observed,
    }
    scope.write = data
    await deadline.beforeOperation(scoped, scope.transactionID)
    if (existing)
      await req.payload.update({
        collection: 'transactionalEmailSuppressions',
        req: scoped,
        id: existing.id,
        data,
        depth: 0,
      })
    else await req.payload.create({ collection: 'transactionalEmailSuppressions', req: scoped, data, depth: 0 })
  })
}

export function createSuppressionLookup(req: PayloadRequest, binding: HostedLettermintBinding): SuppressionLookup {
  requireVerifiedHostedBinding(binding)
  return async ({ address, environment }, signal) => {
    if (environment !== binding.target.environment || signal.aborted) return 'unavailable'
    const digest = recipientAddressDigest(address, { version: binding.target.digestKeyId, secret: binding.digestKey })
    if (!digest) return 'unavailable'
    try {
      const hit = await runOwnedTransaction(req, (transactionReq) =>
        withScope(
          transactionReq,
          { runtimeEnvironment: binding.target.environment, recipientDigest: digest },
          async (scoped) => {
            if (signal.aborted) throw new TransactionalEmailError('storage-unavailable')
            const result = await req.payload.find({
              collection: 'transactionalEmailSuppressions',
              req: scoped,
              depth: 0,
              limit: 1,
              where: {
                runtimeEnvironment: { equals: binding.target.environment },
                recipientDigest: { equals: digest },
              },
            })
            return result.docs.length > 0
          },
        ),
      )
      return signal.aborted ? 'unavailable' : hit ? 'suppressed' : 'cleared'
    } catch {
      return 'unavailable'
    }
  }
}

// The store integration owns this decision. Missing or unavailable evidence never grants clearance.
export type SuppressionLookup = (
  recipient: Readonly<{ address: string; environment: EmailEnvironment }>,
  signal: AbortSignal,
) => Promise<'cleared' | 'suppressed' | 'unavailable'>

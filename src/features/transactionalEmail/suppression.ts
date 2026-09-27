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
type ExactSuppressionScope = SuppressionIdentity & {
  kind: 'identity'
  transactionID: string | number
  write?: SuppressionWrite
}
type RetirementSuppressionScope = {
  kind: 'retirement-evidence'
  runtimeEnvironment: 'preview' | 'production'
  version: string
  transactionID: string | number
}
type SuppressionScope = ExactSuppressionScope | RetirementSuppressionScope
const scopes = new WeakMap<object, SuppressionScope>()

async function scopeFor(req: PayloadRequest) {
  const identity: unknown = req.context.transactionalEmailSuppression
  const scope = identity && typeof identity === 'object' ? scopes.get(identity) : undefined
  if (!scope || scope.transactionID !== (await req.transactionID) || !isActiveTransaction(req, scope.transactionID))
    throw new TransactionalEmailError('access-denied')
  return scope
}

export const guardSuppressionOperation: CollectionBeforeOperationHook = async ({ req, operation }) => {
  const scope = await scopeFor(req)
  if (
    (scope.kind === 'retirement-evidence' && !['read', 'count'].includes(operation)) ||
    (scope.kind === 'identity' && !['read', 'create', 'update'].includes(operation))
  )
    throw new TransactionalEmailError('access-denied')
}

export const guardSuppressionRead: CollectionAfterReadHook = async ({ req, doc }) => {
  const scope = await scopeFor(req)
  if (
    doc.runtimeEnvironment !== scope.runtimeEnvironment ||
    (scope.kind === 'identity'
      ? doc.recipientDigest !== scope.recipientDigest
      : !doc.recipientDigest.startsWith(`${scope.version}:`))
  )
    throw new TransactionalEmailError('access-denied')
  return doc
}

export const guardSuppressionWrite: CollectionBeforeChangeHook = async ({ req, data, originalDoc, operation }) => {
  const scope = await scopeFor(req)
  if (scope.kind !== 'identity') throw new TransactionalEmailError('access-denied')
  const write = scope.write
  scope.write = undefined
  if (
    !write ||
    Object.entries(write).some(([key, value]) => data[key] !== value) ||
    (operation === 'update' &&
      (originalDoc.runtimeEnvironment !== write.runtimeEnvironment ||
        originalDoc.recipientDigest !== write.recipientDigest ||
        write.firstObservedAt > originalDoc.firstObservedAt ||
        write.lastObservedAt < originalDoc.lastObservedAt ||
        (originalDoc.reason === 'spam-complaint' && write.reason !== 'spam-complaint')))
  )
    throw new TransactionalEmailError('access-denied')
  return data
}

async function withScope<Result>(
  req: PayloadRequest,
  identity: SuppressionIdentity,
  work: (scoped: PayloadRequest, scope: ExactSuppressionScope) => Promise<Result>,
) {
  const transactionID = await req.transactionID
  if (!isActiveTransaction(req, transactionID) || !/^[A-Za-z0-9_-]{1,128}:[a-f0-9]{64}$/.test(identity.recipientDigest))
    throw new TransactionalEmailError('access-denied')
  const token = Object.freeze({})
  const scope: ExactSuppressionScope = { kind: 'identity', ...identity, transactionID }
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

export async function countSuppressionVersionReferences(
  req: PayloadRequest,
  runtimeEnvironment: 'preview' | 'production',
  version: string,
) {
  const transactionID = await req.transactionID
  if (!isActiveTransaction(req, transactionID) || !/^[A-Za-z0-9_-]{1,128}$/.test(version))
    throw new TransactionalEmailError('access-denied')
  const token = Object.freeze({})
  const scope: RetirementSuppressionScope = {
    kind: 'retirement-evidence',
    runtimeEnvironment,
    version,
    transactionID,
  }
  scopes.set(token, scope)
  try {
    const scoped = await createLocalReq(
      { context: { transactionalEmailSuppression: token }, req: { transactionID: Promise.resolve(transactionID) } },
      req.payload,
    )
    const result = await req.payload.count({
      collection: 'transactionalEmailSuppressions',
      req: scoped,
      where: {
        runtimeEnvironment: { equals: runtimeEnvironment },
        recipientDigest: { like: `${version}:%` },
      },
    })
    return result.totalDocs
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
    const digests = binding.recipientDigestKeys.map((key) => recipientAddressDigest(address, key))
    if (digests.some((digest) => digest === null)) return 'unavailable'
    const [currentDigest, ...previousDigests] = digests as string[]
    try {
      const hit = await runOwnedTransaction(req, (transactionReq) =>
        (async () => {
          const read = (recipientDigest: string) =>
            withScope(
              transactionReq,
              { runtimeEnvironment: binding.target.environment, recipientDigest },
              async (scoped) => {
                if (signal.aborted) throw new TransactionalEmailError('storage-unavailable')
                const result = await req.payload.find({
                  collection: 'transactionalEmailSuppressions',
                  req: scoped,
                  depth: 0,
                  limit: 1,
                  where: {
                    runtimeEnvironment: { equals: binding.target.environment },
                    recipientDigest: { equals: recipientDigest },
                  },
                })
                return result.docs[0]
              },
            )
          const current = await read(currentDigest!)
          const previous = []
          for (const previousDigest of previousDigests) {
            const record = await read(previousDigest)
            if (record) previous.push(record)
          }
          if (previous.length === 0) return current !== undefined
          const retained = [current, ...previous].filter((record) => record !== undefined)
          const data: SuppressionWrite = {
            runtimeEnvironment: binding.target.environment,
            recipientDigest: currentDigest!,
            source: 'lettermint',
            reason: retained.some(({ reason }) => reason === 'spam-complaint') ? 'spam-complaint' : 'hard-bounce',
            firstObservedAt: retained.map(({ firstObservedAt }) => firstObservedAt).sort()[0]!,
            lastObservedAt: retained
              .map(({ lastObservedAt }) => lastObservedAt)
              .sort()
              .at(-1)!,
          }
          await withScope(
            transactionReq,
            { runtimeEnvironment: binding.target.environment, recipientDigest: currentDigest! },
            async (scoped, scope) => {
              if (signal.aborted) throw new TransactionalEmailError('storage-unavailable')
              scope.write = data
              if (current)
                await req.payload.update({
                  collection: 'transactionalEmailSuppressions',
                  req: scoped,
                  id: current.id,
                  data,
                  depth: 0,
                })
              else
                await req.payload.create({
                  collection: 'transactionalEmailSuppressions',
                  req: scoped,
                  data,
                  depth: 0,
                })
            },
          )
          return true
        })(),
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

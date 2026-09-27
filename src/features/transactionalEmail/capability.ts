import { createLocalReq, type CollectionBeforeOperationHook, type PayloadRequest } from 'payload'
import { TransactionalEmailError } from './errors'
import { isActiveTransaction } from './transactions'

export type WorkerAuthority = {
  kind: 'claim' | 'worker' | 'sweep' | 'provider'
  now: () => number
  token: string
}
type StorageCapability = {
  kind: 'storage'
  transactionID: number | string
  worker?: WorkerAuthority
  eventAppends?: Set<string>
  retentionDeletes?: Set<string>
}
type RetirementEvidenceCapability = {
  kind: 'outbox-retirement-evidence'
  transactionID: number | string
}
const capabilities = new WeakMap<object, StorageCapability | RetirementEvidenceCapability>()

export function openStorageCapability(transactionID: number | string, worker?: WorkerAuthority) {
  const identity = Object.freeze({})
  capabilities.set(identity, { kind: 'storage', transactionID, worker })
  return {
    context: { transactionalEmail: identity },
    close: () => capabilities.delete(identity),
  }
}

async function capabilityState(req: PayloadRequest) {
  const identity: unknown = req.context?.transactionalEmail
  const transactionID = await req.transactionID
  const state = identity && typeof identity === 'object' ? capabilities.get(identity) : undefined
  if (
    !state ||
    typeof req.transactionID === 'undefined' ||
    state.transactionID !== transactionID ||
    !isActiveTransaction(req, transactionID)
  )
    throw new TransactionalEmailError('access-denied')
  return state
}

export async function requireStorageCapability(req: PayloadRequest): Promise<void> {
  if ((await capabilityState(req)).kind !== 'storage') throw new TransactionalEmailError('access-denied')
}

export const guardStorageOperation: CollectionBeforeOperationHook = async ({ collection, operation, req }) => {
  const state = await capabilityState(req)
  if (state.kind === 'storage') return
  if (collection.slug !== 'transactionalEmailOutbox' || operation !== 'count')
    throw new TransactionalEmailError('access-denied')
}

export function storageWorkerAuthority(req: PayloadRequest) {
  const identity: unknown = req.context?.transactionalEmail
  if (!identity || typeof identity !== 'object') return undefined
  const state = capabilities.get(identity)
  return state?.kind === 'storage' ? state.worker : undefined
}

// Issued only after the worker or provider storage seam completes its guarded outbox update.
export function authorizeEventAppends(req: PayloadRequest, outbox: number, sequences: number[]) {
  const state = capabilities.get(req.context.transactionalEmail as object)
  if (state?.kind !== 'storage' || !state.worker) throw new TransactionalEmailError('access-denied')
  state.eventAppends = new Set(sequences.map((sequence) => `${outbox}:${sequence}`))
}

export function consumeEventAppend(req: PayloadRequest, outbox: number, sequence: number) {
  const state = capabilities.get(req.context.transactionalEmail as object)
  if (state?.kind !== 'storage' || !state.worker || !state.eventAppends?.delete(`${outbox}:${sequence}`))
    throw new TransactionalEmailError('access-denied')
}

// The retention transaction grants each deletion only after checking the persisted expiry.
export function authorizeRetentionDeletes(req: PayloadRequest, outbox: number, eventIds: number[]) {
  const state = capabilities.get(req.context.transactionalEmail as object)
  if (state?.kind !== 'storage' || state.worker?.kind !== 'sweep') throw new TransactionalEmailError('access-denied')
  state.retentionDeletes = new Set([
    `transactionalEmailOutbox:${outbox}`,
    ...eventIds.map((id) => `transactionalEmailEvents:${id}`),
  ])
}

export function consumeRetentionDelete(req: PayloadRequest, collection: string, id: number | string) {
  const state = capabilities.get(req.context.transactionalEmail as object)
  if (
    state?.kind !== 'storage' ||
    state.worker?.kind !== 'sweep' ||
    !state.retentionDeletes?.delete(`${collection}:${id}`)
  )
    throw new TransactionalEmailError('access-denied')
}

export async function countOutboxDigestVersionReferences(
  req: PayloadRequest,
  runtimeEnvironment: 'preview' | 'production',
  version: string,
) {
  const transactionID = await req.transactionID
  if (!isActiveTransaction(req, transactionID) || !/^[A-Za-z0-9_-]{1,128}$/.test(version))
    throw new TransactionalEmailError('access-denied')
  const identity = Object.freeze({})
  capabilities.set(identity, { kind: 'outbox-retirement-evidence', transactionID })
  try {
    const scoped = await createLocalReq(
      { context: { transactionalEmail: identity }, req: { transactionID: Promise.resolve(transactionID) } },
      req.payload,
    )
    const result = await req.payload.count({
      collection: 'transactionalEmailOutbox',
      req: scoped,
      where: {
        and: [
          { runtimeEnvironment: { equals: runtimeEnvironment } },
          {
            or: [{ recipientDigest: { like: `${version}:%` } }, { providerRecipientDigest: { like: `${version}:%` } }],
          },
        ],
      },
    })
    return result.totalDocs
  } finally {
    capabilities.delete(identity)
  }
}

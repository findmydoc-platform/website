import { createLocalReq, type CollectionBeforeOperationHook, type PayloadRequest } from 'payload'
import { TransactionalEmailError } from './errors'
import { isActiveTransaction } from './transactions'

export type WorkerAuthority = {
  readonly kind: 'claim' | 'worker' | 'sweep' | 'provider'
  readonly now: () => number
  readonly token: string
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
type CapabilityState = StorageCapability | RetirementEvidenceCapability
type CapabilitySnapshot = Readonly<{
  kind: CapabilityState['kind']
  transactionID: number | string
  worker?: WorkerAuthority
}>
type CapabilityBroker = Readonly<{
  version: 1
  openStorage(transactionID: number | string, worker?: WorkerAuthority): object
  openRetirementEvidence(transactionID: number | string): object
  close(identity: object): void
  inspect(identity: object): CapabilitySnapshot | undefined
  authorizeEventAppends(identity: object, outbox: number, sequences: number[]): boolean
  consumeEventAppend(identity: object, outbox: number, sequence: number): boolean
  authorizeRetentionDeletes(identity: object, outbox: number, eventIds: number[]): boolean
  consumeRetentionDelete(identity: object, collection: string, id: number | string): boolean
}>
const capabilityBrokerKey = Symbol.for('findmydoc.transactional-email.capability-broker.v1')

function createCapabilityBroker(): CapabilityBroker {
  const states = new WeakMap<object, CapabilityState>()
  return Object.freeze({
    version: 1 as const,
    openStorage(transactionID: number | string, worker?: WorkerAuthority) {
      const identity = Object.freeze({})
      const authority = worker ? Object.freeze({ kind: worker.kind, now: worker.now, token: worker.token }) : undefined
      states.set(identity, { kind: 'storage', transactionID, worker: authority })
      return identity
    },
    openRetirementEvidence(transactionID: number | string) {
      const identity = Object.freeze({})
      states.set(identity, { kind: 'outbox-retirement-evidence', transactionID })
      return identity
    },
    close(identity: object) {
      states.delete(identity)
    },
    inspect(identity: object) {
      const state = states.get(identity)
      if (!state) return undefined
      return Object.freeze({
        kind: state.kind,
        transactionID: state.transactionID,
        ...(state.kind === 'storage' && state.worker ? { worker: state.worker } : {}),
      })
    },
    authorizeEventAppends(identity: object, outbox: number, sequences: number[]) {
      const state = states.get(identity)
      if (state?.kind !== 'storage' || !state.worker) return false
      state.eventAppends = new Set(sequences.map((sequence) => `${outbox}:${sequence}`))
      return true
    },
    consumeEventAppend(identity: object, outbox: number, sequence: number) {
      const state = states.get(identity)
      return Boolean(state?.kind === 'storage' && state.worker && state.eventAppends?.delete(`${outbox}:${sequence}`))
    },
    authorizeRetentionDeletes(identity: object, outbox: number, eventIds: number[]) {
      const state = states.get(identity)
      if (state?.kind !== 'storage' || state.worker?.kind !== 'sweep') return false
      state.retentionDeletes = new Set([
        `transactionalEmailOutbox:${outbox}`,
        ...eventIds.map((id) => `transactionalEmailEvents:${id}`),
      ])
      return true
    },
    consumeRetentionDelete(identity: object, collection: string, id: number | string) {
      const state = states.get(identity)
      return Boolean(
        state?.kind === 'storage' &&
        state.worker?.kind === 'sweep' &&
        state.retentionDeletes?.delete(`${collection}:${id}`),
      )
    },
  })
}

function isCapabilityBroker(value: unknown): value is CapabilityBroker {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.isFrozen(value) &&
    Reflect.get(value, 'version') === 1 &&
    [
      'openStorage',
      'openRetirementEvidence',
      'close',
      'inspect',
      'authorizeEventAppends',
      'consumeEventAppend',
      'authorizeRetentionDeletes',
      'consumeRetentionDelete',
    ].every((method) => typeof Reflect.get(value, method) === 'function')
  )
}

function resolveCapabilityBroker(): CapabilityBroker {
  const existing = Reflect.get(globalThis, capabilityBrokerKey)
  if (isCapabilityBroker(existing)) return existing
  if (existing !== undefined) throw new TransactionalEmailError('access-denied')
  const broker = createCapabilityBroker()
  Object.defineProperty(globalThis, capabilityBrokerKey, {
    configurable: false,
    enumerable: false,
    value: broker,
    writable: false,
  })
  return broker
}

// Next.js can evaluate route code and Payload collection hooks as separate server module instances.
// The immutable process-wide broker shares opaque identities while keeping its mutable state closure-private.
const capabilityBroker = resolveCapabilityBroker()

function capabilityIdentity(req: PayloadRequest): object | undefined {
  const identity: unknown = req.context?.transactionalEmail
  return identity && typeof identity === 'object' ? identity : undefined
}

export function openStorageCapability(transactionID: number | string, worker?: WorkerAuthority) {
  const identity = capabilityBroker.openStorage(transactionID, worker)
  return {
    context: { transactionalEmail: identity },
    close: () => capabilityBroker.close(identity),
  }
}

async function capabilityState(req: PayloadRequest) {
  const identity = capabilityIdentity(req)
  const transactionID = await req.transactionID
  const state = identity ? capabilityBroker.inspect(identity) : undefined
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
  const identity = capabilityIdentity(req)
  if (!identity) return undefined
  const state = capabilityBroker.inspect(identity)
  return state?.kind === 'storage' ? state.worker : undefined
}

// Issued only after the worker or provider storage seam completes its guarded outbox update.
export function authorizeEventAppends(req: PayloadRequest, outbox: number, sequences: number[]) {
  const identity = capabilityIdentity(req)
  if (!identity || !capabilityBroker.authorizeEventAppends(identity, outbox, sequences))
    throw new TransactionalEmailError('access-denied')
}

export function consumeEventAppend(req: PayloadRequest, outbox: number, sequence: number) {
  const identity = capabilityIdentity(req)
  if (!identity || !capabilityBroker.consumeEventAppend(identity, outbox, sequence))
    throw new TransactionalEmailError('access-denied')
}

// The retention transaction grants each deletion only after checking the persisted expiry.
export function authorizeRetentionDeletes(req: PayloadRequest, outbox: number, eventIds: number[]) {
  const identity = capabilityIdentity(req)
  if (!identity || !capabilityBroker.authorizeRetentionDeletes(identity, outbox, eventIds))
    throw new TransactionalEmailError('access-denied')
}

export function consumeRetentionDelete(req: PayloadRequest, collection: string, id: number | string) {
  const identity = capabilityIdentity(req)
  if (!identity || !capabilityBroker.consumeRetentionDelete(identity, collection, id))
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
  const identity = capabilityBroker.openRetirementEvidence(transactionID)
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
    capabilityBroker.close(identity)
  }
}

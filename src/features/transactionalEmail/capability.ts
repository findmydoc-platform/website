import { createLocalReq, type CollectionBeforeOperationHook, type PayloadRequest } from 'payload'
import { TransactionalEmailError } from './errors'
import { isActiveTransaction } from './transactions'
import { commandOperationReference, validateCommand, type TransactionalEmailCommand } from './commands'
import type { SuppressedRecipientBinding } from './catalog'

type SuppressedAcceptance = Readonly<{
  command: Extract<
    TransactionalEmailCommand,
    { type: 'moderation.report-received' | 'conversation.external-message-received' }
  >
  recipientDigest: string
  acceptedAt: string
  outcomeCode: SuppressedRecipientBinding['outcomeCode']
}>

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
  suppressedAcceptance?: SuppressedAcceptance
  initialCreateConsumed?: boolean
  initialEvents?: Map<string, { type: string; outcomeCode?: string }>
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
  suppressedAcceptance?: SuppressedAcceptance
}>
type CapabilityBroker = Readonly<{
  version: 1
  openStorage(
    transactionID: number | string,
    worker?: WorkerAuthority,
    suppressedAcceptance?: SuppressedAcceptance,
  ): object
  consumeSuppressedCreate(identity: object): boolean
  authorizeSuppressedEvents(identity: object, outbox: number): boolean
  consumeSuppressedEvent(
    identity: object,
    outbox: number,
    sequence: number,
    type: string,
    outcomeCode?: string | null,
  ): boolean
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
    openStorage(transactionID: number | string, worker?: WorkerAuthority, suppressedAcceptance?: SuppressedAcceptance) {
      const identity = Object.freeze({})
      const authority = worker ? Object.freeze({ kind: worker.kind, now: worker.now, token: worker.token }) : undefined
      states.set(identity, { kind: 'storage', transactionID, worker: authority, suppressedAcceptance })
      return identity
    },
    consumeSuppressedCreate(identity: object) {
      const state = states.get(identity)
      if (state?.kind !== 'storage' || !state.suppressedAcceptance || state.initialCreateConsumed) return false
      state.initialCreateConsumed = true
      return true
    },
    authorizeSuppressedEvents(identity: object, outbox: number) {
      const state = states.get(identity)
      if (
        state?.kind !== 'storage' ||
        !state.suppressedAcceptance ||
        !state.initialCreateConsumed ||
        state.initialEvents
      )
        return false
      state.initialEvents = new Map([
        [`${outbox}:1`, { type: 'command.accepted' }],
        [`${outbox}:2`, { type: 'delivery.suppressed', outcomeCode: state.suppressedAcceptance.outcomeCode }],
        [`${outbox}:3`, { type: 'payload.scrubbed' }],
      ])
      return true
    },
    consumeSuppressedEvent(
      identity: object,
      outbox: number,
      sequence: number,
      type: string,
      outcomeCode?: string | null,
    ) {
      const state = states.get(identity)
      if (state?.kind !== 'storage' || !state.suppressedAcceptance) return false
      const key = `${outbox}:${sequence}`
      const expected = state.initialEvents?.get(key)
      if (
        !expected ||
        state.initialEvents?.keys().next().value !== key ||
        expected.type !== type ||
        (expected.outcomeCode ?? null) !== (outcomeCode ?? null)
      )
        return false
      return Boolean(state.initialEvents?.delete(key))
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
        ...(state.kind === 'storage' && state.suppressedAcceptance
          ? { suppressedAcceptance: state.suppressedAcceptance }
          : {}),
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
      'consumeSuppressedCreate',
      'authorizeSuppressedEvents',
      'consumeSuppressedEvent',
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

/** Only command acceptance can create an already-scrubbed, non-deliverable participant operation. */
export function openSuppressedAcceptanceCapability(transactionID: number | string, input: SuppressedAcceptance) {
  const command = validateCommand(input.command)
  if (
    (command.type !== 'moderation.report-received' && command.type !== 'conversation.external-message-received') ||
    !['ineligible', 'source-unavailable', 'recipient-changed', 'superseded'].includes(input.outcomeCode) ||
    !/^[A-Za-z0-9_-]{1,128}:[a-f0-9]{64}$/.test(input.recipientDigest) ||
    !Number.isFinite(Date.parse(input.acceptedAt))
  )
    throw new TransactionalEmailError('access-denied')
  const expected = Object.freeze({ ...input, command: Object.freeze(command) })
  const identity = capabilityBroker.openStorage(transactionID, undefined, expected)
  return { context: { transactionalEmail: identity }, close: () => capabilityBroker.close(identity) }
}

export function storageSuppressedAcceptance(req: PayloadRequest) {
  const identity = capabilityIdentity(req)
  return identity ? capabilityBroker.inspect(identity)?.suppressedAcceptance : undefined
}

export function consumeSuppressedAcceptanceCreate(req: PayloadRequest, record: Record<string, unknown>) {
  const identity = capabilityIdentity(req)
  const expected = storageSuppressedAcceptance(req)
  if (
    !identity ||
    !expected ||
    record.commandType !== expected.command.type ||
    record.operationReference !== commandOperationReference(expected.command) ||
    record.recipientDigest !== expected.recipientDigest ||
    record.createdAt !== expected.acceptedAt ||
    record.terminalAt !== expected.acceptedAt ||
    record.scrubbedAt !== expected.acceptedAt ||
    record.deliveryDeadline !== new Date(Date.parse(expected.acceptedAt) + 86_400_000).toISOString() ||
    ['preparedAt', 'lastAttemptAt', 'firstAmbiguousAt', 'providerMessageId', 'providerAcceptedAt'].some(
      (field) => record[field] != null,
    ) ||
    record.state !== 'suppressed' ||
    record.latestEventSequence !== 3 ||
    record.attemptCount !== 0 ||
    !capabilityBroker.consumeSuppressedCreate(identity)
  )
    throw new TransactionalEmailError('access-denied')
}

export function authorizeSuppressedAcceptanceEvents(req: PayloadRequest, outbox: number) {
  const identity = capabilityIdentity(req)
  if (!identity || !capabilityBroker.authorizeSuppressedEvents(identity, outbox))
    throw new TransactionalEmailError('access-denied')
}

export function consumeSuppressedAcceptanceEvent(req: PayloadRequest, event: Record<string, unknown>) {
  const identity = capabilityIdentity(req)
  if (
    !identity ||
    event.source !== 'command' ||
    ['providerEventId', 'providerEventType', 'providerMessageId', 'sourceOccurredAt', 'attemptNumber'].some(
      (field) => event[field] != null,
    ) ||
    !capabilityBroker.consumeSuppressedEvent(
      identity,
      Number(event.outbox),
      Number(event.sequence),
      String(event.type),
      event.outcomeCode as string | null | undefined,
    )
  )
    throw new TransactionalEmailError('access-denied')
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

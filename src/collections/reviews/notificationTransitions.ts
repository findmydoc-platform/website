import { randomUUID } from 'node:crypto'
import { normalizeNativeFinalWriteOperation } from '@/access/nativeFinalOperation'
import {
  createLocalReq,
  type CollectionAfterChangeHook,
  type CollectionAfterOperationHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionBeforeOperationHook,
  type PayloadRequest,
  type Where,
} from 'payload'
import { requireNotificationTransaction } from '@/collections/clinicNotifications/common'
import {
  captureClinicNotificationOccurrence,
  prepareClinicNotificationCapture,
} from '@/features/clinicNotifications/capture'
import { getReviewWithdrawalState, isReviewPubliclyVisible } from './publicProjection'
import {
  lockNotificationAuthorization,
  notificationClinicAuthorizationKey,
} from '@/features/clinicNotifications/authorizationBarrier'
import { recordNotificationDiagnostic } from '@/features/clinicNotifications/diagnostics'

type RecordData = Record<string, unknown>
type Event = 'review_published' | 'review_withdrawn' | 'review_removed'
type Transition = { id: string; eventType: Event; occurredAt: string }
type Prepared = {
  transactionID: string | number
  transitions: Map<string, Transition[]>
  lockedClinicScopes: Set<string>
  startedAt: number
}
const owned = new WeakMap<PayloadRequest, Prepared>()
const isSeedReset = (req: PayloadRequest): boolean => req.context?.seedReset === true && req.context?.skipHooks === true
const record = (value: unknown): RecordData => (value && typeof value === 'object' ? (value as RecordData) : {})
const relationId = (value: unknown): string | null =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : value && typeof value === 'object' && 'id' in value
      ? relationId(value.id)
      : null

async function active(req: PayloadRequest): Promise<Prepared> {
  const state = owned.get(req)
  if (!state || (await req.transactionID) !== state.transactionID)
    throw new Error('Review notification source transaction changed before completion.')
  requireNotificationTransaction(req, state.transactionID)
  return state
}

export const prepareReviewNotificationOperation: CollectionBeforeOperationHook = async ({ req, operation, args }) => {
  if (!['create', 'update', 'delete'].includes(operation)) return args
  if (isSeedReset(req)) return args
  const transactionID = await req.transactionID
  requireNotificationTransaction(req, transactionID)
  const previous = owned.get(req)
  if (previous?.transactionID !== transactionID) {
    await prepareClinicNotificationCapture(req)
    owned.set(req, {
      transactionID,
      transitions: new Map(),
      lockedClinicScopes: new Set(),
      startedAt: performance.now(),
    })
  }
  const state = await active(req)
  const input = args as { id?: string | number; where?: Where; data?: unknown }
  const scopes = new Set<string>()
  const target = relationId(record(input.data).clinic)
  if (target) scopes.add(target)
  if (operation !== 'create' && (input.id !== undefined || input.where)) {
    for (let page = 1; ; page++) {
      const sources = await req.payload.find({
        collection: 'reviews',
        overrideAccess: true,
        req,
        depth: 0,
        trash: true,
        limit: 100,
        page,
        where: input.id !== undefined ? { id: { equals: input.id } } : input.where,
      })
      for (const source of sources.docs) {
        const scope = relationId(source.clinic)
        if (scope) scopes.add(scope)
      }
      if (!sources.hasNextPage) break
    }
  }
  const unlocked = [...scopes].filter((scope) => !state.lockedClinicScopes.has(scope))
  await lockNotificationAuthorization(req, unlocked.map(notificationClinicAuthorizationKey))
  unlocked.forEach((scope) => state.lockedClinicScopes.add(scope))
  return args
}

async function wasPublished(req: PayloadRequest, original: RecordData): Promise<boolean> {
  if (typeof original.notificationPublicationEvidenceAt === 'string' || isReviewPubliclyVisible(original)) return true
  const id = relationId(original.id)
  if (!id) return false
  for (let page = 1; ; page++) {
    const history = await req.payload.findVersions({
      collection: 'reviews',
      where: { parent: { equals: id } },
      depth: 0,
      overrideAccess: true,
      req,
      limit: 100,
      page,
    })
    if (history.docs.some((entry) => isReviewPubliclyVisible(record(entry.version)))) return true
    if (!history.hasNextPage) return false
  }
}

export const prepareReviewNotificationTransitions: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
  operation,
}) => {
  if (isSeedReset(req)) return data
  const state = await active(req)
  const original = record(originalDoc)
  const next = { ...original, ...data }
  const priorPublication = operation === 'update' && (await wasPublished(req, original))
  const now = new Date().toISOString()
  data.notificationPublicationEvidenceAt = original.notificationPublicationEvidenceAt ?? null
  data.notificationTransition = original.notificationTransition ?? null
  const events: Event[] = []
  if (isReviewPubliclyVisible(next) && !priorPublication) events.push('review_published')
  if (
    priorPublication &&
    getReviewWithdrawalState(original) !== 'withdrawn' &&
    getReviewWithdrawalState(next) === 'withdrawn'
  )
    events.push('review_withdrawn')
  if (
    priorPublication &&
    ((original.publicMeasure !== 'removed' && next.publicMeasure === 'removed') ||
      (original.status === 'approved' && next.status === 'rejected') ||
      (!original.deletedAt && Boolean(next.deletedAt)))
  )
    events.push('review_removed')
  if (priorPublication || events.includes('review_published'))
    data.notificationPublicationEvidenceAt = original.notificationPublicationEvidenceAt ?? now
  if (req.context.trustedReviewWorkflowSeed === true) events.length = 0
  const transitions = events.map((eventType) => ({ id: randomUUID(), eventType, occurredAt: now }))
  if (transitions.length) data.notificationTransition = transitions
  state.transitions.set(operation === 'create' ? 'create' : String(original.id), transitions)
  return data
}

async function persist(
  req: PayloadRequest,
  reviewId: string,
  clinicId: string,
  transitions: Transition[],
): Promise<void> {
  const state = await active(req)
  const transactionReq = await createLocalReq(
    {
      user: req.user ?? undefined,
      context: { ...req.context, reviewPublicationTransitionWrite: true },
      req: { transactionID: Promise.resolve(state.transactionID) },
    },
    req.payload,
  )
  try {
    for (const transition of transitions) {
      await req.payload.create({
        collection: 'reviewPublicationTransitions' as never,
        overrideAccess: true,
        req: transactionReq,
        depth: 0,
        data: {
          transitionId: transition.id,
          reviewId,
          clinicScopeId: clinicId,
          eventType: transition.eventType,
          occurredAt: transition.occurredAt,
        },
      } as never)
      const numericClinicId = Number(clinicId)
      await captureClinicNotificationOccurrence(req, {
        clinicId:
          Number.isSafeInteger(numericClinicId) && String(numericClinicId) === clinicId ? numericClinicId : clinicId,
        occurredAt: transition.occurredAt,
        member: {
          schemaVersion: 1,
          eventType: transition.eventType,
          sourceRecord: { kind: 'review', id: reviewId },
          sourceOccurrence: { kind: 'review_transition', id: transition.id },
        },
      })
    }
  } catch (error) {
    await recordNotificationDiagnostic(req, {
      operation: 'source_capture',
      result: 'failure',
      errorCode: 'SERVICE_UNAVAILABLE',
      elapsedMs: Math.round(performance.now() - state.startedAt),
      transactionOutcome: 'unknown',
    })
    throw error
  }
}

export const captureReviewNotificationTransitions: CollectionAfterChangeHook = async ({
  req,
  doc,
  previousDoc,
  operation,
}) => {
  if (isSeedReset(req)) return doc
  const state = await active(req)
  const transitions = state.transitions.get(operation === 'create' ? 'create' : String(previousDoc.id)) ?? []
  if (!transitions.length) return doc
  // Read persisted source in the same transaction; the afterChange document may be field-filtered.
  const source = await req.payload.findByID({
    collection: 'reviews',
    id: doc.id,
    depth: 0,
    overrideAccess: true,
    req,
    trash: true,
  })
  const clinicId = relationId(source.clinic)
  if (!clinicId) throw new Error('Review publication source requires a clinic scope.')
  await persist(req, String(source.id), clinicId, transitions)
  state.transitions.delete(operation === 'create' ? 'create' : String(previousDoc.id))
  return doc
}

export const captureReviewNotificationDeletion: CollectionBeforeDeleteHook = async ({ req, id }) => {
  if (isSeedReset(req)) return
  await active(req)
  const source = await req.payload.findByID({
    collection: 'reviews',
    id,
    depth: 0,
    overrideAccess: true,
    req,
    trash: true,
  })
  if (source.status !== 'approved' || source.deletedAt) return
  if (!(await wasPublished(req, record(source)))) return
  const clinicId = relationId(source.clinic)
  if (!clinicId) throw new Error('Review removal source requires a clinic scope.')
  await persist(req, String(id), clinicId, [
    { id: randomUUID(), eventType: 'review_removed', occurredAt: new Date().toISOString() },
  ])
}

export const finalizeReviewNotificationOperation: CollectionAfterOperationHook = async ({ req, operation, result }) => {
  const finalOperation = normalizeNativeFinalWriteOperation(operation)
  if (finalOperation && finalOperation !== 'restoreVersion' && !isSeedReset(req)) {
    try {
      await active(req)
    } catch (error) {
      await recordNotificationDiagnostic(req, {
        operation: 'source_capture',
        result: 'failure',
        errorCode: 'SERVICE_UNAVAILABLE',
        elapsedMs: Math.round(performance.now() - (owned.get(req)?.startedAt ?? performance.now())),
        transactionOutcome: 'unknown',
      })
      throw error
    }
  }
  return result
}

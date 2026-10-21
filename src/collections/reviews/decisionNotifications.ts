import { randomUUID } from 'node:crypto'
import { lockClinicReviewWorkflowAuthorization, finalizeClinicReviewWorkflowAuthorization } from './clinicAuthorization'
import {
  createLocalReq,
  type CollectionAfterChangeHook,
  type CollectionAfterOperationHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeOperationHook,
  type PayloadRequest,
  type Where,
} from 'payload'
import { requireNotificationTransaction } from '@/collections/clinicNotifications/common'
import {
  captureClinicNotificationOccurrence,
  prepareClinicNotificationCapture,
} from '@/features/clinicNotifications/capture'
import { recordNotificationDiagnostic } from '@/features/clinicNotifications/diagnostics'

type WorkflowKind = 'response' | 'appeal'
type WorkflowCollection = 'reviewResponses' | 'reviewAppeals'
type ResponseOutcome = 'approved' | 'rejected' | 'blocked'
type AppealOutcome = 'upheld' | 'rejected'
type Decision =
  | { eventType: 'clinic_response_decided'; id: string; occurredAt: string; outcome: ResponseOutcome }
  | { eventType: 'review_appeal_decided'; id: string; occurredAt: string; outcome: AppealOutcome }
type Prepared = {
  transactionID: string | number
  transitions: Map<string, Decision>
  lockedClinicScopes: Set<string>
  startedAt: number
}
type RecordData = Record<string, unknown>
const owned = new WeakMap<PayloadRequest, Prepared>()
const record = (value: unknown): RecordData =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordData) : {}
const relationId = (value: unknown): string | null =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : value && typeof value === 'object' && 'id' in value
      ? relationId(value.id)
      : null
const hasBody = (value: unknown): boolean =>
  typeof record(value).body === 'string' && String(record(value).body).trim().length > 0
const sourceKey = (kind: WorkflowKind, id: unknown): string => `${kind}:${String(id)}`

async function active(req: PayloadRequest): Promise<Prepared> {
  const state = owned.get(req)
  if (!state || (await req.transactionID) !== state.transactionID)
    throw new Error('Review decision source transaction changed before completion.')
  requireNotificationTransaction(req, state.transactionID)
  return state
}

const prepareOperation =
  (kind: WorkflowKind, collection: WorkflowCollection): CollectionBeforeOperationHook =>
  async ({ req, operation, args }) => {
    if (!['create', 'update'].includes(operation)) return args
    const transactionID = await req.transactionID
    requireNotificationTransaction(req, transactionID)
    const prior = owned.get(req)
    if (prior?.transactionID !== transactionID) {
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
    if (operation === 'create') {
      const reviewId = relationId(record(input.data).review)
      if (reviewId) {
        const review = await req.payload.findByID({
          collection: 'reviews',
          id: reviewId,
          overrideAccess: true,
          req,
          depth: 0,
          select: { clinic: true },
        })
        const scope = relationId(review.clinic)
        if (scope) scopes.add(scope)
      }
    } else if (input.id !== undefined || input.where) {
      for (let page = 1; ; page++) {
        const sources = await req.payload.find({
          collection,
          overrideAccess: true,
          req,
          depth: 0,
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
    await lockClinicReviewWorkflowAuthorization(req, unlocked)
    unlocked.forEach((scope) => state.lockedClinicScopes.add(scope))
    return args
  }

export const prepareReviewResponseNotificationOperation = prepareOperation('response', 'reviewResponses')
export const prepareReviewAppealNotificationOperation = prepareOperation('appeal', 'reviewAppeals')

const prepareTransition =
  (kind: WorkflowKind): CollectionBeforeChangeHook =>
  async ({ data, operation, originalDoc, req }) => {
    const state = await active(req)
    if (operation !== 'update' || req.context.trustedReviewWorkflowSeed === true) return data
    const original = record(originalDoc)
    const next = record(data)
    let decision: Decision | undefined
    if (kind === 'response') {
      const priorStatus = original.moderationStatus
      const status = next.moderationStatus
      const pending = hasBody(original.pendingResponse)
      const published = hasBody(original.publishedResponse)
      if (status !== priorStatus && (pending || (status === 'blocked' && published))) {
        const outcome = status === 'approved' || status === 'rejected' || status === 'blocked' ? status : null
        if (outcome) {
          decision = {
            id: randomUUID(),
            eventType: 'clinic_response_decided',
            outcome,
            occurredAt: String(next.lastActionAt),
          }
        }
      }
    } else if (
      original.status === 'under_review' &&
      next.status !== original.status &&
      (next.status === 'upheld' || next.status === 'dismissed')
    ) {
      decision = {
        id: randomUUID(),
        eventType: 'review_appeal_decided',
        outcome: next.status === 'dismissed' ? 'rejected' : 'upheld',
        occurredAt: String(next.lastActionAt),
      }
    }
    const key = sourceKey(kind, original.id)
    if (decision) state.transitions.set(key, decision)
    else state.transitions.delete(key)
    return data
  }

export const prepareReviewResponseNotification = prepareTransition('response')
export const prepareReviewAppealNotification = prepareTransition('appeal')

const captureTransition =
  (kind: WorkflowKind, collection: WorkflowCollection): CollectionAfterChangeHook =>
  async ({ req, doc, previousDoc, operation }) => {
    const state = await active(req)
    if (operation !== 'update') return doc
    const key = sourceKey(kind, previousDoc.id)
    const transition = state.transitions.get(key)
    if (!transition) return doc
    const source = await req.payload.findByID({
      collection,
      id: doc.id,
      overrideAccess: true,
      req,
      depth: 0,
    })
    const reviewId = relationId(source.review)
    const clinicId = relationId(source.clinic)
    if (!reviewId || !clinicId) throw new Error('Review decision source requires a review and clinic scope.')
    const transitionReq = await createLocalReq(
      {
        user: req.user ?? undefined,
        context: { ...req.context, reviewDecisionTransitionWrite: true },
        req: { transactionID: Promise.resolve(state.transactionID) },
      },
      req.payload,
    )
    try {
      await req.payload.create({
        collection: 'reviewDecisionTransitions' as never,
        overrideAccess: true,
        req: transitionReq,
        depth: 0,
        data: {
          transitionId: transition.id,
          reviewId,
          clinicScopeId: clinicId,
          workflowKind: kind,
          workflowId: String(source.id),
          eventType: transition.eventType,
          outcome: transition.outcome,
          occurredAt: transition.occurredAt,
        },
      } as never)
      const numericClinicId = Number(clinicId)
      const scopedClinicId =
        Number.isSafeInteger(numericClinicId) && String(numericClinicId) === clinicId ? numericClinicId : clinicId
      await captureClinicNotificationOccurrence(req, {
        clinicId: scopedClinicId,
        occurredAt: transition.occurredAt,
        member:
          transition.eventType === 'clinic_response_decided'
            ? {
                schemaVersion: 1,
                eventType: 'clinic_response_decided',
                sourceRecord: { kind: 'review', id: reviewId },
                sourceOccurrence: { kind: 'response_decision', id: transition.id },
                outcome: transition.outcome,
              }
            : {
                schemaVersion: 1,
                eventType: 'review_appeal_decided',
                sourceRecord: { kind: 'review', id: reviewId },
                sourceOccurrence: { kind: 'review_appeal_decision', id: transition.id },
                outcome: transition.outcome,
              },
      })
      state.transitions.delete(key)
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
    return doc
  }

export const captureReviewResponseNotification = captureTransition('response', 'reviewResponses')
export const captureReviewAppealNotification = captureTransition('appeal', 'reviewAppeals')

export const finalizeReviewDecisionNotificationOperation: CollectionAfterOperationHook = async ({
  req,
  operation,
  result,
}) => {
  if (['create', 'update', 'updateByID'].includes(operation)) {
    try {
      await active(req)
      await finalizeClinicReviewWorkflowAuthorization(req, result)
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

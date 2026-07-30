import type {
  CollectionAfterChangeHook,
  CollectionAfterReadHook,
  CollectionBeforeChangeHook,
  CollectionBeforeOperationHook,
  PayloadRequest,
} from 'payload'
import { APIError, ValidationError } from 'payload'

import { isClinicStaff } from '@/access/isClinicStaff'
import { isPlatformStaff } from '@/access/isPlatformStaff'
import { getUserAssignedClinicId } from '@/access/utils/getClinicAssignment'

type RelationId = string | number
type WorkflowDraft = Record<string, unknown>

type ReviewContext = {
  clinicId: RelationId
  reviewId: RelationId
  status: string
}

type ResponseGroup = {
  body?: unknown
  approvedAt?: unknown
  submittedAt?: unknown
  isBlocked?: unknown
}

const MIN_TEXT_LENGTH = 10
const MAX_TEXT_LENGTH = 2000

const responseStatuses = ['pending', 'approved', 'rejected', 'blocked'] as const
const appealStatuses = ['submitted', 'under_review', 'upheld', 'dismissed'] as const

const emptyResponseGroup = (kind: 'published' | 'pending'): ResponseGroup =>
  kind === 'published' ? { body: null, approvedAt: null, isBlocked: false } : { body: null, submittedAt: null }

const relationId = (value: unknown): RelationId | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) return value
  if (value && typeof value === 'object') {
    const relation = value as { id?: unknown; value?: unknown }
    return relationId(relation.id ?? relation.value)
  }

  return null
}

const record = (value: unknown): WorkflowDraft =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as WorkflowDraft) : {}

const optionalTrimmedText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

const requiredWorkflowText = ({
  collection,
  label,
  path,
  req,
  value,
}: {
  collection: 'reviewResponses' | 'reviewAppeals'
  label: string
  path: string
  req: PayloadRequest
  value: unknown
}): string => {
  const normalized = optionalTrimmedText(value)
  if (!normalized || normalized.length < MIN_TEXT_LENGTH || normalized.length > MAX_TEXT_LENGTH) {
    throw new ValidationError({
      collection,
      errors: [
        {
          message: `${label} must contain between ${MIN_TEXT_LENGTH} and ${MAX_TEXT_LENGTH} characters.`,
          path,
        },
      ],
      req,
    })
  }

  return normalized
}

const requiredModerationReason = (
  collection: 'reviewResponses' | 'reviewAppeals',
  value: unknown,
  req: PayloadRequest,
): string =>
  requiredWorkflowText({
    collection,
    label: collection === 'reviewResponses' ? 'Moderation reason' : 'Decision reason',
    path: collection === 'reviewResponses' ? 'moderationReason' : 'decisionReason',
    req,
    value,
  })

const resolveReviewContext = async (req: PayloadRequest, value: unknown): Promise<ReviewContext> => {
  const reviewId = relationId(value)
  if (reviewId === null) {
    throw new ValidationError({
      collection: 'reviews',
      errors: [{ message: 'A review is required.', path: 'review' }],
      req,
    })
  }

  const review = (await req.payload.findByID({
    collection: 'reviews',
    id: reviewId,
    depth: 0,
    overrideAccess: true,
    req,
    select: {
      clinic: true,
      status: true,
    },
  })) as { clinic?: unknown; status?: unknown }
  const clinicId = relationId(review.clinic)

  if (clinicId === null) {
    throw new APIError('The selected review is not assigned to a clinic.', 400)
  }

  if (isClinicStaff({ req })) {
    const assignedClinicId = await getUserAssignedClinicId(req.user, req.payload)
    if (assignedClinicId === null || String(assignedClinicId) !== String(clinicId)) {
      throw new ValidationError({
        collection: 'reviews',
        errors: [{ message: 'The selected review does not belong to the assigned clinic.', path: 'review' }],
        req,
      })
    }
  }

  return {
    clinicId,
    reviewId,
    status: typeof review.status === 'string' ? review.status : '',
  }
}

const now = (): string => new Date().toISOString()

const actorType = (req: PayloadRequest): 'clinic_staff' | 'platform_staff' | 'system' => {
  if (isClinicStaff({ req })) return 'clinic_staff'
  if (isPlatformStaff({ req })) return 'platform_staff'
  return 'system'
}

const stampAudit = (draft: WorkflowDraft, req: PayloadRequest, action: string, timestamp = now()): WorkflowDraft => {
  draft.lastAction = action
  draft.lastActionAt = timestamp
  draft.lastActorType = actorType(req)

  if (
    req.user &&
    (req.user.collection === 'clinicStaff' || req.user.collection === 'platformStaff') &&
    req.user.id != null
  ) {
    draft.lastActionBy = {
      relationTo: req.user.collection,
      value: req.user.id,
    }
  } else {
    draft.lastActionBy = null
  }

  return draft
}

const isTrustedSeed = (req: PayloadRequest): boolean => req.context.trustedReviewWorkflowSeed === true

const normalizeResponseGroup = (
  value: unknown,
  req: PayloadRequest,
  kind: 'published' | 'pending',
): ResponseGroup | null => {
  if (!value || typeof value !== 'object') return null
  const group = value as ResponseGroup
  const body = requiredWorkflowText({
    collection: 'reviewResponses',
    label: kind === 'published' ? 'Published response' : 'Pending response',
    path: kind === 'published' ? 'publishedResponse.body' : 'pendingResponse.body',
    req,
    value: group.body,
  })

  return kind === 'published'
    ? {
        body,
        approvedAt: optionalTrimmedText(group.approvedAt) ?? now(),
        isBlocked: group.isBlocked === true,
      }
    : {
        body,
        submittedAt: optionalTrimmedText(group.submittedAt) ?? now(),
      }
}

const prepareTrustedResponseSeed = (
  draft: WorkflowDraft,
  original: WorkflowDraft,
  req: PayloadRequest,
): WorkflowDraft => {
  const status =
    typeof draft.moderationStatus === 'string'
      ? draft.moderationStatus
      : typeof original.moderationStatus === 'string'
        ? original.moderationStatus
        : 'pending'

  if (!responseStatuses.includes(status as (typeof responseStatuses)[number])) {
    throw new APIError(`Unsupported review response status: ${status}`, 400)
  }

  draft.moderationStatus = status
  draft.publishedResponse =
    draft.publishedResponse === null
      ? emptyResponseGroup('published')
      : normalizeResponseGroup(draft.publishedResponse ?? original.publishedResponse, req, 'published')
  draft.pendingResponse =
    draft.pendingResponse === null
      ? emptyResponseGroup('pending')
      : normalizeResponseGroup(draft.pendingResponse ?? original.pendingResponse, req, 'pending')

  if (status === 'rejected' || status === 'blocked') {
    draft.moderationReason = requiredModerationReason('reviewResponses', draft.moderationReason, req)
    draft.moderatedAt = optionalTrimmedText(draft.moderatedAt) ?? now()
  } else {
    draft.moderationReason = optionalTrimmedText(draft.moderationReason)
    draft.moderatedAt = optionalTrimmedText(draft.moderatedAt)
  }

  return stampAudit(draft, req, 'seeded')
}

export const prepareReviewResponseChange: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const incoming = record(data)
  const original = record(originalDoc)
  const reviewValue = operation === 'create' ? incoming.review : original.review
  const context = await resolveReviewContext(req, reviewValue)

  if (context.status !== 'approved') {
    throw new ValidationError({
      collection: 'reviewResponses',
      errors: [{ message: 'Clinic responses can only be submitted for approved reviews.', path: 'review' }],
      req,
    })
  }

  const draft: WorkflowDraft = {
    ...incoming,
    review: context.reviewId,
    clinic: context.clinicId,
  }

  if (isTrustedSeed(req)) {
    return prepareTrustedResponseSeed(draft, original, req)
  }

  if (isClinicStaff({ req })) {
    const pending = normalizeResponseGroup(incoming.pendingResponse, req, 'pending')
    if (!pending) {
      throw new ValidationError({
        collection: 'reviewResponses',
        errors: [{ message: 'A pending clinic response is required.', path: 'pendingResponse.body' }],
        req,
      })
    }

    const hadPublishedResponse = Boolean(original.publishedResponse)
    const hadPendingResponse = Boolean(original.pendingResponse)

    return stampAudit(
      {
        ...original,
        stableId: incoming.stableId ?? original.stableId,
        review: context.reviewId,
        clinic: context.clinicId,
        publishedResponse: original.publishedResponse ?? emptyResponseGroup('published'),
        pendingResponse: {
          ...pending,
          submittedAt:
            hadPendingResponse && record(original.pendingResponse).submittedAt
              ? record(original.pendingResponse).submittedAt
              : pending.submittedAt,
        },
        moderationStatus: 'pending',
        moderationReason: null,
        moderatedAt: null,
      },
      req,
      operation === 'create' ? 'submitted' : hadPublishedResponse ? 'revision_submitted' : 'pending_edited',
    )
  }

  if (!isPlatformStaff({ req })) {
    throw new APIError('Only clinic staff and platform staff can manage review responses.', 403)
  }

  const requestedStatus =
    typeof incoming.moderationStatus === 'string'
      ? incoming.moderationStatus
      : operation === 'create'
        ? 'pending'
        : original.moderationStatus

  if (!responseStatuses.includes(requestedStatus as (typeof responseStatuses)[number])) {
    throw new APIError(`Unsupported review response status: ${String(requestedStatus)}`, 400)
  }

  const pending = normalizeResponseGroup(incoming.pendingResponse ?? original.pendingResponse, req, 'pending')
  const timestamp = now()
  const base: WorkflowDraft = {
    ...original,
    stableId: incoming.stableId ?? original.stableId,
    review: context.reviewId,
    clinic: context.clinicId,
    publishedResponse: original.publishedResponse ?? emptyResponseGroup('published'),
    pendingResponse: pending,
    moderationStatus: requestedStatus,
  }

  if (requestedStatus === 'pending') {
    if (!pending) {
      throw new ValidationError({
        collection: 'reviewResponses',
        errors: [{ message: 'A pending clinic response is required.', path: 'pendingResponse.body' }],
        req,
      })
    }
    base.moderationReason = null
    base.moderatedAt = null
    return stampAudit(base, req, operation === 'create' ? 'submitted' : 'revision_submitted', timestamp)
  }

  if (requestedStatus === 'approved') {
    if (!pending) {
      throw new ValidationError({
        collection: 'reviewResponses',
        errors: [{ message: 'There is no pending clinic response to approve.', path: 'pendingResponse.body' }],
        req,
      })
    }
    base.publishedResponse = {
      body: pending.body,
      approvedAt: timestamp,
      isBlocked: false,
    }
    base.pendingResponse = emptyResponseGroup('pending')
    base.moderationReason = optionalTrimmedText(incoming.moderationReason)
    base.moderatedAt = timestamp
    return stampAudit(base, req, 'approved', timestamp)
  }

  const moderationReason = requiredModerationReason('reviewResponses', incoming.moderationReason, req)
  base.moderationReason = moderationReason
  base.moderatedAt = timestamp
  base.pendingResponse = emptyResponseGroup('pending')

  if (requestedStatus === 'blocked') {
    const published = record(original.publishedResponse)
    base.publishedResponse = published.body ? { ...published, isBlocked: true } : emptyResponseGroup('published')
  }

  return stampAudit(base, req, String(requestedStatus), timestamp)
}

const prepareTrustedAppealSeed = (
  draft: WorkflowDraft,
  original: WorkflowDraft,
  req: PayloadRequest,
): WorkflowDraft => {
  const status =
    typeof draft.status === 'string'
      ? draft.status
      : typeof original.status === 'string'
        ? original.status
        : 'submitted'

  if (!appealStatuses.includes(status as (typeof appealStatuses)[number])) {
    throw new APIError(`Unsupported review appeal status: ${status}`, 400)
  }

  draft.status = status
  draft.details = requiredWorkflowText({
    collection: 'reviewAppeals',
    label: 'Appeal details',
    path: 'details',
    req,
    value: draft.details ?? original.details,
  })

  if (status === 'upheld' || status === 'dismissed') {
    draft.decisionReason = requiredModerationReason('reviewAppeals', draft.decisionReason, req)
    draft.decidedAt = optionalTrimmedText(draft.decidedAt) ?? now()
  } else {
    draft.decisionReason = null
    draft.decidedAt = null
  }

  return stampAudit(draft, req, 'seeded')
}

export const prepareReviewAppealChange: CollectionBeforeChangeHook = async ({ data, operation, originalDoc, req }) => {
  const incoming = record(data)
  const original = record(originalDoc)
  const reviewValue = operation === 'create' ? incoming.review : original.review
  const context = await resolveReviewContext(req, reviewValue)

  if (operation === 'create' && context.status !== 'approved') {
    throw new ValidationError({
      collection: 'reviewAppeals',
      errors: [{ message: 'Appeals can only be submitted for approved reviews.', path: 'review' }],
      req,
    })
  }

  const draft: WorkflowDraft = {
    ...incoming,
    review: context.reviewId,
    clinic: context.clinicId,
  }

  if (isTrustedSeed(req)) {
    return prepareTrustedAppealSeed(draft, original, req)
  }

  if (operation === 'create') {
    const details = requiredWorkflowText({
      collection: 'reviewAppeals',
      label: 'Appeal details',
      path: 'details',
      req,
      value: incoming.details,
    })

    return stampAudit(
      {
        ...draft,
        details,
        status: 'submitted',
        decisionReason: null,
        decidedAt: null,
      },
      req,
      'submitted',
    )
  }

  if (!isPlatformStaff({ req })) {
    throw new APIError('Submitted review appeals cannot be edited by clinic staff.', 403)
  }

  const currentStatus = typeof original.status === 'string' ? original.status : 'submitted'
  const requestedStatus = typeof incoming.status === 'string' ? incoming.status : currentStatus
  const allowedNextStatus: Record<string, readonly string[]> = {
    submitted: ['under_review'],
    under_review: ['upheld', 'dismissed'],
    upheld: [],
    dismissed: [],
  }

  if (requestedStatus !== currentStatus && !allowedNextStatus[currentStatus]?.includes(requestedStatus)) {
    throw new ValidationError({
      collection: 'reviewAppeals',
      errors: [
        {
          message: `Review appeal status cannot move from ${currentStatus} to ${requestedStatus}.`,
          path: 'status',
        },
      ],
      req,
    })
  }

  const timestamp = now()
  const result: WorkflowDraft = {
    ...original,
    stableId: incoming.stableId ?? original.stableId,
    review: context.reviewId,
    clinic: context.clinicId,
    status: requestedStatus,
  }

  if (requestedStatus === 'upheld' || requestedStatus === 'dismissed') {
    result.decisionReason = requiredModerationReason('reviewAppeals', incoming.decisionReason, req)
    result.decidedAt = timestamp
  } else {
    result.decisionReason = null
    result.decidedAt = null
  }

  return stampAudit(result, req, requestedStatus === currentStatus ? 'reviewed' : requestedStatus, timestamp)
}

export const applyUpheldAppealDecision: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const current = record(doc)
  const previous = record(previousDoc)
  if (current.status !== 'upheld' || previous.status === 'upheld') return doc

  const reviewId = relationId(current.review)
  if (reviewId === null) return doc

  await req.payload.update({
    collection: 'reviews',
    id: reviewId,
    data: {
      status: 'rejected',
    },
    context: {
      ...req.context,
      reviewAppealDecision: true,
    },
    depth: 0,
    overrideAccess: true,
    req,
  })

  return doc
}

export const hideEmptyReviewResponseGroups: CollectionAfterReadHook = ({ doc }) => {
  if (!optionalTrimmedText(record(doc.publishedResponse).body)) {
    doc.publishedResponse = undefined
  }
  if (!optionalTrimmedText(record(doc.pendingResponse).body)) {
    doc.pendingResponse = undefined
  }

  return doc
}

export const preventReviewWorkflowVersionRestore: CollectionBeforeOperationHook = ({ args, operation }) => {
  if (operation === 'restoreVersion') {
    throw new APIError('Review workflow versions are immutable audit records and cannot be restored.', 403)
  }

  return args
}

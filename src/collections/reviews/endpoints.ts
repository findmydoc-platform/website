import type { PayloadHandler, PayloadRequest } from 'payload'
import { z } from 'zod'

import type { Review } from '@/payload-types'
import { getUserAssignedClinicId } from '@/access/utils/getClinicAssignment'
import {
  getReviewPublicMeasure,
  getReviewWithdrawalState,
  projectPublicReviewText,
  REVIEW_PLACEHOLDER_NOTICE,
  REVIEW_REDACTION_NOTICE,
  type ReviewPublicMeasure,
} from '@/collections/reviews/publicProjection'
import { toLoggedError } from '@/utilities/logging/shared'

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
  Vary: 'Authorization',
} as const

const moderationInputSchema = z.discriminatedUnion('measure', [
  z.object({ measure: z.literal('none'), reason: z.string().trim().min(1).max(2000) }).strict(),
  z
    .object({
      measure: z.literal('context'),
      reason: z.string().trim().min(1).max(2000),
      publicNotice: z.string().trim().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      measure: z.literal('redaction'),
      reason: z.string().trim().min(1).max(2000),
      publicComment: z.string().trim().min(1).max(10000),
    })
    .strict(),
  z.object({ measure: z.literal('placeholder'), reason: z.string().trim().min(1).max(2000) }).strict(),
  z.object({ measure: z.literal('removed'), reason: z.string().trim().min(1).max(2000) }).strict(),
])

const withdrawalInputSchema = z.object({ reason: z.string().trim().min(1).max(2000).optional() }).strict()
const correctionInputSchema = z.object({ reason: z.string().trim().min(1).max(2000) }).strict()

type ReviewCommandErrorCode =
  'FORBIDDEN' | 'INVALID_INPUT' | 'NOT_FOUND' | 'REVIEW_WITHDRAWN' | 'UNAUTHORIZED' | 'UNAVAILABLE'

const privateJsonResponse = (body: unknown, status: number): Response =>
  Response.json(body, { status, headers: PRIVATE_HEADERS })

const errorResponse = (code: ReviewCommandErrorCode, status: number): Response =>
  privateJsonResponse({ error: { code } }, status)

const isPlatformStaffRequest = (req: PayloadRequest): boolean => req.user?.collection === 'platformStaff'
const isClinicStaffRequest = (req: PayloadRequest): boolean => req.user?.collection === 'clinicStaff'
const isPatientRequest = (req: PayloadRequest): boolean => req.user?.collection === 'patients'

const relationId = (value: unknown): string | number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.length > 0) return value
  if (value && typeof value === 'object' && 'id' in value) {
    return relationId((value as { id?: unknown }).id)
  }
  return null
}

const sameId = (left: unknown, right: unknown): boolean => {
  const leftId = relationId(left)
  const rightId = relationId(right)
  return leftId !== null && rightId !== null && String(leftId) === String(rightId)
}

const routeReviewId = (req: PayloadRequest): string | number | null => relationId(req.routeParams?.id)

const readRequestBody = async (req: PayloadRequest): Promise<unknown> =>
  typeof req.json === 'function' ? req.json().catch(() => undefined) : undefined

const findReview = async (req: PayloadRequest, id: string | number): Promise<Review | null> => {
  try {
    return (await req.payload.findByID({
      collection: 'reviews',
      id,
      depth: 0,
      overrideAccess: true,
      req,
    })) as Review
  } catch {
    return null
  }
}

const commandResult = (review: Review) => ({
  id: review.id,
  publicMeasure: getReviewPublicMeasure(review),
  publicComment: typeof review.publicComment === 'string' ? review.publicComment : null,
  publicNotice: typeof review.publicNotice === 'string' ? review.publicNotice : null,
  moderatedAt: typeof review.moderatedAt === 'string' ? review.moderatedAt : null,
  withdrawalState: getReviewWithdrawalState(review),
  withdrawalSource: review.withdrawalSource ?? null,
  withdrawnAt: typeof review.withdrawnAt === 'string' ? review.withdrawnAt : null,
})

const moderationData = (
  input: z.infer<typeof moderationInputSchema>,
  req: PayloadRequest,
  timestamp: string,
): Partial<Review> => {
  const shared = {
    publicMeasure: input.measure,
    moderationReason: input.reason,
    moderatedAt: timestamp,
    moderatedBy: req.user?.id,
  } satisfies Partial<Review>

  switch (input.measure) {
    case 'none':
      return { ...shared, publicComment: null, publicNotice: null }
    case 'context':
      return { ...shared, publicComment: null, publicNotice: input.publicNotice }
    case 'redaction':
      return { ...shared, publicComment: input.publicComment, publicNotice: REVIEW_REDACTION_NOTICE }
    case 'placeholder':
      return { ...shared, publicComment: null, publicNotice: REVIEW_PLACEHOLDER_NOTICE }
    case 'removed':
      return { ...shared, publicComment: null, publicNotice: null }
  }
}

const unexpectedErrorResponse = (req: PayloadRequest, error: unknown, operation: string): Response => {
  req.payload.logger.error(
    { err: toLoggedError(error), event: `review_publication.${operation}_failed` },
    'Review publication operation failed',
  )
  return errorResponse('UNAVAILABLE', 503)
}

export const reviewModerationPostHandler: PayloadHandler = async (req) => {
  if (!req.user) return errorResponse('UNAUTHORIZED', 401)
  if (!isPlatformStaffRequest(req)) return errorResponse('FORBIDDEN', 403)

  const id = routeReviewId(req)
  if (id === null) return errorResponse('NOT_FOUND', 404)

  const parsed = moderationInputSchema.safeParse(await readRequestBody(req))
  if (!parsed.success) return errorResponse('INVALID_INPUT', 400)

  const review = await findReview(req, id)
  if (!review) return errorResponse('NOT_FOUND', 404)
  if (getReviewWithdrawalState(review) === 'withdrawn') return errorResponse('REVIEW_WITHDRAWN', 409)

  try {
    const updated = (await req.payload.update({
      collection: 'reviews',
      id,
      data: moderationData(parsed.data, req, new Date().toISOString()),
      depth: 0,
      overrideAccess: true,
      req,
    })) as Review

    return privateJsonResponse({ data: commandResult(updated) }, 200)
  } catch (error: unknown) {
    return unexpectedErrorResponse(req, error, 'moderation')
  }
}

export const reviewWithdrawPostHandler: PayloadHandler = async (req) => {
  if (!req.user) return errorResponse('UNAUTHORIZED', 401)
  if (!isPatientRequest(req) && !isPlatformStaffRequest(req)) return errorResponse('FORBIDDEN', 403)

  const id = routeReviewId(req)
  if (id === null) return errorResponse('NOT_FOUND', 404)

  const parsed = withdrawalInputSchema.safeParse(await readRequestBody(req))
  if (!parsed.success) return errorResponse('INVALID_INPUT', 400)
  if (isPlatformStaffRequest(req) && !parsed.data.reason) return errorResponse('INVALID_INPUT', 400)

  const review = await findReview(req, id)
  if (!review) return errorResponse('NOT_FOUND', 404)
  if (isPatientRequest(req) && !sameId(review.patient, req.user.id)) return errorResponse('NOT_FOUND', 404)

  if (getReviewWithdrawalState(review) === 'withdrawn') {
    return privateJsonResponse({ data: commandResult(review) }, 200)
  }

  const patientWithdrawal = isPatientRequest(req)
  const timestamp = new Date().toISOString()

  try {
    const updated = (await req.payload.update({
      collection: 'reviews',
      id,
      data: {
        withdrawalState: 'withdrawn',
        withdrawalSource: patientWithdrawal ? 'patient' : 'platform',
        withdrawalReason: patientWithdrawal ? 'Withdrawn by the review author.' : parsed.data.reason,
        withdrawnAt: timestamp,
        withdrawnBy: {
          relationTo: patientWithdrawal ? 'patients' : 'platformStaff',
          value: req.user.id,
        },
      },
      depth: 0,
      overrideAccess: true,
      req,
    })) as Review

    return privateJsonResponse({ data: commandResult(updated) }, 200)
  } catch (error: unknown) {
    return unexpectedErrorResponse(req, error, 'withdraw')
  }
}

export const reviewWithdrawalCorrectionPostHandler: PayloadHandler = async (req) => {
  if (!req.user) return errorResponse('UNAUTHORIZED', 401)
  if (!isPlatformStaffRequest(req)) return errorResponse('FORBIDDEN', 403)

  const id = routeReviewId(req)
  if (id === null) return errorResponse('NOT_FOUND', 404)

  const parsed = correctionInputSchema.safeParse(await readRequestBody(req))
  if (!parsed.success) return errorResponse('INVALID_INPUT', 400)

  const review = await findReview(req, id)
  if (!review) return errorResponse('NOT_FOUND', 404)
  if (getReviewWithdrawalState(review) !== 'withdrawn') return errorResponse('INVALID_INPUT', 409)

  try {
    const updated = (await req.payload.update({
      collection: 'reviews',
      id,
      data: {
        withdrawalState: 'active',
        withdrawalSource: 'platform',
        withdrawalReason: parsed.data.reason,
        withdrawnAt: new Date().toISOString(),
        withdrawnBy: { relationTo: 'platformStaff', value: req.user.id },
      },
      depth: 0,
      overrideAccess: true,
      req,
    })) as Review

    return privateJsonResponse({ data: commandResult(updated) }, 200)
  } catch (error: unknown) {
    return unexpectedErrorResponse(req, error, 'withdrawal_correction')
  }
}

type ReviewVersionRecord = {
  id?: unknown
  createdAt?: unknown
  updatedAt?: unknown
  version?: Review
}

type PublicationHistoryActorType = 'patient' | 'platform_staff' | 'system'

const publicationHistoryActorType = (version: Review): PublicationHistoryActorType => {
  if (version.withdrawalSource === 'patient') return 'patient'
  if (version.withdrawalSource === 'platform' || version.moderatedBy || version.withdrawnBy) return 'platform_staff'
  return 'system'
}

const safeHistoryPublicProjection = (
  version: Review,
  current: Review,
): { matchesCurrentProjection: boolean; publicNotice: string | null; publicText: string | null } => {
  const currentProjection = projectPublicReviewText(current)
  const versionProjection = projectPublicReviewText(version)

  if (!currentProjection || !versionProjection || currentProjection.kind !== versionProjection.kind) {
    return { matchesCurrentProjection: false, publicNotice: null, publicText: null }
  }

  if (currentProjection.kind === 'placeholder' && versionProjection.kind === 'placeholder') {
    const matchesCurrentProjection = versionProjection.notice === currentProjection.notice
    return matchesCurrentProjection
      ? { matchesCurrentProjection, publicNotice: currentProjection.notice, publicText: null }
      : { matchesCurrentProjection, publicNotice: null, publicText: null }
  }

  if (currentProjection.kind !== 'text' || versionProjection.kind !== 'text') {
    return { matchesCurrentProjection: false, publicNotice: null, publicText: null }
  }

  const currentNotice = currentProjection.notice ?? null
  const versionNotice = versionProjection.notice ?? null
  const matchesCurrentProjection = versionProjection.text === currentProjection.text && versionNotice === currentNotice

  return matchesCurrentProjection
    ? { matchesCurrentProjection, publicNotice: currentNotice, publicText: currentProjection.text }
    : { matchesCurrentProjection, publicNotice: null, publicText: null }
}

const mapHistoryVersion = (record: ReviewVersionRecord, current: Review) => {
  const version = record.version
  if (!version) return null
  const safePublicProjection = safeHistoryPublicProjection(version, current)
  const currentPublicAuthorName =
    typeof current.publicAuthorName === 'string' && current.publicAuthorName.length > 0
      ? current.publicAuthorName
      : null

  return {
    id: relationId(record.id),
    recordedAt:
      typeof record.createdAt === 'string'
        ? record.createdAt
        : typeof record.updatedAt === 'string'
          ? record.updatedAt
          : null,
    status: version.status,
    starRating: version.starRating,
    reviewDate: version.reviewDate,
    publicAuthorName:
      safePublicProjection.matchesCurrentProjection &&
      currentPublicAuthorName &&
      version.publicAuthorName === currentPublicAuthorName
        ? currentPublicAuthorName
        : null,
    publicMeasure: getReviewPublicMeasure(version),
    withdrawalState: getReviewWithdrawalState(version),
    withdrawalSource: version.withdrawalSource ?? null,
    withdrawnAt: typeof version.withdrawnAt === 'string' ? version.withdrawnAt : null,
    publicText: safePublicProjection.publicText,
    publicNotice: safePublicProjection.publicNotice,
    actorType: publicationHistoryActorType(version),
  }
}

export const reviewPublicationHistoryGetHandler: PayloadHandler = async (req) => {
  if (!req.user) return errorResponse('UNAUTHORIZED', 401)
  if (!isPlatformStaffRequest(req) && !isClinicStaffRequest(req)) return errorResponse('FORBIDDEN', 403)

  const id = routeReviewId(req)
  if (id === null) return errorResponse('NOT_FOUND', 404)
  const review = await findReview(req, id)
  if (!review) return errorResponse('NOT_FOUND', 404)

  if (isClinicStaffRequest(req)) {
    if (review.status !== 'approved' || review.deletedAt) return errorResponse('NOT_FOUND', 404)
    const clinicId = await getUserAssignedClinicId(req.user, req.payload)
    if (clinicId === null || !sameId(review.clinic, clinicId)) return errorResponse('NOT_FOUND', 404)
  }

  try {
    const versions = await req.payload.findVersions({
      collection: 'reviews',
      where: { parent: { equals: id } },
      depth: 0,
      pagination: false,
      sort: '-createdAt',
      overrideAccess: true,
      req,
    })

    return privateJsonResponse(
      {
        data: {
          reviewId: review.id,
          versions: (versions.docs as ReviewVersionRecord[])
            .map((version) => mapHistoryVersion(version, review))
            .filter((version) => version !== null),
        },
      },
      200,
    )
  } catch (error: unknown) {
    return unexpectedErrorResponse(req, error, 'publication_history')
  }
}

export const reviewPublicationEndpoints = [
  { path: '/:id/moderation', method: 'post' as const, handler: reviewModerationPostHandler },
  { path: '/:id/withdraw', method: 'post' as const, handler: reviewWithdrawPostHandler },
  {
    path: '/:id/withdrawal-correction',
    method: 'post' as const,
    handler: reviewWithdrawalCorrectionPostHandler,
  },
  { path: '/:id/publication-history', method: 'get' as const, handler: reviewPublicationHistoryGetHandler },
]

export const isSupportedReviewPublicMeasure = (value: unknown): value is ReviewPublicMeasure =>
  value === 'none' || value === 'context' || value === 'redaction' || value === 'placeholder' || value === 'removed'

import type { PayloadHandler, PayloadRequest, Where } from 'payload'
import { z } from 'zod'

import type { Review } from '@/payload-types'
import { getUserAssignedClinicId } from '@/access/utils/getClinicAssignment'
import { runReviewCommandTransaction } from '@/collections/reviews/commandTransaction'
import {
  getReviewPublicMeasure,
  getReviewWithdrawalState,
  projectPublicReviewText,
  REVIEW_PLACEHOLDER_NOTICE,
  REVIEW_REDACTION_NOTICE,
  type ReviewPublicMeasure,
} from '@/collections/reviews/publicProjection'
import { dispatchReviewChangeRevalidation } from '@/hooks/revalidateClinicSurfaces'
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
  'FORBIDDEN' | 'HISTORY_CHANGED' | 'INVALID_INPUT' | 'NOT_FOUND' | 'REVIEW_WITHDRAWN' | 'UNAUTHORIZED' | 'UNAVAILABLE'

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
  return (await req.payload.findByID({
    collection: 'reviews',
    id,
    depth: 0,
    disableErrors: true,
    overrideAccess: true,
    req,
  })) as Review | null
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

type ReviewCommandOutcome =
  | { readonly response: Response }
  | {
      readonly doc: Review
      readonly previousDoc: Review
      readonly response: Response
    }

const finalizeReviewCommandOutcome = async (req: PayloadRequest, outcome: ReviewCommandOutcome): Promise<Response> => {
  if ('doc' in outcome) {
    try {
      await dispatchReviewChangeRevalidation({
        doc: outcome.doc,
        previousDoc: outcome.previousDoc,
        req,
      })
    } catch (error: unknown) {
      req.payload.logger.error(
        { err: toLoggedError(error), event: 'review_publication.post_commit_revalidation_failed' },
        'Review publication post-commit revalidation failed',
      )
    }
  }

  return outcome.response
}

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

  try {
    const outcome = await runReviewCommandTransaction<ReviewCommandOutcome>(req, async () => {
      const review = await findReview(req, id)
      if (!review) return { response: errorResponse('NOT_FOUND', 404) }
      if (getReviewWithdrawalState(review) === 'withdrawn') {
        return { response: errorResponse('REVIEW_WITHDRAWN', 409) }
      }

      const updated = (await req.payload.update({
        collection: 'reviews',
        id,
        context: { disableRevalidate: true },
        data: moderationData(parsed.data, req, new Date().toISOString()),
        depth: 0,
        overrideAccess: true,
        req,
      })) as Review

      return {
        doc: updated,
        previousDoc: review,
        response: privateJsonResponse({ data: commandResult(updated) }, 200),
      }
    })

    return await finalizeReviewCommandOutcome(req, outcome)
  } catch (error: unknown) {
    return unexpectedErrorResponse(req, error, 'moderation')
  }
}

export const reviewWithdrawPostHandler: PayloadHandler = async (req) => {
  if (!req.user) return errorResponse('UNAUTHORIZED', 401)
  if (!isPatientRequest(req) && !isPlatformStaffRequest(req)) return errorResponse('FORBIDDEN', 403)
  const user = req.user

  const id = routeReviewId(req)
  if (id === null) return errorResponse('NOT_FOUND', 404)

  const parsed = withdrawalInputSchema.safeParse(await readRequestBody(req))
  if (!parsed.success) return errorResponse('INVALID_INPUT', 400)
  if (isPlatformStaffRequest(req) && !parsed.data.reason) return errorResponse('INVALID_INPUT', 400)

  const patientWithdrawal = isPatientRequest(req)

  try {
    const outcome = await runReviewCommandTransaction<ReviewCommandOutcome>(req, async () => {
      const review = await findReview(req, id)
      if (!review) return { response: errorResponse('NOT_FOUND', 404) }
      if (isPatientRequest(req) && !sameId(review.patient, user.id)) {
        return { response: errorResponse('NOT_FOUND', 404) }
      }

      if (getReviewWithdrawalState(review) === 'withdrawn') {
        return { response: privateJsonResponse({ data: commandResult(review) }, 200) }
      }

      const updated = (await req.payload.update({
        collection: 'reviews',
        id,
        context: { disableRevalidate: true },
        data: {
          withdrawalState: 'withdrawn',
          withdrawalSource: patientWithdrawal ? 'patient' : 'platform',
          withdrawalReason: patientWithdrawal ? 'Withdrawn by the review author.' : parsed.data.reason,
          withdrawnAt: new Date().toISOString(),
          withdrawnBy: {
            relationTo: patientWithdrawal ? 'patients' : 'platformStaff',
            value: user.id,
          },
        },
        depth: 0,
        overrideAccess: true,
        req,
      })) as Review

      return {
        doc: updated,
        previousDoc: review,
        response: privateJsonResponse({ data: commandResult(updated) }, 200),
      }
    })

    return await finalizeReviewCommandOutcome(req, outcome)
  } catch (error: unknown) {
    return unexpectedErrorResponse(req, error, 'withdraw')
  }
}

export const reviewWithdrawalCorrectionPostHandler: PayloadHandler = async (req) => {
  if (!req.user) return errorResponse('UNAUTHORIZED', 401)
  if (!isPlatformStaffRequest(req)) return errorResponse('FORBIDDEN', 403)
  const user = req.user

  const id = routeReviewId(req)
  if (id === null) return errorResponse('NOT_FOUND', 404)

  const parsed = correctionInputSchema.safeParse(await readRequestBody(req))
  if (!parsed.success) return errorResponse('INVALID_INPUT', 400)

  try {
    const outcome = await runReviewCommandTransaction<ReviewCommandOutcome>(req, async () => {
      const review = await findReview(req, id)
      if (!review) return { response: errorResponse('NOT_FOUND', 404) }
      if (getReviewWithdrawalState(review) !== 'withdrawn') {
        return { response: errorResponse('INVALID_INPUT', 409) }
      }

      const updated = (await req.payload.update({
        collection: 'reviews',
        id,
        context: { disableRevalidate: true },
        data: {
          withdrawalState: 'active',
          withdrawalSource: 'platform',
          withdrawalReason: parsed.data.reason,
          withdrawnAt: new Date().toISOString(),
          withdrawnBy: { relationTo: 'platformStaff', value: user.id },
        },
        depth: 0,
        overrideAccess: true,
        req,
      })) as Review

      return {
        doc: updated,
        previousDoc: review,
        response: privateJsonResponse({ data: commandResult(updated) }, 200),
      }
    })

    return await finalizeReviewCommandOutcome(req, outcome)
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

const PUBLICATION_HISTORY_DEFAULT_LIMIT = 25
const PUBLICATION_HISTORY_MAX_LIMIT = 100
const PUBLICATION_HISTORY_CURSOR_VERSION = 1
const PUBLICATION_HISTORY_MAX_CURSOR_LENGTH = 2048

const publicationHistoryCursorIdSchema = z.union([z.string().min(1), z.number().int().safe()])
const publicationHistoryCursorSchema = z
  .object({
    version: z.literal(PUBLICATION_HISTORY_CURSOR_VERSION),
    reviewId: publicationHistoryCursorIdSchema,
    reviewRevision: z.string().datetime({ offset: true }),
    createdAt: z.string().datetime({ offset: true }),
    id: publicationHistoryCursorIdSchema,
  })
  .strict()

type PublicationHistoryCursor = z.infer<typeof publicationHistoryCursorSchema>

type PublicationHistoryQuery = {
  cursor: PublicationHistoryCursor | null
  limit: number
}

const decodePublicationHistoryCursor = (value: string): PublicationHistoryCursor | null => {
  if (value.length > PUBLICATION_HISTORY_MAX_CURSOR_LENGTH || !/^[A-Za-z0-9_-]+$/.test(value)) return null

  try {
    const decoded = Buffer.from(value, 'base64url')
    if (decoded.toString('base64url') !== value) return null

    const parsed = publicationHistoryCursorSchema.safeParse(JSON.parse(decoded.toString('utf8')))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

const encodePublicationHistoryCursor = (cursor: PublicationHistoryCursor): string =>
  Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')

const parsePublicationHistoryQuery = (req: PayloadRequest): PublicationHistoryQuery | null => {
  for (const key of req.searchParams.keys()) {
    if (key !== 'limit' && key !== 'cursor') return null
  }

  const limitValues = req.searchParams.getAll('limit')
  const cursorValues = req.searchParams.getAll('cursor')
  if (limitValues.length > 1 || cursorValues.length > 1) return null

  const rawLimit = limitValues[0]
  const limit = rawLimit === undefined ? PUBLICATION_HISTORY_DEFAULT_LIMIT : Number(rawLimit)
  if (
    (rawLimit !== undefined && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(rawLimit)) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > PUBLICATION_HISTORY_MAX_LIMIT
  ) {
    return null
  }

  const rawCursor = cursorValues[0]
  const cursor = rawCursor === undefined ? null : decodePublicationHistoryCursor(rawCursor)
  if (rawCursor !== undefined && cursor === null) return null

  return { cursor, limit }
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

  try {
    const review = await findReview(req, id)
    if (!review) return errorResponse('NOT_FOUND', 404)

    if (isClinicStaffRequest(req)) {
      if (review.status !== 'approved' || review.deletedAt) return errorResponse('NOT_FOUND', 404)
      const clinicId = await getUserAssignedClinicId(req.user, req.payload)
      if (clinicId === null || !sameId(review.clinic, clinicId)) return errorResponse('NOT_FOUND', 404)
    }

    const query = parsePublicationHistoryQuery(req)
    if (!query) return errorResponse('INVALID_INPUT', 400)
    if (query.cursor && !sameId(query.cursor.reviewId, review.id)) {
      return errorResponse('INVALID_INPUT', 400)
    }
    if (query.cursor && query.cursor.reviewRevision !== review.updatedAt) {
      return errorResponse('HISTORY_CHANGED', 409)
    }

    const where: Where = query.cursor
      ? {
          and: [
            { parent: { equals: id } },
            {
              or: [
                { createdAt: { less_than: query.cursor.createdAt } },
                {
                  and: [{ createdAt: { equals: query.cursor.createdAt } }, { id: { less_than: query.cursor.id } }],
                },
              ],
            },
          ],
        }
      : { parent: { equals: id } }

    const versions = await req.payload.findVersions({
      collection: 'reviews',
      where,
      depth: 0,
      limit: query.limit + 1,
      pagination: false,
      sort: ['-createdAt', '-id'],
      overrideAccess: true,
      req,
    })

    const pageRecords = (versions.docs as ReviewVersionRecord[]).slice(0, query.limit)
    const mappedVersions = pageRecords.map((version) => mapHistoryVersion(version, review))
    if (mappedVersions.some((version) => version === null)) {
      throw new Error('Review publication history contains an invalid native version record')
    }

    const hasNextPage = versions.docs.length > query.limit
    const lastRecord = pageRecords.at(-1)
    let nextCursor: string | null = null
    if (hasNextPage) {
      const cursor = publicationHistoryCursorSchema.safeParse({
        version: PUBLICATION_HISTORY_CURSOR_VERSION,
        reviewId: review.id,
        reviewRevision: review.updatedAt,
        createdAt: lastRecord?.createdAt,
        id: lastRecord?.id,
      })
      if (!cursor.success) {
        throw new Error('Review publication history cannot create a cursor for the native version record')
      }
      nextCursor = encodePublicationHistoryCursor(cursor.data)
    }

    return privateJsonResponse(
      {
        data: {
          reviewId: review.id,
          versions: mappedVersions,
          pagination: {
            limit: query.limit,
            hasNextPage,
            nextCursor,
          },
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

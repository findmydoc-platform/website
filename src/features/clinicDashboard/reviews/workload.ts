import { APIError, type PayloadRequest } from 'payload'
import { z } from 'zod'
import { readClinicTargetAccess } from '@/auth/utilities/clinicPrincipalAccess'
import { clinicAssignmentRelationId } from '@/auth/utilities/clinicStaffAssignment'
import { isReviewPubliclyVisible } from '@/collections/reviews/publicProjection'

const clinicReviewWorkloadSchema = z
  .object({
    reviewsToAnswerCount: z.number().int().nonnegative(),
    pendingModerationCount: z.number().int().nonnegative(),
  })
  .strict()

const unavailable = () => new APIError('Review workload unavailable.', 503)
const pageSize = 100

/** Complete, request-authorized current inventory, independent of list and reporting filters. */
export async function readClinicReviewWorkload(req: PayloadRequest, clinicId: string) {
  if (new URL(req.url ?? 'http://localhost:3000').search) throw new APIError('Invalid review request.', 400)
  const authorize = async () => {
    if (
      req.user?.collection !== 'clinicStaff' ||
      !(await readClinicTargetAccess(req.payload, req.user.id, clinicId, req))
    )
      throw new APIError('Review access unavailable.', 403)
  }
  await authorize()
  let reviewsToAnswerCount = 0
  let pendingModerationCount = 0
  const seenReviews = new Set<string>()
  const seenResponses = new Set<string>()
  let expectedReviews: number | undefined
  for (let page = 1; ; page++) {
    const result = await req.payload.find({
      collection: 'reviews',
      overrideAccess: false,
      req,
      depth: 0,
      limit: pageSize,
      page,
      sort: 'id',
      select: { clinic: true, status: true, publicMeasure: true, withdrawalState: true, deletedAt: true },
      where: {
        and: [
          { clinic: { equals: Number(clinicId) } },
          { status: { equals: 'approved' } },
          { deletedAt: { exists: false } },
        ],
      },
    })
    if (
      !Number.isSafeInteger(result.totalDocs) ||
      result.totalDocs < 0 ||
      result.page !== page ||
      (expectedReviews !== undefined && result.totalDocs !== expectedReviews)
    )
      throw unavailable()
    expectedReviews = result.totalDocs
    const visible = new Set<string>()
    const ids = result.docs.map((review) => {
      const id = String(review.id)
      if (
        clinicAssignmentRelationId(review.clinic) !== Number(clinicId) ||
        review.status !== 'approved' ||
        review.deletedAt ||
        seenReviews.has(id)
      )
        throw unavailable()
      seenReviews.add(id)
      if (isReviewPubliclyVisible(review)) visible.add(id)
      return id
    })
    const answered = new Set<string>()
    if (ids.length) {
      let expectedResponses: number | undefined
      let responseCount = 0
      for (let responsePage = 1; ; responsePage++) {
        const responses = await req.payload.find({
          collection: 'reviewResponses',
          overrideAccess: false,
          req,
          depth: 0,
          limit: pageSize,
          page: responsePage,
          sort: 'id',
          select: { clinic: true, review: true, moderationStatus: true },
          where: { and: [{ clinic: { equals: Number(clinicId) } }, { review: { in: ids } }] },
        })
        if (
          !Number.isSafeInteger(responses.totalDocs) ||
          responses.totalDocs < 0 ||
          responses.page !== responsePage ||
          (expectedResponses !== undefined && responses.totalDocs !== expectedResponses)
        )
          throw unavailable()
        expectedResponses = responses.totalDocs
        for (const response of responses.docs) {
          const id = String(response.id)
          const parent = String(clinicAssignmentRelationId(response.review))
          if (
            clinicAssignmentRelationId(response.clinic) !== Number(clinicId) ||
            !ids.includes(parent) ||
            seenResponses.has(id) ||
            answered.has(parent) ||
            !['pending', 'approved', 'rejected', 'blocked'].includes(response.moderationStatus)
          )
            throw unavailable()
          seenResponses.add(id)
          answered.add(parent)
          responseCount++
          if (response.moderationStatus === 'pending') pendingModerationCount++
        }
        if (!responses.hasNextPage) {
          if (responseCount !== expectedResponses) throw unavailable()
          break
        }
        if (responses.docs.length !== pageSize || responses.nextPage !== responsePage + 1) throw unavailable()
      }
    }
    reviewsToAnswerCount += [...visible].filter((id) => !answered.has(id)).length
    if (!result.hasNextPage) {
      if (seenReviews.size !== expectedReviews) throw unavailable()
      break
    }
    if (result.docs.length !== pageSize || result.nextPage !== page + 1) throw unavailable()
    await authorize()
  }
  await authorize()
  return clinicReviewWorkloadSchema.parse({ reviewsToAnswerCount, pendingModerationCount })
}

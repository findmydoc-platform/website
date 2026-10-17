import type { PayloadRequest } from 'payload'
import { readClinicTargetAccess } from '@/auth/utilities/clinicPrincipalAccess'
import { clinicAssignmentRelationId } from '@/auth/utilities/clinicStaffAssignment'
import type { Review } from '@/payload-types'
import {
  getReviewPublicMeasure,
  getReviewWithdrawalState,
  isReviewPubliclyVisible,
  projectPublicReviewText,
} from '@/collections/reviews/publicProjection'
import { clinicReviewDetailSchema, type ClinicReviewDetail } from './contracts'

export async function readClinicReviewDetail(
  req: PayloadRequest,
  id: string,
  targetClinicId: string,
): Promise<ClinicReviewDetail | null> {
  if (req.user?.collection !== 'clinicStaff') return null
  const access = await readClinicTargetAccess(req.payload, req.user.id, targetClinicId, req)
  if (!access) return null
  const result = await req.payload.find({
    collection: 'reviews',
    overrideAccess: false,
    req,
    depth: 1,
    limit: 1,
    pagination: false,
    where: { and: [{ id: { equals: id } }, { clinic: { equals: access.clinic.id } }] },
  })
  const review = result.docs[0]
  if (!review || review.status !== 'approved' || review.deletedAt) return null
  if (String(review.id) !== id || clinicAssignmentRelationId(review.clinic) !== access.clinic.id) return null
  return projectClinicReviewDetail(review)
}

export function projectClinicReviewDetail(review: Review): ClinicReviewDetail | null {
  if (review.status !== 'approved' || review.deletedAt) return null
  const treatment = review.treatment
  if (!treatment || typeof treatment !== 'object') throw new Error('Authorized review treatment is unavailable.')
  const text = projectPublicReviewText(review)
  const measure = getReviewPublicMeasure(review)
  return clinicReviewDetailSchema.parse({
    id: String(review.id),
    reviewDate: review.reviewDate,
    starRating: review.starRating,
    status: 'approved',
    treatment: { id: String(treatment.id), name: treatment.name },
    publicMeasure: measure,
    withdrawalState: getReviewWithdrawalState(review),
    ...(review.withdrawnAt ? { withdrawnAt: review.withdrawnAt } : {}),
    ...(isReviewPubliclyVisible(review) && review.publicAuthorName?.trim()
      ? { publicAuthorName: review.publicAuthorName.trim() }
      : {}),
    ...(text?.kind === 'text' ? { [measure === 'redaction' ? 'publicComment' : 'comment']: text.text } : {}),
    ...(text?.notice ? { publicNotice: text.notice } : {}),
  })
}

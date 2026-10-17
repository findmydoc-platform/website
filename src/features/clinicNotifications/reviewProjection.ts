import type { PayloadRequest } from 'payload'
import { readClinicTargetAccess } from '@/auth/utilities/clinicPrincipalAccess'
import { isReviewPubliclyVisible } from '@/collections/reviews/publicProjection'
import type { NotificationMember } from './contracts'

export async function readClinicReviewNotificationProjection(
  req: PayloadRequest,
  member: NotificationMember,
  targetClinicId: string,
): Promise<{ visible: false } | { visible: true; displayName?: string; rating?: number }> {
  if (member.sourceRecord.kind !== 'review' || req.user?.collection !== 'clinicStaff') return { visible: false }
  const access = await readClinicTargetAccess(req.payload, req.user.id, targetClinicId, req)
  if (!access) return { visible: false }
  const result = await req.payload.find({
    collection: 'reviews',
    overrideAccess: true,
    req,
    depth: 0,
    limit: 1,
    pagination: false,
    trash: true,
    where: { id: { equals: member.sourceRecord.id } },
  })
  const source = result.docs[0]
  if (!source) return { visible: true }
  const clinicId = typeof source.clinic === 'object' ? source.clinic.id : source.clinic
  if (String(clinicId) !== String(access.clinic.id)) return { visible: false }
  if (!isReviewPubliclyVisible(source)) return { visible: true }
  return {
    visible: true,
    rating: source.starRating,
    ...(source.publicAuthorName?.trim() ? { displayName: source.publicAuthorName.trim() } : {}),
  }
}

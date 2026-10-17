import { APIError, type PayloadRequest } from 'payload'
import { readClinicPrincipalAccess, readClinicTargetAccess } from '@/auth/utilities/clinicPrincipalAccess'
import { clinicAssignmentRelationId, readClinicStaffAssignment } from '@/auth/utilities/clinicStaffAssignment'
import {
  clinicStaffAuthorizationKey,
  clinicGroupAuthorizationKey,
  notificationClinicAuthorizationKey,
  guardClinicAuthorizationKeys,
  guardNotificationAuthorizationSession,
} from '@/features/clinicNotifications/authorizationBarrier'

const denied = () => new APIError('Clinic review access is unavailable for this operation.', 403)

/** The native Payload operation owns these barriers through its final authorization and commit. */
export async function lockClinicReviewWorkflowAuthorization(
  req: PayloadRequest,
  clinicIds: readonly string[],
): Promise<void> {
  const keys = clinicIds.map(notificationClinicAuthorizationKey)
  if (req.user?.collection !== 'clinicStaff') {
    await guardClinicAuthorizationKeys(req, keys)
    return
  }
  const before = await readClinicPrincipalAccess(req.payload, req.user.id, req)
  const assignment = before && readClinicStaffAssignment(before.staff)
  if (!before || !assignment || clinicIds.some((id) => !before.clinics.some((clinic) => String(clinic.id) === id)))
    throw denied()
  keys.push(clinicStaffAuthorizationKey(req.user.id))
  if (assignment.scope === 'group') keys.push(clinicGroupAuthorizationKey(assignment.groupId))
  await guardClinicAuthorizationKeys(req, keys)
  const current = await readClinicPrincipalAccess(req.payload, req.user.id, req)
  if (
    !current ||
    JSON.stringify(readClinicStaffAssignment(current.staff)) !== JSON.stringify(assignment) ||
    clinicIds.some((id) => !current.clinics.some((clinic) => String(clinic.id) === id))
  )
    throw denied()
  await guardNotificationAuthorizationSession({ req })
}

export async function requireClinicReviewTarget(req: PayloadRequest, clinicId: string | number): Promise<void> {
  if (req.user?.collection !== 'clinicStaff') return
  const target = clinicAssignmentRelationId(clinicId)
  if (
    !target ||
    (req.routeParams &&
      Object.hasOwn(req.routeParams, 'clinicId') &&
      clinicAssignmentRelationId(req.routeParams.clinicId) !== target) ||
    !(await readClinicTargetAccess(req.payload, req.user.id, target, req))
  )
    throw denied()
}

export async function finalizeClinicReviewWorkflowAuthorization(req: PayloadRequest, result: unknown): Promise<void> {
  if (req.user?.collection !== 'clinicStaff') return
  await guardNotificationAuthorizationSession({ req })
  const records =
    result && typeof result === 'object' && 'docs' in result && Array.isArray(result.docs) ? result.docs : [result]
  for (const value of records) {
    if (!value || typeof value !== 'object' || !('clinic' in value) || !('review' in value)) throw denied()
    const clinicId = clinicAssignmentRelationId(value.clinic)
    const reviewId = clinicAssignmentRelationId(value.review)
    if (!clinicId || !reviewId) throw denied()
    const source = await req.payload.findByID({
      collection: 'reviews',
      id: reviewId,
      depth: 0,
      overrideAccess: true,
      req,
      select: { clinic: true, status: true },
    })
    if (clinicAssignmentRelationId(source.clinic) !== clinicId || source.status !== 'approved') throw denied()
    await requireClinicReviewTarget(req, clinicId)
  }
  await guardNotificationAuthorizationSession({ req })
}

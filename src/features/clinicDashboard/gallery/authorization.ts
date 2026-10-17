import { APIError, type PayloadRequest } from 'payload'
import { readClinicTargetAccess } from '@/auth/utilities/clinicPrincipalAccess'
import {
  clinicStaffAuthorizationKey,
  guardClinicAuthorizationKeys,
  notificationClinicAuthorizationKey,
} from '@/features/clinicNotifications/authorizationBarrier'

/** Stored ownership and current personal access share the native writer's transaction. */
export async function authorizeClinicGalleryTarget(req: PayloadRequest, clinicId: string | number, write = false) {
  if (write) {
    await guardClinicAuthorizationKeys(req, [
      notificationClinicAuthorizationKey(clinicId),
      ...(req.user?.collection === 'clinicStaff' ? [clinicStaffAuthorizationKey(req.user.id)] : []),
    ])
  }
  if (req.user?.collection === 'patients') throw new APIError('Gallery access denied.', 403)
  if (req.user?.collection !== 'clinicStaff') return
  if (
    typeof req.context?.clinicGalleryTargetId === 'string' &&
    req.context.clinicGalleryTargetId !== String(clinicId)
  ) {
    throw new APIError('Gallery access denied.', 403)
  }
  if (!(await readClinicTargetAccess(req.payload, req.user.id, clinicId, req))) {
    throw new APIError('Gallery access denied.', 403)
  }
}

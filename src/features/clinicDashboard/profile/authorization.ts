import { APIError, type PayloadRequest } from 'payload'
import { readClinicTargetAccess } from '@/auth/utilities/clinicPrincipalAccess'
import { requireNotificationTransaction } from '@/collections/clinicNotifications/common'
import { relationId } from '@/collections/clinics/profileGallery'
import {
  clinicStaffAuthorizationKey,
  guardClinicAuthorizationKeys,
  notificationClinicAuthorizationKey,
} from '@/features/clinicNotifications/authorizationBarrier'

/** Source ownership and current access remain inside the native writer's transaction. */
export async function authorizeClinicProfileTarget(req: PayloadRequest, clinicId: string | number, write = false) {
  const target = String(clinicId)
  const explicit = req.context?.clinicProfileTargetId ?? req.routeParams?.clinicId
  if (explicit !== undefined && String(explicit) !== target) throw new APIError('Profile access denied.', 403)
  if (write) {
    requireNotificationTransaction(req, await req.transactionID)
    await guardClinicAuthorizationKeys(req, [
      notificationClinicAuthorizationKey(target),
      ...(req.user?.collection === 'clinicStaff' ? [clinicStaffAuthorizationKey(req.user.id)] : []),
    ])
  }
  if (req.user && req.user.collection !== 'clinicStaff' && req.user.collection !== 'platformStaff')
    throw new APIError('Profile access denied.', 403)
  if (req.user?.collection === 'clinicStaff' && !(await readClinicTargetAccess(req.payload, req.user.id, target, req)))
    throw new APIError('Profile access denied.', 403)
}

export async function guardClinicProfileDraftWrite({
  req,
  data,
  originalDoc,
  operation,
}: {
  req: PayloadRequest
  data: Record<string, unknown>
  originalDoc?: { clinic?: unknown }
  operation: 'create' | 'update'
}) {
  const stored = relationId(originalDoc?.clinic)
  const incoming = relationId(data.clinic)
  if (operation === 'update' && (stored === null || (incoming !== null && String(incoming) !== String(stored))))
    throw new APIError('Clinic profile draft ownership cannot be changed.', 403)
  const target = operation === 'update' ? stored : incoming
  if (target === null) throw new APIError('A clinic profile draft owner is required.', 400)
  await authorizeClinicProfileTarget(req, target, true)
  return data
}

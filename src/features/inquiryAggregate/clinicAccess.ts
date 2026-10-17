import type { PayloadRequest } from 'payload'
import { APIError } from 'payload'
import { readClinicAccessState } from '@/auth/utilities/clinicAccessState'
import { readClinicTargetAccess } from '@/auth/utilities/clinicPrincipalAccess'
import {
  clinicStaffAuthorizationKey,
  guardClinicAuthorizationKeys,
  notificationClinicAuthorizationKey,
} from '@/features/clinicNotifications/authorizationBarrier'

/** The source target stays fixed throughout a command and its database-confirmed retries. */
export async function readInquiryClinicAccess(req: PayloadRequest, explicitTarget?: string) {
  if (req.user?.collection !== 'clinicStaff') return null
  let target = explicitTarget ?? req.context?.inquiryClinicTargetId
  if (typeof target !== 'string') {
    const local = await readClinicAccessState(req.payload, req.user.id, req)
    if (!local) return null
    target = String(local.clinic.id)
  }
  const targetId = String(target)
  if (explicitTarget === undefined) req.context = { ...req.context, inquiryClinicTargetId: targetId }
  if (await req.transactionID) {
    await guardClinicAuthorizationKeys(req, [
      clinicStaffAuthorizationKey(req.user.id),
      notificationClinicAuthorizationKey(targetId),
    ])
  }
  return readClinicTargetAccess(req.payload, req.user.id, targetId, req)
}

/** Direct native writes use their stored clinic and the same owned transaction as command writers. */
export async function authorizeStoredInquiryWrite(req: PayloadRequest, clinic: unknown): Promise<void> {
  const target = typeof clinic === 'object' && clinic && 'id' in clinic ? clinic.id : clinic
  if (typeof target !== 'number' && typeof target !== 'string') throw new APIError('Inquiry access denied.', 403)
  if (typeof req.context?.inquiryClinicTargetId === 'string' && req.context.inquiryClinicTargetId !== String(target)) {
    throw new APIError('Inquiry access denied.', 403)
  }
  if (!(await req.transactionID)) throw new APIError('An owned inquiry transaction is required.', 503)
  if (req.user?.collection !== 'clinicStaff') {
    await guardClinicAuthorizationKeys(req, [notificationClinicAuthorizationKey(target)])
    return
  }
  if (!(await readInquiryClinicAccess(req, String(target)))) throw new APIError('Inquiry access denied.', 403)
}

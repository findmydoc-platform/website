import { APIError, type Access, type PayloadRequest } from 'payload'
import { isPlatformStaff } from './isPlatformStaff'
import { readClinicPrincipalAccess, readClinicTargetAccess } from '@/auth/utilities/clinicPrincipalAccess'
import { clinicAssignmentRelationId } from '@/auth/utilities/clinicStaffAssignment'
import { guardNotificationAuthorizationSession } from '@/features/clinicNotifications/authorizationBarrier'

/** Direct Clinic documents use their own ID as the target; future adapters may also carry clinicId in the route. */
export const currentClinicProfileAccess: Access = async ({ req, id }) => {
  if (isPlatformStaff({ req })) return true
  if (req.user?.collection !== 'clinicStaff') return false
  const access = await readClinicPrincipalAccess(req.payload, req.user.id, req)
  let ids = access?.clinics.map(({ id }) => id) ?? []
  if (req.routeParams && Object.hasOwn(req.routeParams, 'clinicId')) {
    const target = clinicAssignmentRelationId(req.routeParams.clinicId)
    ids = ids.filter((id) => id === target)
  }
  if (!ids.length || (id != null && !ids.includes(clinicAssignmentRelationId(id)!))) return false
  return ids.length === 1 ? { id: { equals: ids[0]! } } : { id: { in: ids } }
}

export const currentClinicOrPublicRead: Access = async (args) =>
  args.req.user?.collection === 'clinicStaff' || isPlatformStaff({ req: args.req })
    ? currentClinicProfileAccess(args)
    : { status: { equals: 'approved' } }

/** The native transaction still holds both source-clinic and personal authorization barriers here. */
export async function verifyClinicBusinessWrite({
  req,
  result,
  operation,
}: {
  req: PayloadRequest
  result: unknown
  operation: string
}): Promise<void> {
  if (req.user?.collection !== 'clinicStaff' || !['update', 'delete', 'restoreVersion'].includes(operation)) return
  await guardNotificationAuthorizationSession({ req })
  const records =
    result && typeof result === 'object' && 'docs' in result && Array.isArray(result.docs) ? result.docs : [result]
  for (const record of records) {
    const id = record && typeof record === 'object' && 'id' in record ? clinicAssignmentRelationId(record.id) : null
    const target =
      req.routeParams && Object.hasOwn(req.routeParams, 'clinicId')
        ? clinicAssignmentRelationId(req.routeParams.clinicId)
        : id
    if (!id || target !== id || !(await readClinicTargetAccess(req.payload, req.user.id, id, req)))
      throw new APIError('Clinic access is unavailable for this operation.', 403)
  }
  await guardNotificationAuthorizationSession({ req })
}

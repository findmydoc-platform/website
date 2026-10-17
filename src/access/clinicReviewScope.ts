import type { Access, PayloadRequest, Where } from 'payload'
import { isPlatformStaff } from './isPlatformStaff'
import { readClinicPrincipalAccess } from '@/auth/utilities/clinicPrincipalAccess'
import { clinicAssignmentRelationId } from '@/auth/utilities/clinicStaffAssignment'

/** Review-only conversion. Other domains retain their own conversion gates and authorization rules. */
export async function currentClinicReviewScope(req: PayloadRequest, path = 'clinic'): Promise<Where | false> {
  if (req.user?.collection !== 'clinicStaff') return false
  const principal = await readClinicPrincipalAccess(req.payload, req.user.id, req)
  let ids = principal?.clinics.map(({ id }) => id) ?? []
  if (req.routeParams && Object.hasOwn(req.routeParams, 'clinicId')) {
    const target = clinicAssignmentRelationId(req.routeParams.clinicId)
    ids = ids.filter((id) => id === target)
  }
  if (!ids.length) return false
  return { [path]: ids.length === 1 ? { equals: ids[0]! } : { in: ids } }
}
export const currentClinicReviewResourceAccess: Access = async ({ req }) =>
  isPlatformStaff({ req }) ? true : currentClinicReviewScope(req)
export const currentClinicReviewCreateAccess: Access = async ({ req }) =>
  req.user?.collection === 'clinicStaff' && Boolean(await currentClinicReviewScope(req))

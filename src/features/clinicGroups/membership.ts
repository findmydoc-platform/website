import { APIError, type Endpoint, type PayloadRequest } from 'payload'
import { platformClinicTrustAccess } from '@/access/fieldAccess'
import { clinicAssignmentRelationId } from '@/auth/utilities/clinicStaffAssignment'

export type ClinicGroupChange = { fromGroupId: number; toGroupId: number | null }
type MembershipWrite = ClinicGroupChange & { clinicId: number }
const writes = new WeakMap<object, MembershipWrite>()

export function hasClinicGroupChange(req: PayloadRequest): boolean {
  const capability = req.context.clinicGroupMembershipCapability
  return Boolean(capability && typeof capability === 'object' && writes.has(capability))
}

/** Only this command can authorize a transfer; request flags and raw relationship writes cannot. */
export function requireClinicGroupChange(
  req: PayloadRequest,
  clinicId: number,
  previous: number,
  next: number | null,
): void {
  const capability = req.context.clinicGroupMembershipCapability
  const write = capability && typeof capability === 'object' ? writes.get(capability) : undefined
  if (!write || write.clinicId !== clinicId || write.toGroupId !== next)
    throw new APIError('Use the trusted clinic group transfer or detachment operation.', 409)
  if (write.fromGroupId !== previous)
    throw new APIError('Clinic group membership changed. Reload before trying again.', 409)
}

/** Native Payload owns the clinic barrier, current membership check, relationship write and commit. */
export async function changeClinicGroup(req: PayloadRequest, clinicId: number, change: ClinicGroupChange) {
  if ((await platformClinicTrustAccess({ req })) !== true)
    throw new APIError('Clinic group management requires an authorized platform operator.', 403)
  if (
    !clinicAssignmentRelationId(clinicId) ||
    !change ||
    typeof change !== 'object' ||
    Object.keys(change).length !== 2 ||
    !Object.hasOwn(change, 'fromGroupId') ||
    !Object.hasOwn(change, 'toGroupId') ||
    !clinicAssignmentRelationId(change.fromGroupId) ||
    (change.toGroupId !== null && !clinicAssignmentRelationId(change.toGroupId)) ||
    change.fromGroupId === change.toGroupId
  )
    throw new APIError('Choose the current group and a different destination group or independent status.', 400)
  const previousCapability = req.context.clinicGroupMembershipCapability
  const capability = {}
  writes.set(capability, { clinicId, ...change })
  try {
    return await req.payload.update({
      collection: 'clinics',
      id: clinicId,
      data: { group: change.toGroupId },
      req,
      context: { ...req.context, clinicGroupMembershipCapability: capability },
      overrideAccess: false,
      depth: 0,
    })
  } finally {
    writes.delete(capability)
    if (previousCapability === undefined) delete req.context.clinicGroupMembershipCapability
    else req.context.clinicGroupMembershipCapability = previousCapability
  }
}

export const clinicGroupMembershipEndpoint: Endpoint = {
  path: '/:id/group-membership',
  method: 'post',
  handler: async (req) => {
    const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' }
    try {
      const body: unknown = typeof req.json === 'function' ? await req.json().catch(() => undefined) : undefined
      const clinicId = clinicAssignmentRelationId(req.routeParams?.id)
      if (!clinicId || !body || typeof body !== 'object' || Array.isArray(body))
        throw new APIError('Invalid clinic group change.', 400)
      const clinic = await changeClinicGroup(req, clinicId, body as ClinicGroupChange)
      return Response.json({ id: clinic.id, group: clinic.group ?? null }, { headers })
    } catch (error) {
      // Native Payload merges request-owned headers when serializing the unchanged command error.
      req.responseHeaders ??= new Headers()
      req.responseHeaders.set('Cache-Control', headers['Cache-Control'])
      req.responseHeaders.append('Vary', headers.Vary)
      throw error
    }
  },
}

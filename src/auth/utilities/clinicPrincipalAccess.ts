import type { Clinic, ClinicStaff } from '@/payload-types'
import type { Payload, PayloadRequest, Where } from 'payload'
import { isClinicParticipationApproved } from './clinicParticipation'
import {
  readClinicStaffAssignment,
  clinicAssignmentRelationId,
  isClinicPersonalIdentityReady,
} from './clinicStaffAssignment'
import { readClinicAccessState, type ClinicAccessState } from './clinicAccessState'

export type ClinicPrincipalAccess = { staff: ClinicStaff; clinics: Clinic[] }

/** Request-bound source policy. Identity claims and bootstrap snapshots never supply assignment grants. */
export async function readClinicPrincipalAccess(
  payload: Payload,
  principalId: number | string,
  req?: PayloadRequest,
): Promise<ClinicPrincipalAccess | null> {
  const staff = (
    await payload.find({
      collection: 'clinicStaff',
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
      req,
      where: { id: { equals: principalId } },
    })
  ).docs[0]
  if (!staff) return null
  if (
    req?.user?.collection === 'clinicStaff' &&
    (String(req.user.id) !== String(staff.id) ||
      (req.user.supabaseUserId && req.user.supabaseUserId !== staff.supabaseUserId))
  )
    return null
  if (!isClinicPersonalIdentityReady(staff)) {
    // Preserve the existing verified legacy activation boundary, never a readiness flag or assignment fallback.
    const legacy = await readClinicAccessState(payload, principalId, req)
    return legacy ? { staff: legacy.staff, clinics: [legacy.clinic] } : null
  }
  const assignment = readClinicStaffAssignment(staff)
  if (!assignment || assignment.scope === 'unassigned') return { staff, clinics: [] }
  if (assignment.scope === 'group') {
    const group = await payload.findByID({
      collection: 'clinicGroups',
      id: assignment.groupId,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    })
    if (!group) return { staff, clinics: [] }
  }
  const scope: Where =
    assignment.scope === 'local' ? { id: { equals: assignment.clinicId } } : { group: { equals: assignment.groupId } }
  const clinics: Clinic[] = []
  for (let page = 1; ; page++) {
    const result = await payload.find({
      collection: 'clinics',
      depth: 0,
      limit: 100,
      page,
      sort: ['name', 'id'],
      overrideAccess: true,
      req,
      where: {
        and: [
          scope,
          {
            or: [
              { participationStatus: { equals: 'approved' } },
              { and: [{ participationStatus: { exists: false } }, { status: { equals: 'approved' } }] },
            ],
          },
          { status: { not_equals: 'rejected' } },
          { deletedAt: { exists: false } },
        ],
      },
    })
    clinics.push(
      ...result.docs.filter(
        (clinic) =>
          isClinicParticipationApproved(clinic) &&
          (assignment.scope === 'local'
            ? clinic.id === assignment.clinicId
            : clinicAssignmentRelationId(clinic.group) === assignment.groupId),
      ),
    )
    if (!result.hasNextPage) break
  }
  return { staff, clinics }
}

export async function readClinicTargetAccess(
  payload: Payload,
  principalId: number | string,
  targetClinicId: number | string,
  req?: PayloadRequest,
): Promise<ClinicAccessState | null> {
  const targetId = clinicAssignmentRelationId(targetClinicId)
  if (!targetId) return null
  const access = await readClinicPrincipalAccess(payload, principalId, req)
  const clinic = access?.clinics.find(({ id }) => id === targetId)
  return clinic && access ? { staff: access.staff, clinic } : null
}

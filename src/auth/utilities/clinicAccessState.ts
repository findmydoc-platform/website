import type { Clinic, ClinicStaff } from '@/payload-types'
import type { Payload, PayloadRequest } from 'payload'
import { establishLegacyClinicPasswordEvidence, hasClinicAccountCompletion } from './clinicAccountCompletion'
import { extractTokenFromHeader } from './supabaseAuthPolicy'
import { isClinicParticipationApproved } from './clinicParticipation'

export type ClinicAccessState = {
  clinic: Clinic
  staff: ClinicStaff
}

export const readRelationId = (value: ClinicStaff['clinic']): number | string | null => {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) return value.id
  return null
}

export const isClinicStaffAccessReady = (staff: ClinicStaff): boolean =>
  staff.status === 'approved' &&
  staff.authSync?.status === 'synced' &&
  readRelationId(staff.clinic) !== null &&
  hasClinicAccountCompletion(staff)

export const isClinicAccessReady = isClinicParticipationApproved

export async function readClinicAccessState(
  payload: Payload,
  userId: number | string,
  req?: PayloadRequest,
): Promise<ClinicAccessState | null> {
  const staffResult = await payload.find({
    collection: 'clinicStaff',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: {
      and: [
        { id: { equals: userId } },
        { status: { equals: 'approved' } },
        { 'authSync.status': { equals: 'synced' } },
        { clinic: { exists: true } },
      ],
    },
  })

  let staff = staffResult.docs[0] as ClinicStaff | undefined
  const token = req ? extractTokenFromHeader(req.headers) : undefined
  if (staff && !hasClinicAccountCompletion(staff) && req && token) {
    if (await establishLegacyClinicPasswordEvidence(req, staff, token)) {
      staff = await payload.findByID({ collection: 'clinicStaff', id: staff.id, depth: 0, overrideAccess: true, req })
    }
  }
  const clinicId = staff ? readRelationId(staff.clinic) : null
  if (!staff || !isClinicStaffAccessReady(staff) || clinicId === null) return null

  const clinicResult = await payload.find({
    collection: 'clinics',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: {
      and: [
        { id: { equals: clinicId } },
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

  const clinic = clinicResult.docs[0] as Clinic | undefined
  return clinic && isClinicAccessReady(clinic) ? { clinic, staff } : null
}

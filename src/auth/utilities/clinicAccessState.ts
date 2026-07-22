import type { Clinic, ClinicStaff } from '@/payload-types'
import type { Payload, PayloadRequest } from 'payload'

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
  staff.status === 'approved' && staff.authSync?.status === 'synced' && readRelationId(staff.clinic) !== null

export const isClinicAccessReady = (clinic: Clinic): boolean => clinic.status === 'approved' && !clinic.deletedAt

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

  const staff = staffResult.docs[0] as ClinicStaff | undefined
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
      and: [{ id: { equals: clinicId } }, { status: { equals: 'approved' } }, { deletedAt: { exists: false } }],
    },
  })

  const clinic = clinicResult.docs[0] as Clinic | undefined
  return clinic && isClinicAccessReady(clinic) ? { clinic, staff } : null
}

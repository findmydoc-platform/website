import type { Payload } from 'payload'
import type { BasicUser, ClinicStaff, PlatformStaff } from '@/payload-types'

type PayloadUser = NonNullable<Parameters<Payload['create']>[0]['user']>
type PayloadUpdateArgs = Parameters<Payload['update']>[0]
type TrackedIds = Array<number | string>

// Compatibility names keep existing access suites focused on behavior while
// their principals are now direct ClinicStaff documents.
export function asBasicUserPayload(user: ClinicStaff | PlatformStaff | BasicUser): PayloadUser {
  const collection =
    'role' in user || ('userType' in user && user.userType === 'platform') ? 'platformStaff' : 'clinicStaff'
  return { ...user, collection } as PayloadUser
}

export async function createClinicUserWithStaff(
  payload: Payload,
  options: {
    slugPrefix: string
    suffix: string
    createdBasicUserIds: TrackedIds
    createdClinicStaffIds: TrackedIds
  },
): Promise<{ basicUser: BasicUser; clinicStaff: ClinicStaff }> {
  const { slugPrefix, suffix, createdClinicStaffIds } = options
  const clinicStaff = (await payload.create({
    collection: 'clinicStaff',
    data: {
      email: `${slugPrefix}-clinic-${suffix}@example.com`,
      firstName: 'Clinic',
      lastName: `User-${suffix}`,
      status: 'pending',
      supabaseUserId: `sb-${slugPrefix}-clinic-${suffix}`,
    },
    overrideAccess: true,
    depth: 0,
  })) as ClinicStaff

  createdClinicStaffIds.push(clinicStaff.id)
  return { basicUser: clinicStaff as unknown as BasicUser, clinicStaff }
}

export async function approveClinicStaff(
  payload: Payload,
  clinicStaffId: number,
  clinicId: number,
): Promise<ClinicStaff> {
  return (await payload.update({
    collection: 'clinicStaff',
    id: clinicStaffId,
    data: { clinic: clinicId, status: 'approved' },
    overrideAccess: true,
    depth: 0,
  } as PayloadUpdateArgs)) as ClinicStaff
}

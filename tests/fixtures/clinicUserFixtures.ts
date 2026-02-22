import type { Payload } from 'payload'

import type { BasicUser, ClinicStaff } from '@/payload-types'

type PayloadUser = NonNullable<Parameters<Payload['create']>[0]['user']>
type PayloadCreateArgs = Parameters<Payload['create']>[0]
type PayloadUpdateArgs = Parameters<Payload['update']>[0]

// Shared clinic user + staff helpers for integration tests.
// Use these helpers to avoid duplicating clinic staff provisioning boilerplate.
export function asBasicUserPayload(user: BasicUser): PayloadUser {
  return { ...user, collection: 'basicUsers' } as PayloadUser
}

export async function createClinicUserWithStaff(
  payload: Payload,
  options: {
    slugPrefix: string
    suffix: string
    createdBasicUserIds: number[]
    createdClinicStaffIds: number[]
  },
): Promise<{ basicUser: BasicUser; clinicStaff: ClinicStaff }> {
  const { slugPrefix, suffix, createdBasicUserIds, createdClinicStaffIds } = options

  const basicUser = (await payload.create({
    collection: 'basicUsers',
    data: {
      email: `${slugPrefix}-clinic-${suffix}@example.com`,
      userType: 'clinic',
      firstName: 'Clinic',
      lastName: `User-${suffix}`,
      supabaseUserId: `sb-${slugPrefix}-clinic-${suffix}`,
    },
    overrideAccess: true,
    depth: 0,
  } as PayloadCreateArgs)) as BasicUser

  createdBasicUserIds.push(basicUser.id)

  const clinicStaffResult = await payload.find({
    collection: 'clinicStaff',
    where: { user: { equals: basicUser.id } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })

  const clinicStaff = clinicStaffResult.docs[0] as ClinicStaff | undefined
  if (!clinicStaff) {
    throw new Error('Expected clinic staff profile to be created')
  }

  createdClinicStaffIds.push(clinicStaff.id)

  return { basicUser, clinicStaff }
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

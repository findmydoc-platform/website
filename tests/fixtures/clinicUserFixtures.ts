import type { Payload } from 'payload'
import { randomUUID } from 'node:crypto'
import { asClinicScopedPayloadUser } from './testUsers'
import type { ClinicStaff, PlatformStaff } from '@/payload-types'

type PayloadUser = NonNullable<Parameters<Payload['create']>[0]['user']>
type TrackedIds = Array<number | string>

export function asStaffPayloadUser(user: ClinicStaff | PlatformStaff): PayloadUser {
  const collection = 'role' in user ? 'platformStaff' : 'clinicStaff'
  return { ...user, collection } as PayloadUser
}

export async function createClinicStaffFixture(
  payload: Payload,
  options: {
    slugPrefix: string
    suffix: string
    createdClinicStaffIds: TrackedIds
  },
): Promise<{ staffUser: ClinicStaff; clinicStaff: ClinicStaff }> {
  const { slugPrefix, suffix, createdClinicStaffIds } = options
  const clinicStaff = (await payload.create({
    collection: 'clinicStaff',
    data: {
      email: `${slugPrefix}-clinic-${suffix}@example.com`,
      firstName: 'Clinic',
      lastName: `User-${suffix}`,
      status: 'pending',
      supabaseUserId: randomUUID(),
    },
    overrideAccess: true,
    depth: 0,
  })) as ClinicStaff

  createdClinicStaffIds.push(clinicStaff.id)
  return { staffUser: clinicStaff, clinicStaff }
}

export async function approveClinicStaff(
  payload: Payload,
  clinicStaffId: number,
  clinicId: number,
): Promise<ClinicStaff> {
  const staff = await payload.findByID({ collection: 'clinicStaff', id: clinicStaffId, overrideAccess: true, depth: 0 })
  return (await asClinicScopedPayloadUser(payload, staff, clinicId)) as ClinicStaff
}

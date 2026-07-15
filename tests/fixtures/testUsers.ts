import type { Payload } from 'payload'
import type { ClinicStaff, Patient, PlatformStaff } from '@/payload-types'

export type PayloadRequestUser = NonNullable<Parameters<Payload['create']>[0]['user']>
type TrackedIds = Array<number | string>

interface CreateRoleUserOptions {
  emailPrefix: string
  firstName?: string
  lastName?: string
  supabaseUserId?: string
  createdStaffIds?: TrackedIds
}

interface CreatePatientUserOptions {
  emailPrefix: string
  firstName?: string
  lastName?: string
  supabaseUserId?: string
  createdPatientIds?: TrackedIds
}

interface CleanupTrackedUsersOptions {
  staffIds?: TrackedIds
  patientIds?: TrackedIds
}

const trackId = (trackedIds: TrackedIds | undefined, id: number | string) => {
  if (!trackedIds) return
  trackedIds.push(id)
}

const withCollection = (user: PlatformStaff | ClinicStaff): PayloadRequestUser => {
  const collection = 'role' in user ? 'platformStaff' : 'clinicStaff'
  return { ...user, collection } as unknown as PayloadRequestUser
}

export const asPayloadStaffUser = withCollection

export const asPayloadPatientUser = (user: Patient): PayloadRequestUser =>
  ({ ...user, collection: 'patients' }) as unknown as PayloadRequestUser

export async function asClinicScopedPayloadUser(
  payload: Payload,
  user: ClinicStaff,
  clinicId: number,
): Promise<PayloadRequestUser> {
  const approved = (await payload.update({
    collection: 'clinicStaff',
    id: user.id,
    data: { clinic: clinicId, status: 'approved' },
    overrideAccess: true,
    depth: 0,
  })) as ClinicStaff

  return withCollection(approved)
}

export async function createPlatformTestUser(payload: Payload, options: CreateRoleUserOptions): Promise<PlatformStaff> {
  const user = (await payload.create({
    collection: 'platformStaff',
    data: {
      email: `${options.emailPrefix}@findmydoc.eu`,
      firstName: options.firstName ?? 'Platform',
      lastName: options.lastName ?? 'Tester',
      role: 'support',
      supabaseUserId: options.supabaseUserId ?? `sb-${options.emailPrefix}`,
    },
    context: { trustedPlatformStaffOps: true },
    overrideAccess: true,
    depth: 0,
  })) as PlatformStaff
  trackId(options.createdStaffIds, `platform:${user.id}`)
  return user
}

export async function createClinicTestUser(payload: Payload, options: CreateRoleUserOptions): Promise<ClinicStaff> {
  const user = (await payload.create({
    collection: 'clinicStaff',
    data: {
      email: `${options.emailPrefix}@example.com`,
      firstName: options.firstName ?? 'Clinic',
      lastName: options.lastName ?? 'Tester',
      status: 'pending',
      supabaseUserId: options.supabaseUserId ?? `sb-${options.emailPrefix}`,
    },
    overrideAccess: true,
    depth: 0,
  })) as ClinicStaff
  trackId(options.createdStaffIds, `clinic:${user.id}`)
  return user
}

export async function createPatientTestUser(payload: Payload, options: CreatePatientUserOptions): Promise<Patient> {
  const patient = (await payload.create({
    collection: 'patients',
    data: {
      email: `${options.emailPrefix}@example.com`,
      firstName: options.firstName ?? 'Patient',
      lastName: options.lastName ?? 'Tester',
      supabaseUserId: options.supabaseUserId ?? `sb-${options.emailPrefix}`,
    },
    overrideAccess: true,
    depth: 0,
  })) as Patient

  trackId(options.createdPatientIds, patient.id)
  return patient
}

export async function cleanupTrackedUsers(payload: Payload, options: CleanupTrackedUsersOptions): Promise<void> {
  while (options.patientIds?.length) {
    const id = options.patientIds.pop()
    if (!id) continue
    try {
      await payload.delete({ collection: 'patients', id, overrideAccess: true })
    } catch {}
  }

  while (options.staffIds?.length) {
    const tracked = options.staffIds.pop()
    if (!tracked) continue
    const [collection, id] = String(tracked).split(':')
    if ((collection !== 'platform' && collection !== 'clinic') || !id) continue
    try {
      await payload.delete({
        collection: collection === 'platform' ? 'platformStaff' : 'clinicStaff',
        id,
        overrideAccess: true,
      })
    } catch {}
  }
}

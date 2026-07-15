import type { Payload } from 'payload'
import type { BasicUser, ClinicStaff, Patient, PlatformStaff } from '@/payload-types'

export type PayloadRequestUser = NonNullable<Parameters<Payload['create']>[0]['user']>
type TrackedIds = Array<number | string>

interface CreateBasicUserOptions {
  emailPrefix: string
  userType: 'platform' | 'clinic'
  firstName?: string
  lastName?: string
  supabaseUserId?: string
  createdBasicUserIds?: TrackedIds
}

interface CreateRoleUserOptions {
  emailPrefix: string
  firstName?: string
  lastName?: string
  supabaseUserId?: string
  createdBasicUserIds?: TrackedIds
}

interface CreatePatientUserOptions {
  emailPrefix: string
  firstName?: string
  lastName?: string
  supabaseUserId?: string
  createdPatientIds?: TrackedIds
}

interface CleanupTrackedUsersOptions {
  basicUserIds?: TrackedIds
  patientIds?: TrackedIds
}

const trackId = (trackedIds: TrackedIds | undefined, id: number | string) => {
  if (!trackedIds) return
  trackedIds.push(id)
}

type LegacyStaffUser = BasicUser | PlatformStaff | ClinicStaff

const withCollection = (user: LegacyStaffUser): PayloadRequestUser => {
  const collection =
    'role' in user || ('userType' in user && user.userType === 'platform') ? 'platformStaff' : 'clinicStaff'
  return { ...user, collection } as unknown as PayloadRequestUser
}

// Kept as a compatibility export for existing integration suites. It now always
// returns a direct Staff principal and never creates a BasicUsers document.
export const asPayloadBasicUser = withCollection

export const asPayloadPatientUser = (user: Patient): PayloadRequestUser =>
  ({ ...user, collection: 'patients' }) as unknown as PayloadRequestUser

export async function asClinicScopedPayloadUser(
  payload: Payload,
  user: LegacyStaffUser,
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

export async function createBasicTestUser(payload: Payload, options: CreateBasicUserOptions): Promise<BasicUser> {
  const emailDomain = options.userType === 'platform' ? 'findmydoc.eu' : 'example.com'
  const data = {
    email: `${options.emailPrefix}@${emailDomain}`,
    firstName: options.firstName ?? 'User',
    lastName: options.lastName ?? 'Tester',
    supabaseUserId: options.supabaseUserId ?? `sb-${options.emailPrefix}`,
  }

  if (options.userType === 'platform') {
    const user = (await payload.create({
      collection: 'platformStaff',
      data: { ...data, role: 'support' },
      context: { trustedPlatformStaffOps: true },
      overrideAccess: true,
      depth: 0,
    })) as PlatformStaff
    trackId(options.createdBasicUserIds, `platform:${user.id}`)
    return user as unknown as BasicUser
  }

  const user = (await payload.create({
    collection: 'clinicStaff',
    data: { ...data, status: 'pending' },
    overrideAccess: true,
    depth: 0,
  })) as ClinicStaff
  trackId(options.createdBasicUserIds, `clinic:${user.id}`)
  return user as unknown as BasicUser
}

export async function createPlatformTestUser(payload: Payload, options: CreateRoleUserOptions): Promise<BasicUser> {
  return createBasicTestUser(payload, { ...options, userType: 'platform', firstName: options.firstName ?? 'Platform' })
}

export async function createClinicTestUser(payload: Payload, options: CreateRoleUserOptions): Promise<BasicUser> {
  return createBasicTestUser(payload, { ...options, userType: 'clinic', firstName: options.firstName ?? 'Clinic' })
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

  while (options.basicUserIds?.length) {
    const tracked = options.basicUserIds.pop()
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

import type { Payload } from 'payload'
import type { BasicUser, Patient } from '@/payload-types'

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

export const asPayloadBasicUser = (user: BasicUser): PayloadRequestUser =>
  ({
    ...user,
    collection: 'basicUsers',
  }) as unknown as PayloadRequestUser

export const asPayloadPatientUser = (user: Patient): PayloadRequestUser =>
  ({
    ...user,
    collection: 'patients',
  }) as unknown as PayloadRequestUser

export const asClinicScopedPayloadUser = (user: BasicUser, clinicId: number): PayloadRequestUser =>
  ({
    ...user,
    collection: 'basicUsers',
    clinicId,
  }) as unknown as PayloadRequestUser

export async function createBasicTestUser(payload: Payload, options: CreateBasicUserOptions): Promise<BasicUser> {
  const basicUser = (await payload.create({
    collection: 'basicUsers',
    data: {
      email: `${options.emailPrefix}@example.com`,
      userType: options.userType,
      firstName: options.firstName ?? 'User',
      lastName: options.lastName ?? 'Tester',
      supabaseUserId: options.supabaseUserId ?? `sb-${options.emailPrefix}`,
    },
    overrideAccess: true,
    depth: 0,
  })) as BasicUser

  trackId(options.createdBasicUserIds, basicUser.id)

  return basicUser
}

export function createPlatformTestUser(payload: Payload, options: CreateRoleUserOptions): Promise<BasicUser> {
  return createBasicTestUser(payload, {
    ...options,
    userType: 'platform',
    firstName: options.firstName ?? 'Platform',
  })
}

export function createClinicTestUser(payload: Payload, options: CreateRoleUserOptions): Promise<BasicUser> {
  return createBasicTestUser(payload, {
    ...options,
    userType: 'clinic',
    firstName: options.firstName ?? 'Clinic',
  })
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
    const id = options.basicUserIds.pop()
    if (!id) continue
    try {
      await payload.delete({ collection: 'basicUsers', id, overrideAccess: true })
    } catch {}
  }
}

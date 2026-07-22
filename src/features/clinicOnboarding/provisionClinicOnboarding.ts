import type { Clinic, ClinicStaff } from '@/payload-types'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'
import { inviteClinicSupabaseAccount, setClinicSupabaseAccountAccess } from '@/auth/utilities/supabaseProvision'
import { hashLogValue } from '@/utilities/logging/shared'
import { slugify } from '@/utilities/slugify'
import { randomUUID } from 'node:crypto'
import type { Payload } from 'payload'

export const CLINIC_ONBOARDING_ERROR_CODES = ['record_failed', 'auth_failed', 'binding_failed'] as const

export type ClinicOnboardingErrorCode = (typeof CLINIC_ONBOARDING_ERROR_CODES)[number]

type ClinicContactRole = NonNullable<NonNullable<Clinic['internalPrimaryContact']>['role']>

export type ClinicOnboardingCommand = {
  onboardingKey: string
  clinicName: string
  website: string
  contactFirstName?: string
  contactLastName: string
  contactEmail: string
  contactRole: ClinicContactRole
}

export type ClinicOnboardingResult = {
  clinicId: number | string
  clinicStaffId: number | string
}

export class ClinicOnboardingError extends Error {
  readonly code: ClinicOnboardingErrorCode

  constructor(code: ClinicOnboardingErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ClinicOnboardingError'
    this.code = code
  }
}

export const isClinicOnboardingError = (error: unknown): error is ClinicOnboardingError =>
  error instanceof ClinicOnboardingError

const readRequiredText = (value: string, field: string): string => {
  const normalized = value.trim()
  if (!normalized) {
    throw new ClinicOnboardingError('record_failed', `${field} is required for clinic onboarding`)
  }
  return normalized
}

const createClinic = async (payload: Payload, command: ClinicOnboardingCommand): Promise<Clinic> => {
  try {
    return await payload.create({
      collection: 'clinics',
      context: { disableRevalidate: true },
      data: {
        contact: { website: command.website },
        internalPrimaryContact: {
          firstName: command.contactFirstName,
          lastName: command.contactLastName,
          email: command.contactEmail,
          role: command.contactRole,
        },
        name: command.clinicName,
        onboardingKey: command.onboardingKey,
        slug: `${slugify(command.clinicName) || 'clinic'}-${randomUUID().slice(0, 8)}`,
        status: 'pending',
      },
      depth: 0,
      overrideAccess: true,
    })
  } catch (error) {
    throw new ClinicOnboardingError('record_failed', 'Clinic record could not be created', {
      cause: error,
    })
  }
}

const createClinicStaff = async (
  payload: Payload,
  command: ClinicOnboardingCommand,
  clinic: Clinic,
): Promise<ClinicStaff> => {
  try {
    return await payload.create({
      collection: 'clinicStaff',
      context: { skipClinicStaffAuthSync: true },
      data: {
        authSync: { status: 'pending' },
        clinic: clinic.id,
        email: command.contactEmail,
        firstName: command.contactFirstName,
        lastName: command.contactLastName,
        onboardingKey: command.onboardingKey,
        status: 'pending',
      },
      depth: 0,
      overrideAccess: true,
    })
  } catch (error) {
    throw new ClinicOnboardingError('record_failed', 'Clinic staff record could not be created', {
      cause: error,
    })
  }
}

const logDuplicateOnboardingRecords = async (payload: Payload, onboardingKey: string): Promise<void> => {
  try {
    const [clinics, clinicStaff] = await Promise.all([
      payload.find({
        collection: 'clinics',
        depth: 0,
        limit: 100,
        overrideAccess: true,
        pagination: false,
        trash: true,
        where: { onboardingKey: { equals: onboardingKey } },
      }),
      payload.find({
        collection: 'clinicStaff',
        depth: 0,
        limit: 100,
        overrideAccess: true,
        pagination: false,
        where: { onboardingKey: { equals: onboardingKey } },
      }),
    ])

    if (clinics.docs.length <= 1 && clinicStaff.docs.length <= 1) return

    payload.logger.warn(
      {
        clinicIds: clinics.docs.map(({ id }) => id),
        clinicStaffIds: clinicStaff.docs.map(({ id }) => id),
        event: 'clinic_onboarding.duplicate_records_detected',
        onboardingKeyHash: hashLogValue(onboardingKey),
      },
      'Multiple onboarding records were created for the same source',
    )
  } catch (error) {
    payload.logger.error(
      {
        err: error instanceof Error ? error : new Error(String(error)),
        event: 'clinic_onboarding.duplicate_check_failed',
        onboardingKeyHash: hashLogValue(onboardingKey),
      },
      'Clinic onboarding duplicate check failed',
    )
  }
}

const bindSupabaseIdentity = async (
  payload: Payload,
  command: ClinicOnboardingCommand,
  staff: ClinicStaff,
): Promise<ClinicStaff> => {
  if (staff.supabaseUserId && staff.authSync?.status === 'synced') return staff

  let supabaseUserId = staff.supabaseUserId?.trim()

  try {
    if (supabaseUserId) {
      await setClinicSupabaseAccountAccess({ enabled: true, supabaseUserId }, payload.logger)
    } else {
      supabaseUserId = await inviteClinicSupabaseAccount(
        {
          email: command.contactEmail,
          onboardingKey: command.onboardingKey,
          userMetadata: {
            firstName: command.contactFirstName,
            lastName: command.contactLastName,
          },
        },
        payload.logger,
      )
    }
  } catch (error) {
    throw new ClinicOnboardingError('auth_failed', 'Clinic Supabase account could not be provisioned', {
      cause: error,
    })
  }

  try {
    return await payload.update({
      collection: 'clinicStaff',
      id: staff.id,
      context: { skipClinicStaffAuthSync: true },
      data: {
        authSync: { errorCode: null, status: 'synced' },
        supabaseUserId,
      },
      depth: 0,
      overrideAccess: true,
    })
  } catch (error) {
    throw new ClinicOnboardingError('binding_failed', 'Supabase identity could not be bound to clinic staff', {
      cause: error,
    })
  }
}

export async function provisionClinicOnboarding(
  payload: Payload,
  input: ClinicOnboardingCommand,
): Promise<ClinicOnboardingResult> {
  const command: ClinicOnboardingCommand = {
    ...input,
    onboardingKey: readRequiredText(input.onboardingKey, 'onboardingKey'),
    clinicName: readRequiredText(input.clinicName, 'clinicName'),
    website: readRequiredText(input.website, 'website'),
    contactFirstName: input.contactFirstName?.trim() || undefined,
    contactLastName: readRequiredText(input.contactLastName, 'contactLastName'),
    contactEmail: normalizeEmail(input.contactEmail),
  }

  if (!isValidEmail(command.contactEmail)) {
    throw new ClinicOnboardingError('record_failed', 'contactEmail is invalid for clinic onboarding')
  }

  const clinic = await createClinic(payload, command)
  const staff = await createClinicStaff(payload, command, clinic).finally(() =>
    logDuplicateOnboardingRecords(payload, command.onboardingKey),
  )
  const boundStaff = await bindSupabaseIdentity(payload, command, staff)

  payload.logger.info(
    {
      clinicId: clinic.id,
      clinicStaffId: boundStaff.id,
      event: 'clinic_onboarding.completed',
      onboardingKeyHash: hashLogValue(command.onboardingKey),
    },
    'Clinic onboarding provisioning completed',
  )

  return { clinicId: clinic.id, clinicStaffId: boundStaff.id }
}

import { createHash } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import type { ClinicApplication } from '@/payload-types'
import { ClinicOnboardingError } from './provisionClinicOnboarding'

type OnboardingIdentity = { onboardingKey: string; provisioningIdentity: string }

export function getStagedOnboardingIdentity(applicationId: number): OnboardingIdentity {
  const onboardingKey = `clinic-application:${applicationId}`
  return { onboardingKey, provisioningIdentity: createHash('sha256').update(onboardingKey).digest('hex') }
}

export function getStagedOnboardingApplicationId(onboardingKey?: string | null): number | undefined {
  const applicationId = Number(/^clinic-application:([1-9]\d*)$/u.exec(onboardingKey ?? '')?.[1])
  return Number.isSafeInteger(applicationId) ? applicationId : undefined
}

export function matchesStagedOnboardingIdentity(
  record: { onboardingKey?: string | null; provisioningIdentity?: string | null },
  identity: OnboardingIdentity,
) {
  return (
    record.onboardingKey === identity.onboardingKey && record.provisioningIdentity === identity.provisioningIdentity
  )
}

export function getStagedOnboardingBinding(application: ClinicApplication) {
  const { clinic, clinicStaff } = application.linkedRecords ?? {}
  if (typeof clinic !== 'number' || typeof clinicStaff !== 'number') {
    throw new ClinicOnboardingError('record_failed', 'The clinic onboarding records are incomplete.')
  }
  return { clinicId: clinic, clinicStaffId: clinicStaff, ...getStagedOnboardingIdentity(application.id) }
}

export type StagedOnboardingBinding = ReturnType<typeof getStagedOnboardingBinding>

export async function readBoundStagedClinic(req: PayloadRequest, binding: StagedOnboardingBinding) {
  const clinic = await req.payload.findByID({
    collection: 'clinics',
    id: binding.clinicId,
    depth: 0,
    disableErrors: true,
    overrideAccess: true,
    req,
  })
  if (!clinic || clinic.deletedAt || !matchesStagedOnboardingIdentity(clinic, binding)) {
    throw new ClinicOnboardingError('record_failed', 'The staged clinic binding has changed.')
  }
  return clinic
}

export async function readBoundStagedNewStaff(
  req: PayloadRequest,
  application: ClinicApplication,
  binding: StagedOnboardingBinding,
  status: 'pending' | 'approved',
) {
  const staff = await req.payload.findByID({
    collection: 'clinicStaff',
    id: binding.clinicStaffId,
    depth: 0,
    disableErrors: true,
    overrideAccess: true,
    req,
  })
  if (
    !staff ||
    !matchesStagedOnboardingIdentity(staff, binding) ||
    staff.assignmentScope !== 'local' ||
    staff.clinic !== binding.clinicId ||
    staff.group != null ||
    staff.status !== status ||
    normalizeEmail(staff.email) !== normalizeEmail(application.contactEmail) ||
    (status === 'pending' && (staff.authSync?.status !== 'pending' || staff.supabaseUserId))
  ) {
    throw new ClinicOnboardingError('record_failed', 'The staged first staff binding has changed.')
  }
  return staff
}

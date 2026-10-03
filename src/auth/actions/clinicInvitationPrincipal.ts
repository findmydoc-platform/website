import type { PayloadRequest } from 'payload'
import { z } from 'zod'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import { isClinicParticipationApproved } from '@/auth/utilities/clinicParticipation'
import type { ClinicStaff } from '@/payload-types'

function relationshipId(value: unknown): number | undefined {
  const id = typeof value === 'object' && value !== null ? Reflect.get(value, 'id') : value
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : undefined
}

/** Reads the committed approval source in the caller's owned Auth transaction. Never grants participation. */
export async function findClinicInvitationPrincipal(
  req: PayloadRequest,
  clinicStaffId: number,
): Promise<ClinicStaff | null> {
  const staff = await req.payload.findByID({
    collection: 'clinicStaff',
    id: clinicStaffId,
    req,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  })
  if (
    !staff ||
    staff.status !== 'approved' ||
    staff.authSync?.status !== 'synced' ||
    !z.string().uuid().safeParse(staff.supabaseUserId).success ||
    staff.accountCompletion?.source ||
    staff.legacyAccess?.eligibleAt ||
    staff.invitationAttemptedAt
  )
    return null
  const applicationMatch = /^clinic-application:([1-9]\d*)$/.exec(staff.onboardingKey ?? '')
  const applicationId = applicationMatch ? Number(applicationMatch[1]) : undefined
  const clinicId = relationshipId(staff.clinic)
  if (!applicationId || !Number.isSafeInteger(applicationId) || !clinicId) return null
  const clinic = await req.payload.findByID({
    collection: 'clinics',
    id: clinicId,
    req,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  })
  if (!clinic || !isClinicParticipationApproved(clinic) || clinic.onboardingKey !== staff.onboardingKey) return null
  const application = await req.payload.findByID({
    collection: 'clinicApplications',
    id: applicationId,
    req,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  })
  if (
    !application ||
    application.status !== 'approved' ||
    application.provisioningStatus !== 'completed' ||
    relationshipId(application.linkedRecords?.clinic) !== clinicId ||
    relationshipId(application.linkedRecords?.clinicStaff) !== staff.id ||
    normalizeEmail(application.contactEmail) !== normalizeEmail(staff.email)
  )
    return null
  return staff
}

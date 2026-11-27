import type { PayloadRequest } from 'payload'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import {
  getStagedOnboardingApplicationId,
  getStagedOnboardingIdentity,
  matchesStagedOnboardingIdentity,
} from './stagedBinding'
import { withMcpOnboardingWrite } from './stagedWriteGuards'

export async function releaseAbandonedClinicStaffEmail(req: PayloadRequest, staffId: number): Promise<boolean> {
  const staff = await req.payload.findByID({
    collection: 'clinicStaff',
    id: staffId,
    depth: 0,
    disableErrors: true,
    overrideAccess: true,
    req,
  })
  if (
    !staff?.email ||
    staff.status !== 'pending' ||
    staff.authSync?.status !== 'pending' ||
    staff.authSync.errorCode ||
    staff.supabaseUserId ||
    staff.invitationAuthorizedAt ||
    staff.invitationAttemptedAt ||
    Object.values(staff.activationReadiness ?? {}).some(Boolean) ||
    Object.values(staff.accountCompletion ?? {}).some(Boolean) ||
    Object.values(staff.legacyAccess ?? {}).some(Boolean) ||
    Object.values(staff.personalGroupInvitation ?? {}).some(Boolean)
  ) {
    return false
  }

  const applicationId = getStagedOnboardingApplicationId(staff.onboardingKey)
  if (
    applicationId === undefined ||
    !matchesStagedOnboardingIdentity(staff, getStagedOnboardingIdentity(applicationId))
  ) {
    return false
  }
  const application = await req.payload.findByID({
    collection: 'clinicApplications',
    id: applicationId,
    depth: 0,
    disableErrors: true,
    overrideAccess: true,
    req,
  })
  const linked = application?.linkedRecords
  if (
    !application?.mcpOnboardingRequestKey ||
    application.mcpOnboardingStaffMode !== 'new_account' ||
    application.status !== 'rejected' ||
    (application.provisioningStatus ?? 'not_started') !== 'not_started' ||
    application.provisioningErrorCode ||
    linked?.processedAt ||
    linked?.clinicStaff !== staff.id ||
    typeof linked.clinic !== 'number' ||
    staff.clinic !== linked.clinic ||
    staff.assignmentScope !== 'local' ||
    staff.group != null ||
    normalizeEmail(staff.email) !== normalizeEmail(application.contactEmail)
  ) {
    return false
  }

  const actions = await req.payload.find({
    collection: 'authActions',
    where: {
      and: [{ 'principal.relationTo': { equals: 'clinicStaff' } }, { 'principal.value': { equals: staff.id } }],
    },
    select: {},
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    req,
  })
  if (actions.docs.length) return false

  // The rejected application keeps the original email and the staff link for audit.
  await withMcpOnboardingWrite(req, { staffId }, () =>
    req.payload.update({
      collection: 'clinicStaff',
      id: staffId,
      data: { email: null },
      depth: 0,
      overrideAccess: true,
      req,
    }),
  )
  return true
}

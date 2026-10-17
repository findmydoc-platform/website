import type { ClinicStaff } from '@/payload-types'

/** Current provisional assignment must still match its immutable operator-authorized invitation origin. */
export function hasPersonalGroupInvitationSource(staff: ClinicStaff): boolean {
  const source = staff.personalGroupInvitation
  const groupId = typeof staff.group === 'object' ? staff.group?.id : staff.group
  return Boolean(
    Number.isSafeInteger(groupId) &&
    groupId! > 0 &&
    source?.groupId &&
    source.operatorId &&
    source.authorizedAt &&
    Number.isFinite(Date.parse(source.authorizedAt)) &&
    /^personal-group-invitation:[a-f0-9-]{36}$/.test(staff.onboardingKey ?? '') &&
    staff.assignmentScope === 'group' &&
    staff.clinic == null &&
    String(groupId) === source.groupId,
  )
}

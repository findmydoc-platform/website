import { hasPersonalGroupInvitationSource } from './personalGroupInvitationState'
import type { ClinicStaff } from '@/payload-types'

export function hasClinicAccountCompletion(staff: ClinicStaff): boolean {
  const proof = staff.accountCompletion
  const clinicId = typeof staff.clinic === 'object' ? staff.clinic?.id : staff.clinic
  return Boolean(
    staff.supabaseUserId?.trim() &&
    proof?.source &&
    proof.subject === staff.supabaseUserId &&
    (proof.source === 'group-initial-password'
      ? hasPersonalGroupInvitationSource(staff) &&
        proof.principalId === String(staff.id) &&
        proof.groupId === staff.personalGroupInvitation?.groupId &&
        proof.clinicId == null
      : proof.clinicId === String(clinicId)) &&
    proof.evidenceAt &&
    Number.isFinite(Date.parse(proof.evidenceAt)) &&
    proof.observedAt &&
    Number.isFinite(Date.parse(proof.observedAt)),
  )
}

export function hasClinicActivationReadiness(staff: ClinicStaff): boolean {
  const readiness = staff.activationReadiness
  return Boolean(
    readiness?.version === 'identity-v1' &&
    readiness.principalId === String(staff.id) &&
    staff.supabaseUserId?.trim() &&
    readiness.subject === staff.supabaseUserId &&
    readiness.establishedAt &&
    Number.isFinite(Date.parse(readiness.establishedAt)),
  )
}

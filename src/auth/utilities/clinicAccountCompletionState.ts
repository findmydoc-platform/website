import type { ClinicStaff } from '@/payload-types'

export function hasClinicAccountCompletion(staff: ClinicStaff): boolean {
  const proof = staff.accountCompletion
  const clinicId = typeof staff.clinic === 'object' ? staff.clinic?.id : staff.clinic
  return Boolean(
    staff.supabaseUserId?.trim() &&
    proof?.source &&
    proof.subject === staff.supabaseUserId &&
    proof.clinicId === String(clinicId) &&
    proof.evidenceAt &&
    Number.isFinite(Date.parse(proof.evidenceAt)) &&
    proof.observedAt &&
    Number.isFinite(Date.parse(proof.observedAt)),
  )
}

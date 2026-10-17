import type { ClinicStaff } from '@/payload-types'
import { hasClinicActivationReadiness } from './clinicAccountCompletionState'

export type ClinicStaffAssignment =
  { scope: 'local'; clinicId: number } | { scope: 'group'; groupId: number } | { scope: 'unassigned' }

export const clinicAssignmentRelationId = (value: unknown): number | null => {
  if (value == null) return null
  const raw = typeof value === 'object' && 'id' in value ? value.id : value
  const id = typeof raw === 'number' || typeof raw === 'string' ? Number(raw) : NaN
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export function readClinicStaffAssignment(staff: ClinicStaff): ClinicStaffAssignment | null {
  const clinicId = clinicAssignmentRelationId(staff.clinic)
  const groupId = clinicAssignmentRelationId(staff.group)
  if (staff.assignmentScope === 'local' && clinicId && staff.group == null) return { scope: 'local', clinicId }
  if (staff.assignmentScope === 'group' && groupId && staff.clinic == null) return { scope: 'group', groupId }
  if (staff.assignmentScope === 'unassigned' && staff.clinic == null && staff.group == null)
    return { scope: 'unassigned' }
  return null
}

export const isClinicPersonalIdentityReady = (staff: ClinicStaff): boolean =>
  staff.status === 'approved' && staff.authSync?.status === 'synced' && hasClinicActivationReadiness(staff)

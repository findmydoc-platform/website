import type { CollectionBeforeChangeHook } from 'payload'

import { isClinicBasicUser } from '@/access/isClinicBasicUser'
import { getDoctorClinicId } from '@/access/utils/getDoctorClinic'
import { getUserAssignedClinicId, normalizeClinicId } from '@/access/utils/getClinicAssignment'
import { extractRelationId } from '@/collections/common/mediaPathHelpers'

const DEFAULT_NO_ASSIGNMENT_MESSAGE = 'Clinic staff must be assigned to a clinic before creating or updating records'
const DEFAULT_CLINIC_MISMATCH_MESSAGE = 'Clinic staff cannot assign records to another clinic'
const DEFAULT_DOCTOR_REQUIRED_MESSAGE = 'Doctor is required for this operation'
const DEFAULT_DOCTOR_MISMATCH_MESSAGE = 'Selected doctor does not belong to your assigned clinic'

type RelationInput = string | number | { id?: string | number; value?: string | number } | null | undefined

const getRelationId = (value: unknown): string | null => extractRelationId(value as RelationInput)

const getClinicIdFromValue = (value: unknown): number | null => {
  const relationId = getRelationId(value)
  return normalizeClinicId(relationId ?? value)
}

export function beforeChangeAssignClinicFromUser(options?: {
  clinicField?: string
  noAssignmentMessage?: string
  clinicMismatchMessage?: string
}): CollectionBeforeChangeHook {
  const clinicField = options?.clinicField ?? 'clinic'

  return async ({ data, req }) => {
    const draft = { ...(data || {}) } as Record<string, unknown>

    if (!isClinicBasicUser({ req })) {
      return draft
    }

    const assignedClinicId = await getUserAssignedClinicId(req.user, req.payload)
    if (assignedClinicId === null) {
      throw new Error(options?.noAssignmentMessage ?? DEFAULT_NO_ASSIGNMENT_MESSAGE)
    }

    const incomingClinicId = getClinicIdFromValue(draft[clinicField])
    if (incomingClinicId !== null && incomingClinicId !== assignedClinicId) {
      throw new Error(options?.clinicMismatchMessage ?? DEFAULT_CLINIC_MISMATCH_MESSAGE)
    }

    draft[clinicField] = assignedClinicId

    return draft
  }
}

export function beforeChangeEnforceDoctorInAssignedClinic(options?: {
  doctorField?: string
  noAssignmentMessage?: string
  doctorRequiredMessage?: string
  doctorMismatchMessage?: string
}): CollectionBeforeChangeHook {
  const doctorField = options?.doctorField ?? 'doctor'

  return async ({ data, originalDoc, req }) => {
    const draft = { ...(data || {}) } as Record<string, unknown>

    if (!isClinicBasicUser({ req })) {
      return draft
    }

    const assignedClinicId = await getUserAssignedClinicId(req.user, req.payload)
    if (assignedClinicId === null) {
      throw new Error(options?.noAssignmentMessage ?? DEFAULT_NO_ASSIGNMENT_MESSAGE)
    }

    const doctorId =
      getRelationId(draft[doctorField]) ??
      getRelationId((originalDoc as Record<string, unknown> | undefined)?.[doctorField])
    if (!doctorId) {
      throw new Error(options?.doctorRequiredMessage ?? DEFAULT_DOCTOR_REQUIRED_MESSAGE)
    }

    const doctorClinicId = normalizeClinicId(await getDoctorClinicId(doctorId, req.payload))

    if (doctorClinicId === null || doctorClinicId !== assignedClinicId) {
      throw new Error(options?.doctorMismatchMessage ?? DEFAULT_DOCTOR_MISMATCH_MESSAGE)
    }

    const numericDoctorId = Number(doctorId)
    draft[doctorField] = Number.isFinite(numericDoctorId) ? numericDoctorId : doctorId

    return draft
  }
}

import type { Where } from 'payload'

const normalizeRelationshipId = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()

  if (value && typeof value === 'object') {
    if ('id' in value) return normalizeRelationshipId((value as { id?: unknown }).id)
    if ('value' in value) return normalizeRelationshipId((value as { value?: unknown }).value)
  }

  return null
}

export const DOCTOR_PROFILE_IMAGE_MESSAGES = {
  clinicMissing: 'Doctor clinic is required before assigning a profile image.',
  doctorMissing: 'Save the doctor before assigning a profile image.',
  unavailable: 'Selected profile image is unavailable.',
  wrongClinic: "Selected profile image does not belong to this doctor's clinic.",
  wrongDoctor: 'Selected profile image does not belong to this doctor.',
} as const

export const buildDoctorProfileImageFilter = ({
  clinicId,
  doctorId,
}: {
  clinicId: unknown
  doctorId: unknown
}): Where | false => {
  const normalizedClinicId = normalizeRelationshipId(clinicId)
  const normalizedDoctorId = normalizeRelationshipId(doctorId)
  if (!normalizedClinicId || !normalizedDoctorId) return false

  return {
    and: [{ doctor: { equals: normalizedDoctorId } }, { clinic: { equals: normalizedClinicId } }],
  }
}

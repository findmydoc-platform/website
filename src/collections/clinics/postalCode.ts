import type { TextFieldValidation } from 'payload'

export const CLINIC_POSTAL_CODE_MAX_LENGTH = 32

const POSTAL_CODE_PATTERN = /^[\p{L}\p{N} -]+$/u

export const normalizeClinicPostalCode = (value: unknown): unknown => (typeof value === 'string' ? value.trim() : value)

export const validateClinicPostalCode: TextFieldValidation = (value) => {
  if (value === null || value === undefined || value === '') return true
  if (typeof value !== 'string') return 'Postal code must be entered as text.'
  if (value.length > CLINIC_POSTAL_CODE_MAX_LENGTH) {
    return `Postal code must be at most ${CLINIC_POSTAL_CODE_MAX_LENGTH} characters.`
  }

  return POSTAL_CODE_PATTERN.test(value) ? true : 'Postal code may only contain letters, numbers, spaces, and hyphens.'
}

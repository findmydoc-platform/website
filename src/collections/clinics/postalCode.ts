import type { TextFieldValidation } from 'payload'

export const CLINIC_POSTAL_CODE_MAX_LENGTH = 32

const POSTAL_CODE_PATTERN = /^[\p{L}\p{N} -]+$/u
const POSTAL_CODE_CONTENT_PATTERN = /[\p{L}\p{N}]/u

export const normalizeClinicPostalCode = (value: unknown): unknown => (typeof value === 'string' ? value.trim() : value)

export const validateClinicPostalCode: TextFieldValidation = (value) => {
  if (value === null || value === undefined || value === '') return true
  if (typeof value !== 'string') return 'Postal code must be entered as text.'
  if (value.length > CLINIC_POSTAL_CODE_MAX_LENGTH) {
    return `Postal code must be at most ${CLINIC_POSTAL_CODE_MAX_LENGTH} characters.`
  }

  if (!POSTAL_CODE_PATTERN.test(value)) {
    return 'Postal code may only contain letters, numbers, spaces, and hyphens.'
  }

  return POSTAL_CODE_CONTENT_PATTERN.test(value) ? true : 'Postal code must include at least one letter or number.'
}

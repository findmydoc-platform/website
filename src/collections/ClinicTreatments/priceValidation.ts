import type { NumberFieldValidation } from 'payload'

const CENTS_PER_EURO = 100
const FLOATING_POINT_TOLERANCE = 1e-8

export const normalizeClinicTreatmentPrice = (value: unknown): unknown => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return value

  const cents = value * CENTS_PER_EURO
  const roundedCents = Math.round(cents)

  return Math.abs(cents - roundedCents) <= FLOATING_POINT_TOLERANCE ? roundedCents / CENTS_PER_EURO : value
}

export const validateClinicTreatmentPrice: NumberFieldValidation = (value) => {
  if (value === null || value === undefined) return true
  if (typeof value !== 'number') return 'Price must be a single EUR amount.'
  if (!Number.isFinite(value)) return 'Price must be a finite EUR amount.'
  if (value < 0) return 'Price must be zero or greater.'

  const cents = value * CENTS_PER_EURO
  return Math.abs(cents - Math.round(cents)) <= FLOATING_POINT_TOLERANCE
    ? true
    : 'Price must have at most two decimal places.'
}

import type { Clinic } from '@/payload-types'
import {
  getMissingConditionalRequirements,
  type ConditionalRequirement,
  type ConditionalRequirementSet,
} from '@/collections/common/conditionalRequirements'

export const CLINIC_APPROVAL_MARKER = 'Required for approval'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))

const isNonEmptyString = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0

const isFiniteNumber = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value)

const hasRelation = (value: unknown): boolean => {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.trim().length > 0
  return Boolean(value && typeof value === 'object' && 'id' in value)
}

const hasSelection = (value: unknown): boolean => Array.isArray(value) && value.length > 0

const createRequirement = (
  path: string,
  label: string,
  message: string,
  valueIsPresent: (value: unknown) => boolean,
): ConditionalRequirement => ({
  label,
  marker: CLINIC_APPROVAL_MARKER,
  message,
  path,
  valueIsPresent,
})

export const clinicApprovalRequirements = {
  country: createRequirement(
    'address.country',
    'Country',
    'Country is required before this clinic can be approved.',
    isNonEmptyString,
  ),
  street: createRequirement(
    'address.street',
    'Street',
    'Street is required before this clinic can be approved.',
    isNonEmptyString,
  ),
  houseNumber: createRequirement(
    'address.houseNumber',
    'House Number',
    'House number is required before this clinic can be approved.',
    isNonEmptyString,
  ),
  zipCode: createRequirement(
    'address.zipCode',
    'Zip Code',
    'Zip code is required before this clinic can be approved.',
    isFiniteNumber,
  ),
  city: createRequirement('address.city', 'City', 'City is required before this clinic can be approved.', hasRelation),
  contactFirstName: createRequirement(
    'internalPrimaryContact.firstName',
    'First Name',
    'Primary contact first name is required before this clinic can be approved.',
    isNonEmptyString,
  ),
  contactLastName: createRequirement(
    'internalPrimaryContact.lastName',
    'Last Name',
    'Primary contact last name is required before this clinic can be approved.',
    isNonEmptyString,
  ),
  contactEmail: createRequirement(
    'internalPrimaryContact.email',
    'Email',
    'Primary contact email is required before this clinic can be approved.',
    isNonEmptyString,
  ),
  contactRole: createRequirement(
    'internalPrimaryContact.role',
    'Role',
    'Primary contact role is required before this clinic can be approved.',
    isNonEmptyString,
  ),
  supportedLanguages: createRequirement(
    'supportedLanguages',
    'Supported Languages',
    'At least one supported language is required before this clinic can be approved.',
    hasSelection,
  ),
} as const

export const clinicApprovalRequirementSet = {
  collection: 'clinics',
  isRequired: ({ data }) => isRecord(data) && data.status === 'approved',
  requirements: Object.values(clinicApprovalRequirements),
} as const satisfies ConditionalRequirementSet

const hasOwn = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key)

const mergeGroup = (
  originalValue: unknown,
  incomingValue: unknown,
  hasIncomingValue: boolean,
): Record<string, unknown> => {
  const original = isRecord(originalValue) ? originalValue : {}
  if (!hasIncomingValue) return { ...original }
  if (!isRecord(incomingValue)) return {}
  return { ...original, ...incomingValue }
}

export const resolveClinicApprovalData = (data: Partial<Clinic>, originalDoc?: Clinic): Record<string, unknown> => {
  const incoming = data as Record<string, unknown>
  const original = (originalDoc ?? {}) as Record<string, unknown>

  return {
    ...original,
    ...incoming,
    address: mergeGroup(original.address, incoming.address, hasOwn(incoming, 'address')),
    internalPrimaryContact: mergeGroup(
      original.internalPrimaryContact,
      incoming.internalPrimaryContact,
      hasOwn(incoming, 'internalPrimaryContact'),
    ),
  }
}

export const getMissingClinicApprovalRequirements = (data: Partial<Clinic>, originalDoc?: Clinic) =>
  getMissingConditionalRequirements(clinicApprovalRequirementSet, {
    data: resolveClinicApprovalData(data, originalDoc),
    operation: originalDoc ? 'update' : 'create',
  })

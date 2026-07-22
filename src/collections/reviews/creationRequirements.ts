import {
  getMissingConditionalRequirements,
  type ConditionalRequirement,
  type ConditionalRequirementSet,
} from '@/collections/common/conditionalRequirements'

export const REVIEW_CREATE_MARKER = 'Required when creating a review'

const hasRelation = (value: unknown): boolean => {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.trim().length > 0
  return Boolean(value && typeof value === 'object' && ('id' in value || 'value' in value))
}

export const reviewCreationRequirements = {
  patient: {
    label: 'Patient',
    marker: REVIEW_CREATE_MARKER,
    message: 'Patient is required when creating a review.',
    path: 'patient',
    valueIsPresent: hasRelation,
  } satisfies ConditionalRequirement,
} as const

export const reviewCreationRequirementSet = {
  collection: 'reviews',
  isRequired: ({ operation }) => operation === 'create',
  requirements: Object.values(reviewCreationRequirements),
} as const satisfies ConditionalRequirementSet

export const getMissingReviewCreationRequirements = (data: unknown, operation: 'create' | 'update') =>
  getMissingConditionalRequirements(reviewCreationRequirementSet, { data, operation })

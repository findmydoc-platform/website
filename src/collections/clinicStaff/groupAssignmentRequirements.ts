import type { ConditionalRequirementSet } from '../common/conditionalRequirements'

export const groupAssignmentRequirement = {
  label: 'Group',
  marker: 'Required for group scope',
  message: 'Group is required for group scope.',
  path: 'group',
  valueIsPresent: (value: unknown) => value !== null && value !== undefined && value !== '',
} as const

export const groupAssignmentRequirementSet = {
  collection: 'clinicStaff',
  isRequired: ({ data }) =>
    Boolean(data && typeof data === 'object' && 'assignmentScope' in data && data.assignmentScope === 'group'),
  requirements: [groupAssignmentRequirement],
} satisfies ConditionalRequirementSet

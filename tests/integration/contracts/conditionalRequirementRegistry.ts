import type { CollectionConfig } from 'payload'

import { Clinics } from '@/collections/Clinics'
import { clinicApprovalRequirementSet } from '@/collections/clinics/approvalRequirements'
import { Reviews } from '@/collections/Reviews'
import { reviewCreationRequirementSet } from '@/collections/reviews/creationRequirements'
import type { ConditionalRequirementSet } from '@/collections/common/conditionalRequirements'

type BeforeChangeHook = NonNullable<NonNullable<CollectionConfig['hooks']>['beforeChange']>[number]

export type ConditionalRequirementContract = Readonly<{
  collection: CollectionConfig
  finalValidationHook: BeforeChangeHook | undefined
  requirementSet: ConditionalRequirementSet
}>

export const conditionalRequirementRegistry = {
  clinics: {
    collection: Clinics,
    finalValidationHook: Clinics.hooks?.beforeChange?.at(-1),
    requirementSet: clinicApprovalRequirementSet,
  },
  reviews: {
    collection: Reviews,
    finalValidationHook: Reviews.hooks?.beforeChange?.at(-1),
    requirementSet: reviewCreationRequirementSet,
  },
} as const satisfies Record<string, ConditionalRequirementContract>

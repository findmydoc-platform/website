import type { AdminJourneyDefinition } from '../types'
import { defineJourneySteps } from '../fragments'
import {
  createAssertReviewPatientValidationStep,
  createEnsureReviewContextStep,
  createFillReviewWithoutPatientStep,
  createOpenCreatePageStep,
} from '../steps'

type RecordId = number | string

type ReviewPatientValidationJourneyState = {
  clinicId?: RecordId
  clinicName: string
  doctorId?: RecordId
  doctorName: string
  treatmentId?: RecordId
  treatmentName: string
}

export const reviewPatientValidationJourney: AdminJourneyDefinition<ReviewPatientValidationJourneyState> = {
  createState: () => ({
    clinicId: undefined,
    clinicName: '',
    doctorId: undefined,
    doctorName: '',
    treatmentId: undefined,
    treatmentName: '',
  }),
  description: 'Validate the patient requirement while platform staff creates a review.',
  journeyId: 'admin.reviews.validate-patient',
  metadata: {
    collections: ['clinics', 'doctors', 'reviews', 'treatments'],
    consumers: ['regression', 'capture'],
    entrypoints: ['collection-create'],
    riskTags: ['review-create', 'conditional-validation'],
  },
  persona: 'admin',
  steps: defineJourneySteps<ReviewPatientValidationJourneyState>([
    createEnsureReviewContextStep({ stepId: 'ensure-review-context' }),
    createOpenCreatePageStep({
      collectionSlug: 'reviews',
      label: 'Open the review create page',
      stepId: 'open-review-create',
    }),
    createFillReviewWithoutPatientStep({
      stepId: 'fill-review-without-patient',
      checkpoint: {
        label: 'Review form without a patient',
        screenshotSlug: 'review-create-without-patient',
      },
    }),
    createAssertReviewPatientValidationStep({
      stepId: 'assert-patient-validation',
      checkpoint: {
        label: 'Review patient inline validation',
        screenshotSlug: 'review-patient-inline-validation',
      },
    }),
  ]),
}

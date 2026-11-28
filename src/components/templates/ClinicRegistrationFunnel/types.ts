import type * as React from 'react'

import type {
  ClinicRegistrationFailure,
  ClinicRegistrationFormValues,
  ClinicRegistrationSubmitData,
} from '@/features/clinicRegistration/publicSubmission'
import type { ClinicApplicationCopy } from '@/features/uiCopy/clinicApplication'
import type { UiCopyLocale } from '@/i18n/requestLocale'

import type { usePublicFormValidation } from '@/components/molecules/PublicFormValidation/usePublicFormValidation'
import type { MedicalSpecialtyIconKey } from '@/utilities/medicalSpecialties/iconKeys'

export type {
  ClinicRegistrationFormValues,
  ClinicRegistrationSubmitData,
} from '@/features/clinicRegistration/publicSubmission'

export type ClinicRegistrationStep = 1 | 2 | 3 | 4
export type ClinicRegistrationFunnelVariant = 'default' | 'landing'
export type StepTransitionDirection = 'backward' | 'forward' | 'none'
export type IconComponent = React.ElementType<React.SVGProps<SVGSVGElement>>
export type PublicFormValidationController = ReturnType<typeof usePublicFormValidation>

export type ClinicRegistrationFunnelProps = {
  className?: string
  copy: ClinicApplicationCopy
  locale: UiCopyLocale
  initialSelectedTreatmentCategoryIds?: string[]
  initialStep?: ClinicRegistrationStep
  initialValues?: Partial<ClinicRegistrationFormValues>
  onSubmit: (data: ClinicRegistrationSubmitData) => Promise<ClinicRegistrationFailure | void>
  reviewSummary?: ClinicRegistrationReviewSummary
  treatmentCategories?: ClinicRegistrationTreatmentCategory[]
  variant?: ClinicRegistrationFunnelVariant
}

export type ClinicRegistrationReviewSummary = {
  clinicAddress: string
  clinicWebsite?: string
  clinicName: string
  contactEmail: string
  contactName: string
  contactRole: string
}

export type ClinicRegistrationTreatmentCategory = {
  iconKey: MedicalSpecialtyIconKey
  id: string
  label: string
}

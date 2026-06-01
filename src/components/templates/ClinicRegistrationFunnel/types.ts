import type * as React from 'react'

import type { usePublicFormValidation } from '@/components/molecules/PublicFormValidation/usePublicFormValidation'

export type ClinicRegistrationStep = 1 | 2 | 3 | 4
export type ClinicRegistrationFunnelVariant = 'default' | 'landing'
export type StepTransitionDirection = 'backward' | 'forward' | 'none'
export type IconComponent = React.ElementType<React.SVGProps<SVGSVGElement>>
export type PublicFormValidationController = ReturnType<typeof usePublicFormValidation>

export type ClinicRegistrationFunnelProps = {
  className?: string
  initialSelectedTreatmentCategoryIds?: string[]
  initialStep?: ClinicRegistrationStep
  initialValues?: Partial<ClinicRegistrationFormValues>
  onSubmit?: (data: ClinicRegistrationSubmitData) => Promise<void>
  reviewSummary?: ClinicRegistrationReviewSummary
  treatmentCategories?: ClinicRegistrationTreatmentCategory[]
  variant?: ClinicRegistrationFunnelVariant
}

export type ClinicRegistrationFormValues = {
  clinicName: string
  clinicWebsite: string
  contactEmail: string
  contactName: string
  contactRole: string
}

export type ClinicRegistrationReviewSummary = {
  clinicAddress: string
  clinicWebsite?: string
  clinicName: string
  contactEmail: string
  contactName: string
  contactRole: string
}

export type ClinicRegistrationSubmitData = ClinicRegistrationFormValues & {
  medicalSpecialties: string[]
}

export type ClinicRegistrationCategoryIconKey =
  | 'dental'
  | 'dermatology'
  | 'eye-care'
  | 'hair-restoration'
  | 'plastic-surgery'

export type ClinicRegistrationTreatmentCategory = {
  iconKey: ClinicRegistrationCategoryIconKey
  id: string
  label: string
}

export type ResolvedTreatmentCategory = ClinicRegistrationTreatmentCategory & {
  icon: IconComponent
}

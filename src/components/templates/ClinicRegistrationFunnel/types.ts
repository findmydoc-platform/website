import type * as React from 'react'

import type { usePublicFormValidation } from '@/components/molecules/PublicFormValidation/usePublicFormValidation'
import type { MedicalSpecialtyIconKey } from '@/utilities/medicalSpecialties/iconKeys'

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
  contactFirstName: string
  contactLastName: string
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

export type ClinicRegistrationTreatmentCategory = {
  iconKey: MedicalSpecialtyIconKey
  id: string
  label: string
}

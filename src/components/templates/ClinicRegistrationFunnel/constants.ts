import type {
  ClinicRegistrationFormValues,
  ClinicRegistrationReviewSummary,
  ClinicRegistrationTreatmentCategory,
} from './types'

export const defaultTreatmentCategories: ClinicRegistrationTreatmentCategory[] = [
  { id: 'dental', label: 'Dental', iconKey: 'dental' },
  { id: 'eye-care', label: 'Eye Care', iconKey: 'eye-care' },
  { id: 'hair-restoration', label: 'Hair Restoration', iconKey: 'hair-restoration' },
  { id: 'dermatology', label: 'Dermatology', iconKey: 'dermatology' },
  { id: 'plastic-surgery', label: 'Plastic Surgery', iconKey: 'plastic-surgery' },
]

export const defaultSelectedTreatmentCategoryIds = ['dental']

export const defaultReviewSummary: ClinicRegistrationReviewSummary = {
  clinicAddress: 'Main Street 124, 10115 Berlin',
  clinicWebsite: 'https://marien-hospital.example',
  clinicName: 'St. Marien Hospital',
  contactEmail: 'm.musterfrau@marien-hospital.example',
  contactName: 'Dr. Martina Musterfrau',
  contactRole: 'Medical Director',
}

export const defaultFormValues: ClinicRegistrationFormValues = {
  clinicName: '',
  clinicWebsite: '',
  contactEmail: '',
  contactFirstName: '',
  contactLastName: '',
  contactRole: '',
}

export const formContentClassName = 'mx-auto mt-8 w-full max-w-[490px] min-w-0 text-left sm:mt-10 lg:mt-13'

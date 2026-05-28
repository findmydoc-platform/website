import type {
  ClinicRegistrationFormValues,
  ClinicRegistrationReviewSummary,
  ClinicRegistrationStep,
  ClinicRegistrationTreatmentCategory,
} from './types'

export const totalSteps = 4

export const defaultTreatmentCategories: ClinicRegistrationTreatmentCategory[] = [
  { id: 'dental', label: 'Dental', iconKey: 'dental' },
  { id: 'eye-care', label: 'Eye Care', iconKey: 'eye-care' },
  { id: 'hair-restoration', label: 'Hair Restoration', iconKey: 'hair-restoration' },
  { id: 'dermatology', label: 'Dermatology', iconKey: 'dermatology' },
  { id: 'plastic-surgery', label: 'Plastic Surgery', iconKey: 'plastic-surgery' },
]

export const stepStatusLabels: Record<ClinicRegistrationStep, string> = {
  1: 'Initialisierung',
  2: '50% abgeschlossen',
  3: '75% abgeschlossen',
  4: 'Anfrage übermittelt',
}

export const defaultSelectedTreatmentCategoryIds = ['dental']

export const defaultReviewSummary: ClinicRegistrationReviewSummary = {
  clinicAddress: 'Hauptstraße 124, 10115 Berlin',
  clinicWebsite: 'https://marien-hospital.de',
  clinicName: 'St. Marien Hospital',
  contactEmail: 'm.musterfrau@marien-hospital.de',
  contactName: 'Dr. Martina Musterfrau',
  contactRole: 'Leitende Oberärztin',
}

export const defaultFormValues: ClinicRegistrationFormValues = {
  clinicName: '',
  clinicWebsite: '',
  contactEmail: '',
  contactName: '',
  contactRole: '',
}

export const contactRoleOptions = [
  { label: 'Ärztliche Leitung', value: 'Ärztliche Leitung' },
  { label: 'Klinikmanagement', value: 'Klinikmanagement' },
  { label: 'International Office', value: 'International Office' },
]

export const formContentClassName = 'mx-auto mt-12 w-full max-w-[490px] min-w-0 text-left lg:mt-13'

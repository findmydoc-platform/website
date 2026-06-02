export const fallbackMedicalSpecialtyIconKey = 'fallback'

export const medicalSpecialtyIconOptions = [
  { label: 'Fallback', value: fallbackMedicalSpecialtyIconKey },
  { label: 'Dental', value: 'dental' },
  { label: 'Eye Care', value: 'eye-care' },
  { label: 'Hair Restoration', value: 'hair-restoration' },
  { label: 'Dermatology', value: 'dermatology' },
  { label: 'Plastic Surgery', value: 'plastic-surgery' },
] as const

export type MedicalSpecialtyIconKey = (typeof medicalSpecialtyIconOptions)[number]['value']

const medicalSpecialtyIconValues = new Set<string>(medicalSpecialtyIconOptions.map((option) => option.value))

export function resolveMedicalSpecialtyIconKey(value: unknown): MedicalSpecialtyIconKey {
  if (typeof value === 'string' && medicalSpecialtyIconValues.has(value)) {
    return value as MedicalSpecialtyIconKey
  }

  return fallbackMedicalSpecialtyIconKey
}

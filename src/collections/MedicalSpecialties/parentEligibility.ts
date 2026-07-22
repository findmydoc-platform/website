import type { Where } from 'payload'

export const MEDICAL_SPECIALTY_PARENT_MESSAGES = {
  nested: 'Only two hierarchy levels are allowed for medical specialties. Create level 3 entries as treatments.',
  self: 'A medical specialty cannot be its own parent.',
} as const

export const buildMedicalSpecialtyParentFilter = (currentId: number | string | undefined): Where => {
  const topLevelFilter: Where = { parentSpecialty: { exists: false } }
  if (currentId === undefined) return topLevelFilter

  return {
    and: [topLevelFilter, { id: { not_equals: currentId } }],
  }
}

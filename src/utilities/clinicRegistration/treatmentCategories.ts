import type { Payload } from 'payload'

import type {
  ClinicRegistrationCategoryIconKey,
  ClinicRegistrationTreatmentCategory,
} from '@/components/templates/ClinicRegistrationFunnel'

type MedicalSpecialtyRecord = {
  id: number
  name: string
  parentSpecialty?: unknown
}

const categoryOrder = ['Dental', 'Eye Care', 'Hair Restoration', 'Dermatology', 'Plastic Surgery']

const iconKeyBySpecialtyName: Record<string, ClinicRegistrationCategoryIconKey> = {
  Dental: 'dental',
  Dermatology: 'dermatology',
  'Eye Care': 'eye-care',
  'Hair Restoration': 'hair-restoration',
  'Plastic Surgery': 'plastic-surgery',
}

function extractRelationId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  if (value && typeof value === 'object' && 'id' in value) {
    return extractRelationId((value as { id?: unknown }).id)
  }

  return null
}

function compareClinicRegistrationCategoryOrder(left: MedicalSpecialtyRecord, right: MedicalSpecialtyRecord): number {
  const leftIndex = categoryOrder.indexOf(left.name)
  const rightIndex = categoryOrder.indexOf(right.name)

  if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex
  if (leftIndex >= 0) return -1
  if (rightIndex >= 0) return 1

  return left.name.localeCompare(right.name, 'en', { sensitivity: 'base' })
}

export async function getClinicRegistrationTreatmentCategories(
  payload: Payload,
): Promise<ClinicRegistrationTreatmentCategory[]> {
  const specialtiesResult = await payload.find({
    collection: 'medical-specialties',
    depth: 0,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: {
      id: true,
      name: true,
      parentSpecialty: true,
    },
  })

  return (specialtiesResult.docs as MedicalSpecialtyRecord[])
    .filter((specialty) => extractRelationId(specialty.parentSpecialty) === null)
    .sort(compareClinicRegistrationCategoryOrder)
    .map((specialty) => ({
      id: String(specialty.id),
      label: specialty.name,
      iconKey: iconKeyBySpecialtyName[specialty.name] ?? 'dermatology',
    }))
}

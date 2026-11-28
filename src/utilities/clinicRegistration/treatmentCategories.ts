import type { Payload } from 'payload'

import type { ClinicRegistrationTreatmentCategory } from '@/components/templates/ClinicRegistrationFunnel'
import { getTaxonomyDisplayName } from '@/features/listingComparison/taxonomy'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import { resolveMedicalSpecialtyIconKey } from '@/utilities/medicalSpecialties/iconKeys'

type MedicalSpecialtyRecord = {
  id: number
  displayName?: unknown
  iconKey?: unknown
  name: string
  parentSpecialty?: unknown
}

const categoryOrder = ['Dental', 'Eye Care', 'Hair Restoration', 'Dermatology', 'Plastic Surgery']

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
  locale: UiCopyLocale,
): Promise<ClinicRegistrationTreatmentCategory[]> {
  const specialtiesResult = await payload.find({
    collection: 'medical-specialties',
    depth: 0,
    locale,
    fallbackLocale: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: {
      displayName: true,
      iconKey: true,
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
      label: getTaxonomyDisplayName(specialty, locale),
      iconKey: resolveMedicalSpecialtyIconKey(specialty.iconKey),
    }))
}

import type { Payload } from 'payload'

import { resolveMediaDescriptorFromLoadedRelation } from '@/utilities/media/relationMedia'

const LANDING_SPECIALTY_PLACEHOLDER_SRC = '/images/placeholder-576-968.svg'
const LANDING_SPECIALTY_PLACEHOLDER_ALT = 'Medical specialty placeholder image'

const EXCLUDED_LEVEL3_NAMES = new Set([
  'all-on-4',
  'all-on-6',
  'all-on-4 / all-on-6',
  'all-on-4/all-on-6',
  'eyebrow transplant',
  'beard transplant',
  'eyelid surgery',
  'cataract surgery',
  'hollywood smile',
])

type MedicalSpecialtyRecord = {
  id: number
  name: string
  description?: string | null
  featureImage?: unknown
  parentSpecialty?: unknown
}

export type LandingMedicalSpecialtyCategory = {
  label: string
  value: string
}

export type LandingMedicalSpecialtyItem = {
  id: string
  title: string
  subtitle?: string | null
  categories: string[]
  href: string
  image: {
    src: string
    alt: string
  }
}

export type LandingMedicalSpecialtyCategoriesData = {
  categories: LandingMedicalSpecialtyCategory[]
  items: LandingMedicalSpecialtyItem[]
  featuredIds: string[]
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

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('en-US')
}

function isExcludedLevel3Name(name: string): boolean {
  return EXCLUDED_LEVEL3_NAMES.has(normalizeName(name))
}

function byName<T extends { name: string }>(left: T, right: T): number {
  return left.name.localeCompare(right.name, 'en', { sensitivity: 'base' })
}

function buildRoundRobinFeaturedIds(
  items: LandingMedicalSpecialtyItem[],
  categories: LandingMedicalSpecialtyCategory[],
  limit: number,
): string[] {
  if (limit <= 0 || items.length === 0) return []

  const queues = new Map<string, LandingMedicalSpecialtyItem[]>()
  for (const category of categories) {
    queues.set(category.value, [])
  }

  for (const item of items) {
    for (const categoryId of item.categories) {
      const queue = queues.get(categoryId)
      if (queue) {
        queue.push(item)
      }
    }
  }

  const featuredIds: string[] = []
  while (featuredIds.length < limit) {
    let addedInPass = false

    for (const category of categories) {
      const queue = queues.get(category.value)
      const next = queue?.shift()
      if (!next) continue

      featuredIds.push(next.id)
      addedInPass = true

      if (featuredIds.length >= limit) {
        break
      }
    }

    if (!addedInPass) {
      break
    }
  }

  return featuredIds
}

export function mapMedicalSpecialtiesToLandingCategories(
  specialties: MedicalSpecialtyRecord[],
): LandingMedicalSpecialtyCategoriesData {
  const filtered = specialties.filter((specialty) => !isExcludedLevel3Name(specialty.name))
  const specialtiesById = new Map(filtered.map((specialty) => [specialty.id, specialty]))

  const level1Specialties = filtered
    .filter((specialty) => extractRelationId(specialty.parentSpecialty) === null)
    .sort(byName)

  const items: LandingMedicalSpecialtyItem[] = filtered
    .flatMap((specialty) => {
      const parentId = extractRelationId(specialty.parentSpecialty)
      if (parentId === null) return []

      const parent = specialtiesById.get(parentId)
      if (!parent) return []
      if (extractRelationId(parent.parentSpecialty) !== null) return []

      const mediaDescriptor = resolveMediaDescriptorFromLoadedRelation(specialty.featureImage, 'platformContentMedia')
      const mediaAlt =
        typeof mediaDescriptor?.alt === 'string' && mediaDescriptor.alt.trim().length > 0
          ? mediaDescriptor.alt
          : `${specialty.name} category image`

      return [
        {
          id: String(specialty.id),
          title: specialty.name,
          subtitle: specialty.description ?? null,
          categories: [String(parent.id)],
          href: `/listing-comparison?specialty=${encodeURIComponent(String(specialty.id))}`,
          image: {
            src: mediaDescriptor?.url ?? LANDING_SPECIALTY_PLACEHOLDER_SRC,
            alt: mediaAlt || LANDING_SPECIALTY_PLACEHOLDER_ALT,
          },
        },
      ]
    })
    .sort((left, right) => left.title.localeCompare(right.title, 'en', { sensitivity: 'base' }))

  const categories = level1Specialties
    .filter((specialty) => items.some((item) => item.categories.includes(String(specialty.id))))
    .map((specialty) => ({
      label: specialty.name,
      value: String(specialty.id),
    }))

  const categoryLabelByValue = new Map(categories.map((category) => [category.value, category.label]))
  items.sort((left, right) => {
    const leftCategoryLabel = categoryLabelByValue.get(left.categories[0] ?? '') ?? ''
    const rightCategoryLabel = categoryLabelByValue.get(right.categories[0] ?? '') ?? ''
    const categoryOrder = leftCategoryLabel.localeCompare(rightCategoryLabel, 'en', { sensitivity: 'base' })
    if (categoryOrder !== 0) return categoryOrder
    return left.title.localeCompare(right.title, 'en', { sensitivity: 'base' })
  })

  const featuredIds = buildRoundRobinFeaturedIds(items, categories, 4)

  return {
    categories,
    items,
    featuredIds,
  }
}

export async function getLandingMedicalSpecialtyCategories(
  payload: Payload,
): Promise<LandingMedicalSpecialtyCategoriesData> {
  const specialtiesResult = await payload.find({
    collection: 'medical-specialties',
    depth: 1,
    limit: 1000,
    pagination: false,
    overrideAccess: false,
    sort: 'name',
    select: {
      id: true,
      name: true,
      description: true,
      featureImage: true,
      parentSpecialty: true,
    },
  })

  return mapMedicalSpecialtiesToLandingCategories(specialtiesResult.docs as MedicalSpecialtyRecord[])
}

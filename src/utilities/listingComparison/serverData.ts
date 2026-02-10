import type { Payload } from 'payload'

import type { VerificationBadgeVariant } from '@/components/atoms/verification-badge'
import type { ListingCardData } from '@/components/organisms/Listing'
import type { City, Clinic, Clinictreatment, MedicalSpecialty, Review, Treatment } from '@/payload-types'
import { getMediaUrl } from '@/utilities/getMediaUrl'
import { slugify } from '@/utilities/slugify'
import {
  buildListingComparisonHref,
  LISTING_COMPARISON_PER_PAGE,
  LISTING_COMPARISON_PRICE_MAX_DEFAULT,
  LISTING_COMPARISON_PRICE_MIN_DEFAULT,
  parseListingComparisonQueryState,
  type ListingComparisonQueryState,
  type ListingComparisonRawSearchParams,
} from '@/utilities/listingComparison/queryState'
import type { SortOption } from '@/utilities/listingComparison/sort'

const CLINIC_CHUNK_SIZE = 200
const QUERY_PAGE_SIZE = 500
const DEFAULT_LOCATION_LABEL = 'Unknown location'
const PLACEHOLDER_MEDIA = {
  src: '/images/placeholder-576-968.svg',
  alt: 'Clinic placeholder image',
}

type FilterOption = {
  value: string
  label: string
}

type SpecialtyContext = {
  selected: FilterOption[]
  breadcrumbs: Array<{ label: string; href: string }>
}

type PaginationMeta = {
  page: number
  perPage: number
  totalPages: number
  totalResults: number
}

type ListingComparisonServerData = {
  results: ListingCardData[]
  filterOptions: {
    cities: FilterOption[]
    treatments: FilterOption[]
    waitTimes: Array<{ label: string; minWeeks: number; maxWeeks?: number }>
  }
  queryState: ListingComparisonQueryState
  pagination: PaginationMeta
  specialtyContext: SpecialtyContext
}

type CityMeta = {
  id: number
  stableId: string
  name: string
  slug: string
}

type TreatmentMeta = {
  id: number
  stableId: string
  name: string
  slug: string
  medicalSpecialtyId: number | null
}

type SpecialtyMeta = {
  id: number
  stableId: string
  name: string
  slug: string
  parentId: number | null
}

type ClinicRow = {
  clinic: Clinic
  location: string
  locationHref?: string
  priceFrom: number | null
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return []
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function extractRelationId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  if (value && typeof value === 'object' && 'id' in value) {
    const relation = value as { id?: unknown }
    return extractRelationId(relation.id)
  }

  return null
}

function normalizeVerification(value: unknown): VerificationBadgeVariant {
  if (value === 'bronze' || value === 'silver' || value === 'gold' || value === 'unverified') {
    return value
  }
  return 'unverified'
}

function canonicalizeFilterValues(values: string[], options: FilterOption[]): string[] {
  if (values.length === 0) return []

  const byValue = new Map(options.map((option) => [option.value, option.value]))
  const bySlug = new Map(options.map((option) => [slugify(option.label), option.value]))
  const byLabel = new Map(options.map((option) => [option.label.trim().toLowerCase(), option.value]))

  const resolved = new Set<string>()
  values.forEach((value) => {
    const trimmed = value.trim()
    if (!trimmed) return

    const byExact = byValue.get(trimmed)
    if (byExact) {
      resolved.add(byExact)
      return
    }

    const slugValue = bySlug.get(slugify(trimmed))
    if (slugValue) {
      resolved.add(slugValue)
      return
    }

    const labelValue = byLabel.get(trimmed.toLowerCase())
    if (labelValue) {
      resolved.add(labelValue)
    }
  })

  return Array.from(resolved)
}

function sortFilterOptions(options: FilterOption[]): FilterOption[] {
  return [...options].sort((a, b) => a.label.localeCompare(b.label))
}

function buildSpecialtyTree(allSpecialties: SpecialtyMeta[]): Map<number, number[]> {
  const children = new Map<number, number[]>()

  allSpecialties.forEach((specialty) => {
    if (!specialty.parentId) return
    const siblings = children.get(specialty.parentId) ?? []
    siblings.push(specialty.id)
    children.set(specialty.parentId, siblings)
  })

  return children
}

function collectDescendantSpecialties(seed: number[], specialtyTree: Map<number, number[]>): Set<number> {
  const queue = [...seed]
  const visited = new Set<number>()

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || visited.has(current)) continue

    visited.add(current)
    const children = specialtyTree.get(current) ?? []
    children.forEach((child) => {
      if (!visited.has(child)) {
        queue.push(child)
      }
    })
  }

  return visited
}

function normalizeSort(sort: SortOption): SortOption {
  return sort
}

function compareClinicRows(sortBy: SortOption, left: ClinicRow, right: ClinicRow): number {
  const leftPrice = left.priceFrom ?? Number.POSITIVE_INFINITY
  const rightPrice = right.priceFrom ?? Number.POSITIVE_INFINITY
  const leftRating = left.clinic.averageRating ?? 0
  const rightRating = right.clinic.averageRating ?? 0
  const leftName = left.clinic.name
  const rightName = right.clinic.name

  switch (sortBy) {
    case 'price-asc':
    case 'rank':
      if (leftPrice !== rightPrice) return leftPrice - rightPrice
      if (rightRating !== leftRating) return rightRating - leftRating
      return leftName.localeCompare(rightName)
    case 'price-desc':
      if (leftPrice !== rightPrice) return rightPrice - leftPrice
      if (rightRating !== leftRating) return rightRating - leftRating
      return leftName.localeCompare(rightName)
    case 'rating-desc':
      if (rightRating !== leftRating) return rightRating - leftRating
      if (leftPrice !== rightPrice) return leftPrice - rightPrice
      return leftName.localeCompare(rightName)
    case 'name-asc':
      return leftName.localeCompare(rightName)
    default:
      return leftName.localeCompare(rightName)
  }
}

async function findAllCities(payload: Payload): Promise<City[]> {
  let page = 1
  const docs: City[] = []

  while (true) {
    const result = await payload.find({
      collection: 'cities',
      depth: 0,
      page,
      limit: QUERY_PAGE_SIZE,
      pagination: true,
      overrideAccess: false,
      select: {
        id: true,
        stableId: true,
        name: true,
      },
    })

    docs.push(...(result.docs as City[]))
    if (!result.hasNextPage) break
    page += 1
  }

  return docs
}

async function findAllTreatments(payload: Payload): Promise<Treatment[]> {
  let page = 1
  const docs: Treatment[] = []

  while (true) {
    const result = await payload.find({
      collection: 'treatments',
      depth: 0,
      page,
      limit: QUERY_PAGE_SIZE,
      pagination: true,
      overrideAccess: false,
      select: {
        id: true,
        stableId: true,
        name: true,
        medicalSpecialty: true,
      },
    })

    docs.push(...(result.docs as Treatment[]))
    if (!result.hasNextPage) break
    page += 1
  }

  return docs
}

async function findAllSpecialties(payload: Payload): Promise<MedicalSpecialty[]> {
  let page = 1
  const docs: MedicalSpecialty[] = []

  while (true) {
    const result = await payload.find({
      collection: 'medical-specialties',
      depth: 0,
      page,
      limit: QUERY_PAGE_SIZE,
      pagination: true,
      overrideAccess: false,
      select: {
        id: true,
        stableId: true,
        name: true,
        parentSpecialty: true,
      },
    })

    docs.push(...(result.docs as MedicalSpecialty[]))
    if (!result.hasNextPage) break
    page += 1
  }

  return docs
}

async function findAllApprovedClinics(payload: Payload): Promise<Clinic[]> {
  let page = 1
  const docs: Clinic[] = []

  while (true) {
    const result = await payload.find({
      collection: 'clinics',
      depth: 2,
      page,
      limit: QUERY_PAGE_SIZE,
      pagination: true,
      overrideAccess: false,
      where: {
        status: {
          equals: 'approved',
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        averageRating: true,
        verification: true,
        coordinates: true,
        address: {
          city: true,
          country: true,
        },
        thumbnail: true,
        tags: true,
      },
    })

    docs.push(...(result.docs as Clinic[]))
    if (!result.hasNextPage) break
    page += 1
  }

  return docs
}

async function findClinicTreatmentsForClinics(payload: Payload, clinicIds: number[]): Promise<Clinictreatment[]> {
  if (clinicIds.length === 0) return []

  const allDocs: Clinictreatment[] = []
  const chunks = chunkArray(clinicIds, CLINIC_CHUNK_SIZE)

  for (const chunk of chunks) {
    let page = 1

    while (true) {
      const result = await payload.find({
        collection: 'clinictreatments',
        depth: 0,
        page,
        limit: QUERY_PAGE_SIZE,
        pagination: true,
        overrideAccess: false,
        where: {
          clinic: {
            in: chunk,
          },
        },
        select: {
          id: true,
          clinic: true,
          treatment: true,
          price: true,
        },
      })

      allDocs.push(...(result.docs as Clinictreatment[]))
      if (!result.hasNextPage) break
      page += 1
    }
  }

  return allDocs
}

async function countApprovedReviewsByClinic(payload: Payload, clinicIds: number[]): Promise<Map<number, number>> {
  const counts = new Map<number, number>()
  if (clinicIds.length === 0) return counts

  const chunks = chunkArray(clinicIds, CLINIC_CHUNK_SIZE)

  for (const chunk of chunks) {
    let page = 1

    while (true) {
      const result = await payload.find({
        collection: 'reviews',
        depth: 0,
        page,
        limit: QUERY_PAGE_SIZE,
        pagination: true,
        overrideAccess: false,
        where: {
          and: [
            {
              status: {
                equals: 'approved',
              },
            },
            {
              clinic: {
                in: chunk,
              },
            },
          ],
        },
        select: {
          clinic: true,
        },
      })

      const docs = result.docs as Review[]
      docs.forEach((review) => {
        const clinicId = extractRelationId(review.clinic)
        if (!clinicId) return
        const current = counts.get(clinicId) ?? 0
        counts.set(clinicId, current + 1)
      })

      if (!result.hasNextPage) break
      page += 1
    }
  }

  return counts
}

function mapLocationHref(coordinates: unknown): string | undefined {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return undefined

  const lat = Number(coordinates[0])
  const lng = Number(coordinates[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined

  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`
}

export async function getListingComparisonServerData(
  payload: Payload,
  searchParams: ListingComparisonRawSearchParams = {},
): Promise<ListingComparisonServerData> {
  const parsed = parseListingComparisonQueryState(searchParams)
  const initialQueryState = parsed.state

  const [cityDocs, treatmentDocs, specialtyDocs, approvedClinics] = await Promise.all([
    findAllCities(payload),
    findAllTreatments(payload),
    findAllSpecialties(payload),
    findAllApprovedClinics(payload),
  ])

  const cityMeta: CityMeta[] = cityDocs
    .map((city) => ({
      id: city.id,
      stableId: city.stableId ?? String(city.id),
      name: city.name,
      slug: slugify(city.name),
    }))
    .filter((city) => city.name.trim().length > 0)

  const cityOptions = sortFilterOptions(cityMeta.map((city) => ({ value: city.stableId, label: city.name })))

  let selectedCityStableIds = canonicalizeFilterValues(initialQueryState.cities, cityOptions)
  if (selectedCityStableIds.length === 0 && parsed.legacy.location) {
    selectedCityStableIds = canonicalizeFilterValues([parsed.legacy.location], cityOptions)
  }

  const cityIdByStableId = new Map(cityMeta.map((city) => [city.stableId, city.id]))
  const cityMetaById = new Map(cityMeta.map((city) => [city.id, city]))
  const selectedCityIds = new Set(
    selectedCityStableIds
      .map((stableId) => cityIdByStableId.get(stableId))
      .filter((id): id is number => typeof id === 'number'),
  )

  const specialtiesMeta: SpecialtyMeta[] = specialtyDocs.map((specialty) => ({
    id: specialty.id,
    stableId: specialty.stableId ?? String(specialty.id),
    name: specialty.name,
    slug: slugify(specialty.name),
    parentId: extractRelationId(specialty.parentSpecialty),
  }))

  const specialtyOptions = sortFilterOptions(
    specialtiesMeta.map((specialty) => ({
      value: specialty.stableId,
      label: specialty.name,
    })),
  )

  let selectedSpecialtyStableIds = canonicalizeFilterValues(initialQueryState.specialties, specialtyOptions)
  if (selectedSpecialtyStableIds.length === 0 && parsed.legacy.service) {
    selectedSpecialtyStableIds = canonicalizeFilterValues([parsed.legacy.service], specialtyOptions)
  }

  const specialtyByStableId = new Map(specialtiesMeta.map((specialty) => [specialty.stableId, specialty]))
  const selectedSpecialtyIds = selectedSpecialtyStableIds
    .map((stableId) => specialtyByStableId.get(stableId)?.id)
    .filter((id): id is number => typeof id === 'number')
  const specialtyTree = buildSpecialtyTree(specialtiesMeta)
  const specialtyScope = collectDescendantSpecialties(selectedSpecialtyIds, specialtyTree)

  const treatmentsMeta: TreatmentMeta[] = treatmentDocs.map((treatment) => ({
    id: treatment.id,
    stableId: treatment.stableId ?? String(treatment.id),
    name: treatment.name,
    slug: slugify(treatment.name),
    medicalSpecialtyId: extractRelationId(treatment.medicalSpecialty),
  }))

  const allTreatmentOptions = sortFilterOptions(
    treatmentsMeta.map((treatment) => ({
      value: treatment.stableId,
      label: treatment.name,
    })),
  )

  let selectedTreatmentStableIds = canonicalizeFilterValues(initialQueryState.treatments, allTreatmentOptions)
  if (selectedTreatmentStableIds.length === 0 && parsed.legacy.service) {
    selectedTreatmentStableIds = canonicalizeFilterValues([parsed.legacy.service], allTreatmentOptions)
  }

  const treatmentByStableId = new Map(treatmentsMeta.map((treatment) => [treatment.stableId, treatment]))
  const selectedTreatmentIds = selectedTreatmentStableIds
    .map((stableId) => treatmentByStableId.get(stableId)?.id)
    .filter((id): id is number => typeof id === 'number')

  const specialtyTreatmentIds = new Set<number>()
  if (specialtyScope.size > 0) {
    treatmentsMeta.forEach((treatment) => {
      if (treatment.medicalSpecialtyId && specialtyScope.has(treatment.medicalSpecialtyId)) {
        specialtyTreatmentIds.add(treatment.id)
      }
    })
  }

  let scopedTreatmentIds: Set<number> | null = null
  if (specialtyTreatmentIds.size > 0) {
    scopedTreatmentIds = new Set(specialtyTreatmentIds)
  }
  if (selectedTreatmentIds.length > 0) {
    if (!scopedTreatmentIds) {
      scopedTreatmentIds = new Set(selectedTreatmentIds)
    } else {
      scopedTreatmentIds = new Set(selectedTreatmentIds.filter((treatmentId) => scopedTreatmentIds?.has(treatmentId)))
    }
  }

  const candidateClinics = approvedClinics.filter((clinic) => {
    const clinicCityId = extractRelationId(clinic.address?.city)
    if (selectedCityIds.size > 0 && (!clinicCityId || !selectedCityIds.has(clinicCityId))) {
      return false
    }

    if (initialQueryState.ratingMin !== null) {
      const rating = clinic.averageRating ?? 0
      if (rating < initialQueryState.ratingMin) {
        return false
      }
    }

    return true
  })

  const candidateClinicIds = candidateClinics.map((clinic) => clinic.id)
  const clinicTreatments = await findClinicTreatmentsForClinics(payload, candidateClinicIds)

  const treatmentsByClinicId = new Map<number, Clinictreatment[]>()
  const availableTreatmentIdSet = new Set<number>()

  clinicTreatments.forEach((entry) => {
    const clinicId = extractRelationId(entry.clinic)
    const treatmentId = extractRelationId(entry.treatment)
    if (!clinicId || !treatmentId) return

    availableTreatmentIdSet.add(treatmentId)
    const rows = treatmentsByClinicId.get(clinicId) ?? []
    rows.push(entry)
    treatmentsByClinicId.set(clinicId, rows)
  })

  const scopedRows = candidateClinics.flatMap<ClinicRow>((clinic) => {
      const cityRelation = clinic.address?.city
      const cityId = extractRelationId(cityRelation)
      const cityName =
        typeof cityRelation === 'object' && cityRelation !== null && 'name' in cityRelation
          ? String((cityRelation as { name?: unknown }).name ?? '')
          : (cityId ? cityMetaById.get(cityId)?.name : undefined) ?? ''

      const country = clinic.address?.country ?? ''
      const location = [cityName, country].filter((item) => item && item.trim().length > 0).join(', ')
      const rows = treatmentsByClinicId.get(clinic.id) ?? []
      const priceRows =
        scopedTreatmentIds && scopedTreatmentIds.size > 0
          ? rows.filter((entry) => {
              const treatmentId = extractRelationId(entry.treatment)
              return treatmentId !== null && scopedTreatmentIds?.has(treatmentId)
            })
          : rows

      if (scopedTreatmentIds && scopedTreatmentIds.size > 0 && priceRows.length === 0) {
        return []
      }

      const prices = priceRows.map((entry) => entry.price).filter((price): price is number => Number.isFinite(price))
      const priceFrom = prices.length > 0 ? Math.min(...prices) : null
      const hasPriceWindowFilter =
        initialQueryState.priceMin > LISTING_COMPARISON_PRICE_MIN_DEFAULT ||
        initialQueryState.priceMax < LISTING_COMPARISON_PRICE_MAX_DEFAULT

      if (priceFrom === null && hasPriceWindowFilter) {
        return []
      }

      if (priceFrom !== null) {
        if (priceFrom < initialQueryState.priceMin || priceFrom > initialQueryState.priceMax) {
          return []
        }
      }

      const locationHref = mapLocationHref(clinic.coordinates)
      const row: ClinicRow = {
        clinic,
        location: location || DEFAULT_LOCATION_LABEL,
        priceFrom,
      }
      if (locationHref) {
        row.locationHref = locationHref
      }

      return [row]
    })

  const normalizedSort = normalizeSort(initialQueryState.sort)
  const sortedRows = [...scopedRows].sort((left, right) => compareClinicRows(normalizedSort, left, right))

  const totalResults = sortedRows.length
  const totalPages = Math.max(1, Math.ceil(totalResults / LISTING_COMPARISON_PER_PAGE))
  const page = Math.min(Math.max(initialQueryState.page, 1), totalPages)
  const pageStart = (page - 1) * LISTING_COMPARISON_PER_PAGE
  const pageRows = sortedRows.slice(pageStart, pageStart + LISTING_COMPARISON_PER_PAGE)

  const reviewCounts = await countApprovedReviewsByClinic(
    payload,
    pageRows.map((row) => row.clinic.id),
  )

  const results: ListingCardData[] = pageRows.map(({ clinic, location, locationHref, priceFrom }) => {
    const ratingValue = typeof clinic.averageRating === 'number' ? clinic.averageRating : 0
    const ratingCount = reviewCounts.get(clinic.id) ?? 0
    const mediaSrc = getMediaUrl(clinic.thumbnail) ?? PLACEHOLDER_MEDIA.src
    const mediaAlt =
      typeof clinic.thumbnail === 'object' &&
      clinic.thumbnail !== null &&
      'alt' in clinic.thumbnail &&
      typeof clinic.thumbnail.alt === 'string' &&
      clinic.thumbnail.alt.trim().length > 0
        ? clinic.thumbnail.alt
        : `${clinic.name} image`
    const tags =
      clinic.tags?.flatMap((tag) => {
        if (typeof tag === 'object' && tag !== null && 'name' in tag && typeof tag.name === 'string') {
          return [tag.name]
        }
        return []
      }) ?? []

    const slug = clinic.slug || slugify(clinic.name)

    return {
      id: clinic.id,
      name: clinic.name,
      location,
      locationHref,
      media: {
        src: mediaSrc,
        alt: mediaAlt || PLACEHOLDER_MEDIA.alt,
      },
      verification: {
        variant: normalizeVerification(clinic.verification),
      },
      rating: {
        value: ratingValue,
        count: ratingCount,
      },
      tags,
      priceFrom:
        priceFrom !== null
          ? {
              value: priceFrom,
              currency: 'USD',
              label: 'From',
            }
          : undefined,
      actions: {
        details: {
          href: `#${encodeURIComponent(slug)}`,
          label: 'Details',
        },
        compare: {
          href: '#',
          label: 'Compare',
        },
      },
    }
  })

  const availableTreatmentOptions = sortFilterOptions(
    treatmentsMeta
      .filter((treatment) => availableTreatmentIdSet.has(treatment.id))
      .map((treatment) => ({ value: treatment.stableId, label: treatment.name })),
  )

  selectedTreatmentStableIds = selectedTreatmentStableIds.filter((stableId) =>
    availableTreatmentOptions.some((option) => option.value === stableId),
  )

  const selectedSpecialties = selectedSpecialtyStableIds
    .map((stableId) => specialtyByStableId.get(stableId))
    .filter((specialty): specialty is SpecialtyMeta => Boolean(specialty))
    .map((specialty) => ({ value: specialty.stableId, label: specialty.name }))

  const specialtyContext: SpecialtyContext = {
    selected: selectedSpecialties,
    breadcrumbs:
      selectedSpecialties.length > 0
        ? [
            { label: 'Home', href: '/' },
            { label: 'Clinics', href: '/listing-comparison' },
            {
              label: selectedSpecialties[0]?.label ?? 'Specialty',
              href: buildListingComparisonHref({
                ...initialQueryState,
                page: 1,
                specialties: [selectedSpecialties[0]?.value ?? ''],
              }),
            },
          ]
        : [],
  }

  const queryState: ListingComparisonQueryState = {
    page,
    sort: normalizedSort,
    cities: selectedCityStableIds,
    treatments: selectedTreatmentStableIds,
    specialties: selectedSpecialtyStableIds,
    ratingMin: initialQueryState.ratingMin,
    priceMin: initialQueryState.priceMin,
    priceMax: initialQueryState.priceMax,
  }

  return {
    results,
    filterOptions: {
      cities: cityOptions,
      treatments: availableTreatmentOptions,
      waitTimes: [],
    },
    queryState,
    pagination: {
      page,
      perPage: LISTING_COMPARISON_PER_PAGE,
      totalPages,
      totalResults,
    },
    specialtyContext,
  }
}

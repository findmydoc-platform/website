import type { Payload } from 'payload'

import type { Accreditation, City, ClinicGalleryEntry } from '@/payload-types'

import { mapClinicToClinicDetailData } from './mappers'
import {
  countApprovedClinicReviews,
  countApprovedDoctorReviews,
  findAccreditationsByIds,
  findCitiesByIds,
  findClinicBySlug,
  findClinicGalleryEntriesByIds,
  findClinicTreatmentsByClinicId,
  findDoctorsByClinicId,
  findDoctorSpecialtiesByDoctorIds,
} from './repositories'
import type { ClinicDetailServerDataOptions, ClinicDetailServerDataResult } from './types'

function extractRelationId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value

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

function collectLookupIds<T>(items: T[], getId: (item: T) => number | null): number[] {
  return Array.from(new Set(items.map(getId).filter((id): id is number => typeof id === 'number')))
}

function collectAccreditationLookupIds(clinicAccreditations: unknown[] | null | undefined): number[] {
  return collectLookupIds(clinicAccreditations ?? [], (item) => {
    if (!item || typeof item !== 'object') {
      return extractRelationId(item)
    }

    const hasName = 'name' in item && typeof item.name === 'string' && item.name.trim().length > 0
    return hasName ? null : extractRelationId(item)
  })
}

function collectCityLookupIds(cityRelation: unknown): number[] {
  if (
    cityRelation &&
    typeof cityRelation === 'object' &&
    'name' in cityRelation &&
    typeof cityRelation.name === 'string'
  ) {
    return []
  }

  const cityId = extractRelationId(cityRelation)
  return typeof cityId === 'number' ? [cityId] : []
}

function collectGalleryEntryLookupIds(galleryRelations: unknown[] | null | undefined): number[] {
  return collectLookupIds(galleryRelations ?? [], (item) => extractRelationId(item))
}

function mergeGalleryEntries(
  relations: unknown[] | null | undefined,
  fetchedEntries: ClinicGalleryEntry[],
): ClinicGalleryEntry[] {
  const mapById = new Map<number, ClinicGalleryEntry>()

  for (const entry of fetchedEntries) {
    mapById.set(entry.id, entry)
  }

  for (const relation of relations ?? []) {
    if (relation && typeof relation === 'object' && 'id' in relation) {
      mapById.set(relation.id as number, relation as ClinicGalleryEntry)
    }
  }

  return Array.from(mapById.values())
}

export async function getClinicDetailServerData(
  payload: Payload,
  slug: string,
  options: ClinicDetailServerDataOptions,
): Promise<ClinicDetailServerDataResult> {
  const clinic = await findClinicBySlug(payload, slug, options.draft)
  if (!clinic) return null

  const [clinicTreatments, doctors, clinicReviewCount] = await Promise.all([
    findClinicTreatmentsByClinicId(payload, clinic.id),
    findDoctorsByClinicId(payload, clinic.id),
    countApprovedClinicReviews(payload, clinic.id),
  ])

  const doctorIds = doctors.map((doctor) => doctor.id)

  const [doctorSpecialties, doctorReviewCounts] = await Promise.all([
    findDoctorSpecialtiesByDoctorIds(payload, doctorIds),
    countApprovedDoctorReviews(payload, doctorIds),
  ])

  const accreditationLookupIds = collectAccreditationLookupIds(clinic.accreditations)
  const cityLookupIds = collectCityLookupIds(clinic.address.city)
  const galleryEntryLookupIds = collectGalleryEntryLookupIds(clinic.galleryEntries)

  const [accreditationDocs, cityDocs, fetchedGalleryEntries] = await Promise.all([
    findAccreditationsByIds(payload, accreditationLookupIds),
    findCitiesByIds(payload, cityLookupIds),
    findClinicGalleryEntriesByIds(payload, galleryEntryLookupIds),
  ])

  const galleryEntries = mergeGalleryEntries(clinic.galleryEntries, fetchedGalleryEntries)

  return mapClinicToClinicDetailData({
    clinic,
    clinicTreatments,
    doctors,
    doctorSpecialties,
    clinicReviewCount,
    doctorReviewCounts,
    galleryEntries,
    accreditations: accreditationDocs as Accreditation[],
    cities: cityDocs as City[],
  })
}

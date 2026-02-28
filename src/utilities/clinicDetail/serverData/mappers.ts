import type {
  Accreditation,
  City,
  Clinic,
  ClinicGalleryEntry,
  ClinicGalleryMedia,
  Clinictreatment,
  Doctor,
  Doctorspecialty,
  MedicalSpecialty,
  Treatment,
} from '@/payload-types'
import type {
  ClinicBeforeAfterEntry,
  ClinicDetailData,
  ClinicDetailDoctor,
  ClinicDetailLocation,
  ClinicDetailTreatment,
  ClinicDetailTrust,
  ClinicVerificationTier,
} from '@/components/templates/ClinicDetailConcepts/types'
import { resolveMediaDescriptorFromLoadedRelation } from '@/utilities/media/relationMedia'

import type { ClinicDetailMappingArgs } from './types'

const CLINIC_HERO_PLACEHOLDER = '/images/placeholder-576-968.svg'
const DOCTOR_IMAGE_PLACEHOLDER = '/images/avatar-placeholder.svg'

const LANGUAGE_LABELS: Record<string, string> = {
  german: 'German',
  english: 'English',
  french: 'French',
  spanish: 'Spanish',
  italian: 'Italian',
  turkish: 'Turkish',
  russian: 'Russian',
  arabic: 'Arabic',
  chinese: 'Chinese',
  japanese: 'Japanese',
  korean: 'Korean',
  portuguese: 'Portuguese',
}

const DOCTOR_SPECIALTY_PRIORITY: Record<string, number> = {
  expert: 5,
  specialist: 4,
  advanced: 3,
  intermediate: 2,
  beginner: 1,
}

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

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function extractLexicalPlainText(content: unknown): string {
  const walk = (node: unknown): string[] => {
    if (!node || typeof node !== 'object') return []

    const nodeObject = node as Record<string, unknown>
    const chunks: string[] = []

    if (nodeObject.type === 'text' && typeof nodeObject.text === 'string') {
      chunks.push(nodeObject.text)
    }

    if (Array.isArray(nodeObject.children)) {
      for (const child of nodeObject.children) {
        chunks.push(...walk(child))
      }
    }

    if (nodeObject.root && typeof nodeObject.root === 'object') {
      chunks.push(...walk(nodeObject.root))
    }

    return chunks
  }

  return normalizeWhitespace(walk(content).join(' '))
}

function toLanguageLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return LANGUAGE_LABELS[value] ?? null
}

function toVerificationTier(value: unknown): ClinicVerificationTier {
  if (value === 'bronze' || value === 'silver' || value === 'gold' || value === 'unverified') {
    return value
  }

  return 'unverified'
}

function toClinicImage(clinic: Clinic): { src: string; alt: string } {
  const descriptor = resolveMediaDescriptorFromLoadedRelation(clinic.thumbnail, 'clinicMedia')

  return {
    src: descriptor?.url ?? CLINIC_HERO_PLACEHOLDER,
    alt: descriptor?.alt ?? `${clinic.name} image`,
  }
}

function toDoctorImage(doctor: Doctor): { src: string; alt: string } {
  const descriptor = resolveMediaDescriptorFromLoadedRelation(doctor.profileImage, 'doctorMedia')

  return {
    src: descriptor?.url ?? DOCTOR_IMAGE_PLACEHOLDER,
    alt: descriptor?.alt ?? `${doctor.fullName} portrait`,
  }
}

function toGalleryMediaDescriptor(value: unknown): { url: string | null; alt: string | null } | undefined {
  if (!value || typeof value !== 'object') return undefined

  const media = value as Partial<ClinicGalleryMedia>

  const urlFromField = typeof media.url === 'string' && media.url.trim().length > 0 ? media.url : null
  const filename = typeof media.filename === 'string' && media.filename.trim().length > 0 ? media.filename : null
  const url = urlFromField ?? (filename ? `/api/clinicGalleryMedia/file/${filename}` : null)
  const alt = typeof media.alt === 'string' && media.alt.trim().length > 0 ? media.alt : null

  if (!url && !alt) return undefined
  return { url, alt }
}

function resolveMedicalSpecialtyName(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null

  const specialty = value as Partial<MedicalSpecialty>
  if (typeof specialty.name === 'string' && specialty.name.trim().length > 0) {
    return specialty.name
  }

  return null
}

function resolveTreatmentCategory(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined

  const treatment = value as Partial<Treatment>
  return resolveMedicalSpecialtyName(treatment.medicalSpecialty) ?? undefined
}

function resolveDoctorName(doctor: Doctor): string {
  if (typeof doctor.fullName === 'string' && doctor.fullName.trim().length > 0) {
    return doctor.fullName
  }

  const fallbackName = normalizeWhitespace(`${doctor.firstName} ${doctor.lastName}`)
  return fallbackName.length > 0 ? fallbackName : `Doctor ${doctor.id}`
}

function buildFullAddress(clinic: Clinic, cityNameById: Map<number, string>): string | undefined {
  const streetLine = normalizeWhitespace(`${clinic.address.street} ${clinic.address.houseNumber}`)

  const cityRelation = clinic.address.city
  const cityNameFromRelation =
    cityRelation && typeof cityRelation === 'object' && 'name' in cityRelation && typeof cityRelation.name === 'string'
      ? cityRelation.name
      : null
  const cityNameFromMap = cityNameById.get(extractRelationId(cityRelation) ?? -1) ?? null
  const cityName = cityNameFromRelation ?? cityNameFromMap

  const zipCode = Number.isFinite(clinic.address.zipCode) ? String(clinic.address.zipCode) : ''
  const cityLine = normalizeWhitespace(`${zipCode} ${cityName ?? ''}`)

  const country = typeof clinic.address.country === 'string' ? clinic.address.country.trim() : ''

  const fullAddress = [streetLine, cityLine, country].filter((part) => part.length > 0).join(', ')
  return fullAddress.length > 0 ? fullAddress : undefined
}

function buildLocation(clinic: Clinic, cityNameById: Map<number, string>): ClinicDetailLocation {
  const coordinates =
    Array.isArray(clinic.coordinates) && clinic.coordinates.length === 2
      ? {
          lat: Number(clinic.coordinates[0]),
          lng: Number(clinic.coordinates[1]),
        }
      : undefined

  const hasValidCoordinates = Boolean(
    coordinates && Number.isFinite(coordinates.lat) && Number.isFinite(coordinates.lng),
  )

  return {
    fullAddress: buildFullAddress(clinic, cityNameById),
    coordinates: hasValidCoordinates ? coordinates : undefined,
  }
}

function mapTreatments(treatments: Clinictreatment[]): ClinicDetailTreatment[] {
  return treatments.map((entry) => {
    const treatment = entry.treatment as number | Treatment
    const treatmentId = extractRelationId(treatment) ?? entry.id

    const treatmentName =
      treatment && typeof treatment === 'object' && 'name' in treatment && typeof treatment.name === 'string'
        ? treatment.name
        : `Treatment ${treatmentId}`

    return {
      id: String(treatmentId),
      name: treatmentName,
      priceFromUsd: Number.isFinite(entry.price) ? entry.price : undefined,
      category: resolveTreatmentCategory(treatment),
    }
  })
}

function buildDoctorSpecialtyMap(doctorSpecialties: Doctorspecialty[]): Map<number, string> {
  const specialtiesByDoctorId = new Map<number, { priority: number; name: string }>()

  for (const item of doctorSpecialties) {
    const doctorId = extractRelationId(item.doctor)
    if (!doctorId) continue

    const specialtyName = resolveMedicalSpecialtyName(item.medicalSpecialty)
    if (!specialtyName) continue

    const priority = DOCTOR_SPECIALTY_PRIORITY[item.specializationLevel] ?? 0
    const current = specialtiesByDoctorId.get(doctorId)

    if (!current || priority > current.priority) {
      specialtiesByDoctorId.set(doctorId, { priority, name: specialtyName })
    }
  }

  return new Map(Array.from(specialtiesByDoctorId.entries()).map(([doctorId, value]) => [doctorId, value.name]))
}

function mapDoctors({
  doctors,
  doctorSpecialties,
  doctorReviewCounts,
  contactHref,
}: {
  doctors: Doctor[]
  doctorSpecialties: Doctorspecialty[]
  doctorReviewCounts: Map<number, number>
  contactHref: string
}): ClinicDetailDoctor[] {
  const specialtyByDoctorId = buildDoctorSpecialtyMap(doctorSpecialties)

  return doctors.map((doctor) => {
    const doctorId = String(doctor.id)
    const reviewCount = doctorReviewCounts.get(doctor.id)

    const languages = doctor.languages
      .map((value) => toLanguageLabel(value))
      .filter((value): value is string => Boolean(value))

    return {
      id: doctorId,
      name: resolveDoctorName(doctor),
      specialty: specialtyByDoctorId.get(doctor.id) ?? 'General Practice',
      ratingValue: typeof doctor.averageRating === 'number' ? doctor.averageRating : undefined,
      reviewCount: typeof reviewCount === 'number' ? reviewCount : undefined,
      qualifications: doctor.qualifications,
      yearsExperience: typeof doctor.experienceYears === 'number' ? doctor.experienceYears : undefined,
      languages,
      description: extractLexicalPlainText(doctor.biography) || undefined,
      image: toDoctorImage(doctor),
      contactHref,
    }
  })
}

function mapTrust({
  clinic,
  clinicReviewCount,
  accreditations,
}: {
  clinic: Clinic
  clinicReviewCount: number
  accreditations: Accreditation[]
}): ClinicDetailTrust {
  const accreditationNamesFromClinic = (clinic.accreditations ?? [])
    .map((item) => {
      if (item && typeof item === 'object' && 'name' in item && typeof item.name === 'string') {
        return item.name
      }

      return null
    })
    .filter((value): value is string => Boolean(value))

  const accreditationNamesFromLookup = accreditations
    .map((item) => (typeof item.name === 'string' && item.name.trim().length > 0 ? item.name : null))
    .filter((value): value is string => Boolean(value))

  const accreditationNames = Array.from(new Set([...accreditationNamesFromClinic, ...accreditationNamesFromLookup]))

  const languages = clinic.supportedLanguages
    .map((value) => toLanguageLabel(value))
    .filter((value): value is string => Boolean(value))

  return {
    ratingValue: typeof clinic.averageRating === 'number' ? clinic.averageRating : undefined,
    reviewCount: clinicReviewCount,
    verification: toVerificationTier(clinic.verification),
    accreditations: accreditationNames,
    languages,
  }
}

function mergeOrderedGalleryEntries(clinic: Clinic, fetchedEntries: ClinicGalleryEntry[]): ClinicGalleryEntry[] {
  const entriesById = new Map<number, ClinicGalleryEntry>()

  for (const entry of fetchedEntries) {
    entriesById.set(entry.id, entry)
  }

  for (const relation of clinic.galleryEntries ?? []) {
    if (relation && typeof relation === 'object' && 'id' in relation) {
      const entry = relation as ClinicGalleryEntry
      entriesById.set(entry.id, entry)
    }
  }

  const orderedByClinic = (clinic.galleryEntries ?? [])
    .map((relation) => {
      const id = extractRelationId(relation)
      return typeof id === 'number' ? entriesById.get(id) : null
    })
    .filter((entry): entry is ClinicGalleryEntry => Boolean(entry))

  if (orderedByClinic.length > 0) {
    return orderedByClinic
  }

  return fetchedEntries
}

function mapBeforeAfterEntries(clinic: Clinic, fetchedEntries: ClinicGalleryEntry[]): ClinicBeforeAfterEntry[] {
  const orderedEntries = mergeOrderedGalleryEntries(clinic, fetchedEntries)
  const mappedEntries: ClinicBeforeAfterEntry[] = []

  for (const entry of orderedEntries) {
    if (entry.status !== 'published') continue

    const beforeMedia = toGalleryMediaDescriptor(entry.beforeMedia)
    const afterMedia = toGalleryMediaDescriptor(entry.afterMedia)
    if (!beforeMedia?.url || !afterMedia?.url) continue

    const description = extractLexicalPlainText(entry.description)

    mappedEntries.push({
      id: String(entry.id),
      title: entry.title,
      before: {
        src: beforeMedia.url,
        alt: beforeMedia.alt ?? `${entry.title} before`,
      },
      after: {
        src: afterMedia.url,
        alt: afterMedia.alt ?? `${entry.title} after`,
      },
      ...(description ? { description } : {}),
    })
  }

  return mappedEntries
}

function buildContactHref(slug: string): string {
  return `/contact?clinic=${encodeURIComponent(slug)}&source=clinic-detail`
}

function mapCitiesToNameMap(cities: City[]): Map<number, string> {
  return new Map(
    cities
      .filter((item) => typeof item.name === 'string' && item.name.trim().length > 0)
      .map((item) => [item.id, item.name]),
  )
}

export function mapClinicToClinicDetailData({
  clinic,
  clinicTreatments,
  doctors,
  doctorSpecialties,
  clinicReviewCount,
  doctorReviewCounts,
  galleryEntries,
  accreditations,
  cities,
}: ClinicDetailMappingArgs): ClinicDetailData {
  const contactHref = buildContactHref(clinic.slug)
  const cityNameById = mapCitiesToNameMap(cities)

  return {
    clinicSlug: clinic.slug,
    clinicName: clinic.name,
    heroImage: toClinicImage(clinic),
    description: extractLexicalPlainText(clinic.description) || 'Clinic profile information currently being updated.',
    trust: mapTrust({
      clinic,
      clinicReviewCount,
      accreditations,
    }),
    treatments: mapTreatments(clinicTreatments),
    doctors: mapDoctors({
      doctors,
      doctorSpecialties,
      doctorReviewCounts,
      contactHref,
    }),
    beforeAfterEntries: mapBeforeAfterEntries(clinic, galleryEntries),
    location: buildLocation(clinic, cityNameById),
    contactHref,
  }
}

import type {
  Accreditation,
  City,
  Clinic,
  Clinictreatment,
  Doctor,
  Doctorspecialty,
  MedicalSpecialty,
  Review,
  ReviewResponse,
  Treatment,
} from '@/payload-types'
import type {
  ClinicDetailData,
  ClinicDetailDoctor,
  ClinicDetailLocation,
  ClinicDetailReview,
  ClinicDetailReviews,
  ClinicDetailTreatment,
  ClinicDetailTrust,
  ClinicVerificationTier,
} from '@/features/clinicDetail/contracts'
import { getClinicProfileTranslator } from '@/features/clinicDetail/overviewCopy'
import { clinicProfilePath } from '@/i18n/clinicProfilePath'
import { CONTACT_PATHS } from '@/i18n/contactPath'
import { LISTING_COMPARISON_PATHS } from '@/i18n/listingComparisonPath'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import { resolveDoctorProfileImage } from '@/utilities/media/doctorProfileImage'
import type { MediaDescriptor } from '@/utilities/media/relationMedia'
import { buildFreshnessSignals } from '@/utilities/freshness'
import { findLatestIsoTimestampString } from '@/utilities/timestamps'
import {
  LISTING_COMPARISON_PRICE_MAX_DEFAULT,
  LISTING_COMPARISON_PRICE_MIN_DEFAULT,
  buildListingComparisonHref,
} from '@/utilities/listingComparison/queryState'
import { getRelationshipName } from '@/utilities/relationships'
import {
  getReviewPublicMeasure,
  isVisibleReviewResponsePubliclyReadable,
  projectVisiblePublicReviewText,
} from '@/collections/reviews/publicProjection'

import type { ClinicDetailMappingArgs } from './types'
const LANGUAGE_CODES: Record<string, string> = {
  german: 'de',
  english: 'en',
  french: 'fr',
  spanish: 'es',
  italian: 'it',
  turkish: 'tr',
  russian: 'ru',
  arabic: 'ar',
  chinese: 'zh',
  japanese: 'ja',
  korean: 'ko',
  portuguese: 'pt',
}

const locationLabels = {
  de: new Intl.DisplayNames('de', { type: 'region', fallback: 'none' }),
  en: new Intl.DisplayNames('en', { type: 'region', fallback: 'none' }),
}

const languageLabels = {
  de: new Intl.DisplayNames('de', { type: 'language', fallback: 'none' }),
  en: new Intl.DisplayNames('en', { type: 'language', fallback: 'none' }),
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

function toLanguageLabel(value: unknown, locale: UiCopyLocale = 'en'): string | null {
  const code = typeof value === 'string' && Object.hasOwn(LANGUAGE_CODES, value) ? LANGUAGE_CODES[value] : undefined
  return code ? (languageLabels[locale].of(code) ?? null) : null
}

function toVerificationTier(value: unknown): ClinicVerificationTier {
  if (value === 'bronze' || value === 'silver' || value === 'gold' || value === 'unverified') {
    return value
  }

  return 'unverified'
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

function buildTreatmentComparisonLink(
  treatmentId: number,
  treatmentName: string,
): NonNullable<ClinicDetailTreatment['comparisonLink']> {
  return {
    href: buildListingComparisonHref({
      page: 1,
      sort: 'rank',
      cities: [],
      treatments: [String(treatmentId)],
      specialties: [],
      ratingMin: null,
      priceMin: LISTING_COMPARISON_PRICE_MIN_DEFAULT,
      priceMax: LISTING_COMPARISON_PRICE_MAX_DEFAULT,
    }),
    label: `Compare clinics for ${treatmentName}`,
  }
}

function resolveDoctorName(doctor: Doctor): string {
  if (typeof doctor.fullName === 'string' && doctor.fullName.trim().length > 0) {
    return doctor.fullName
  }

  const fallbackName = normalizeWhitespace(`${doctor.firstName} ${doctor.lastName}`)
  return fallbackName.length > 0 ? fallbackName : `Doctor ${doctor.id}`
}

function buildFullAddress(clinic: Clinic, cityNameById: Map<number, string>, locale: UiCopyLocale): string | undefined {
  const address = clinic.address
  if (!address) return undefined

  const streetLine = normalizeWhitespace(`${address.street ?? ''} ${address.houseNumber ?? ''}`)

  const cityRelation = address.city
  const cityNameFromRelation =
    cityRelation && typeof cityRelation === 'object' ? cityRelation.displayName?.trim() || cityRelation.name : null
  const cityName = cityNameFromRelation ?? cityNameById.get(extractRelationId(cityRelation) ?? -1)

  const zipCode = typeof address.zipCode === 'string' ? address.zipCode.trim() : ''
  const cityLine = normalizeWhitespace(`${zipCode} ${cityName ?? ''}`)

  const countryRelation = address.country
  const isoCode = typeof countryRelation === 'object' ? countryRelation?.isoCode?.trim().toUpperCase() : undefined
  const localizedCountry = isoCode && /^[A-Z]{2}$/.test(isoCode) ? locationLabels[locale].of(isoCode) : undefined
  const country = localizedCountry ?? getRelationshipName(countryRelation)

  const fullAddress = [streetLine, cityLine, country].filter((part) => part.length > 0).join(', ')
  return fullAddress.length > 0 ? fullAddress : undefined
}

function buildLocation(clinic: Clinic, cityNameById: Map<number, string>, locale: UiCopyLocale): ClinicDetailLocation {
  const coordinates =
    Array.isArray(clinic.coordinates) && clinic.coordinates.length === 2
      ? {
          lat: Number(clinic.coordinates[1]),
          lng: Number(clinic.coordinates[0]),
        }
      : undefined

  const hasValidCoordinates = Boolean(
    coordinates && Number.isFinite(coordinates.lat) && Number.isFinite(coordinates.lng),
  )

  return {
    fullAddress: buildFullAddress(clinic, cityNameById, locale),
    coordinates: hasValidCoordinates ? coordinates : undefined,
  }
}

function mapTreatments(treatments: Clinictreatment[]): ClinicDetailTreatment[] {
  return treatments.map((entry) => {
    const treatment = entry.treatment as number | Treatment
    const treatmentRelationId = extractRelationId(treatment)
    const treatmentId = treatmentRelationId ?? entry.id

    const treatmentName =
      treatment && typeof treatment === 'object' && 'name' in treatment && typeof treatment.name === 'string'
        ? treatment.name
        : `Treatment ${treatmentId}`

    return {
      id: String(treatmentId),
      name: treatmentName,
      priceFrom: Number.isFinite(entry.price) ? entry.price : undefined,
      category: resolveTreatmentCategory(treatment),
      comparisonLink:
        typeof treatmentRelationId === 'number'
          ? buildTreatmentComparisonLink(treatmentRelationId, treatmentName)
          : undefined,
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
  doctorMediaByDoctorId,
}: {
  doctors: Doctor[]
  doctorSpecialties: Doctorspecialty[]
  doctorReviewCounts: Map<number, number>
  contactHref: string
  doctorMediaByDoctorId?: ReadonlyMap<number, MediaDescriptor>
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
      description: doctor.biography ?? undefined,
      image: resolveDoctorProfileImage({
        doctor,
        descriptorsByDoctorId: doctorMediaByDoctorId,
      }),
      contactHref,
    }
  })
}

function resolveClinicRatingValue(clinic: Clinic, clinicReviewCount: number): number | null {
  if (clinicReviewCount === 0) return null

  if (typeof clinic.averageRating === 'number' && Number.isFinite(clinic.averageRating)) {
    return clinic.averageRating
  }

  throw new Error(`Clinic ${clinic.id} has approved reviews but no average rating.`)
}

function mapTrust({
  clinic,
  locale,
  clinicReviewCount,
  accreditations,
}: {
  clinic: Clinic
  locale: UiCopyLocale
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

  const languages = (clinic.supportedLanguages ?? [])
    .map((value) => toLanguageLabel(value, locale))
    .filter((value): value is string => Boolean(value))

  return {
    ratingValue: resolveClinicRatingValue(clinic, clinicReviewCount),
    reviewCount: clinicReviewCount,
    verification: toVerificationTier(clinic.verification),
    accreditations: accreditationNames,
    languages,
  }
}

function mapReviews({
  clinicReviewCount,
  approvedClinicReviews,
  reviewResponses,
  clinicName,
}: {
  clinicReviewCount: number
  approvedClinicReviews: Review[]
  reviewResponses: ReviewResponse[]
  clinicName: string
}): ClinicDetailReviews {
  const responseByReviewId = new Map<number, ReviewResponse>()
  for (const response of reviewResponses) {
    const reviewId = extractRelationId(response.review)
    if (reviewId !== null) responseByReviewId.set(reviewId, response)
  }

  const items: ClinicDetailReview[] = approvedClinicReviews
    .map((review): ClinicDetailReview | null => {
      const publicText = projectVisiblePublicReviewText(review)
      const reviewDate = typeof review.reviewDate === 'string' ? review.reviewDate : ''
      if (!publicText || !reviewDate) return null
      if (typeof review.starRating !== 'number' || !Number.isFinite(review.starRating)) {
        throw new Error(`Review ${review.id} is missing a star rating.`)
      }

      const base = {
        id: String(review.id),
        reviewDate,
        ratingValue: review.starRating,
      }

      const isRedacted = getReviewPublicMeasure(review) === 'redaction'
      const item: ClinicDetailReview =
        publicText.kind === 'placeholder'
          ? { ...base, kind: 'placeholder' }
          : {
              ...base,
              kind: 'text',
              comment: publicText.text,
              ...(isRedacted
                ? { notice: { kind: 'redaction' } }
                : publicText.notice
                  ? { notice: { kind: 'context', text: publicText.notice } }
                  : {}),
            }

      if (typeof review.publicAuthorName === 'string') {
        const authorName = normalizeWhitespace(review.publicAuthorName)
        if (authorName.length > 0) {
          item.authorName = authorName
        }
      }

      const response = responseByReviewId.get(review.id)
      const responseBody = typeof response?.publishedResponse?.body === 'string' ? response.publishedResponse.body : ''
      const approvedAt =
        typeof response?.publishedResponse?.approvedAt === 'string' ? response.publishedResponse.approvedAt : ''

      if (
        item.kind === 'text' &&
        isVisibleReviewResponsePubliclyReadable(review) &&
        responseBody.trim() &&
        approvedAt &&
        response?.publishedResponse?.isBlocked !== true
      ) {
        item.response = {
          body: responseBody,
          clinicName,
          approvedAt,
        }
      }

      return item
    })
    .filter((review): review is ClinicDetailReview => Boolean(review))

  return {
    totalCount: clinicReviewCount,
    items,
    hasMore: clinicReviewCount > items.length,
  }
}

function buildContactHref(slug: string, locale: UiCopyLocale): string {
  return `${CONTACT_PATHS[locale]}?clinic=${encodeURIComponent(slug)}&source=clinic-detail`
}

function mapCitiesToNameMap(cities: City[]): Map<number, string> {
  return new Map(
    cities
      .filter((item) => typeof item.name === 'string' && item.name.trim().length > 0)
      .map((item) => [item.id, item.displayName?.trim() || item.name]),
  )
}

function mapClinicFreshness({
  clinic,
  clinicTreatments,
  doctors,
  doctorSpecialties,
  approvedClinicReviews,
  reviewResponses,
  accreditations,
  cities,
}: Pick<
  ClinicDetailMappingArgs,
  | 'clinic'
  | 'clinicTreatments'
  | 'doctors'
  | 'doctorSpecialties'
  | 'approvedClinicReviews'
  | 'reviewResponses'
  | 'accreditations'
  | 'cities'
>) {
  return buildFreshnessSignals({
    updatedAt: findLatestIsoTimestampString([
      clinic.updatedAt,
      ...clinicTreatments.map((item) => item.updatedAt),
      ...doctors.map((item) => item.updatedAt),
      ...doctorSpecialties.map((item) => item.updatedAt),
      ...reviewResponses.map((item) => item.publishedResponse?.approvedAt),
      ...accreditations.map((item) => item.updatedAt),
      ...cities.map((item) => item.updatedAt),
    ]),
    latestPatientReviewAt: findLatestIsoTimestampString(approvedClinicReviews.map((review) => review.reviewDate)),
    verificationTier: toVerificationTier(clinic.verification),
    sourceCollections: [
      'accreditation',
      'cities',
      'clinics',
      'clinicMedia',
      'clinictreatments',
      'doctors',
      'doctorspecialties',
      'reviews',
      'reviewResponses',
    ],
  })
}

export function mapClinicToClinicDetailData({
  clinic,
  locale,
  heroImage,
  galleryImages,
  clinicTreatments,
  doctors,
  doctorSpecialties,
  doctorMediaByDoctorId,
  clinicReviewCount,
  approvedClinicReviews,
  reviewResponses,
  doctorReviewCounts,
  accreditations,
  cities,
}: ClinicDetailMappingArgs): ClinicDetailData {
  const contactHref = buildContactHref(clinic.slug, locale)
  const t = getClinicProfileTranslator(locale)
  const description = clinic.localizedDescription ?? (locale === 'en' ? clinic.description : undefined)
  const cityNameById = mapCitiesToNameMap(cities)

  return {
    clinicId: clinic.id,
    clinicSlug: clinic.slug,
    clinicName: clinic.name,
    breadcrumbs: [
      { label: t('navigation.home'), href: locale === 'en' ? '/en' : '/' },
      { label: t('navigation.comparison'), href: LISTING_COMPARISON_PATHS[locale] },
      { label: clinic.name, href: clinicProfilePath(clinic.slug, locale) },
    ],
    heroImage,
    galleryImages,
    description: extractLexicalPlainText(description) || t('overview.noDescription'),
    trust: mapTrust({
      clinic,
      locale,
      clinicReviewCount,
      accreditations,
    }),
    reviews: mapReviews({
      clinicReviewCount,
      approvedClinicReviews,
      reviewResponses,
      clinicName: clinic.name,
    }),
    treatments: mapTreatments(clinicTreatments),
    doctors: mapDoctors({
      doctors,
      doctorSpecialties,
      doctorReviewCounts,
      doctorMediaByDoctorId,
      contactHref,
    }),
    location: buildLocation(clinic, cityNameById, locale),
    freshness: mapClinicFreshness({
      clinic,
      clinicTreatments,
      doctors,
      doctorSpecialties,
      approvedClinicReviews,
      reviewResponses,
      accreditations,
      cities,
    }),
    contactHref,
  }
}

import baselineAccreditationsJson from '../data/baseline/accreditations.json'
import baselineCategoriesJson from '../data/baseline/categories.json'
import baselineCitiesJson from '../data/baseline/cities.json'
import baselineCountriesJson from '../data/baseline/countries.json'
import baselineGlobalsJson from '../data/baseline/globals.json'
import baselineMedicalSpecialtiesJson from '../data/baseline/medicalSpecialties.json'
import baselineTagsJson from '../data/baseline/tags.json'
import baselineTreatmentsJson from '../data/baseline/treatments.json'
import demoClinicTreatmentsJson from '../data/demo/clinicTreatments.json'
import demoClinicsJson from '../data/demo/clinics.json'
import demoDoctorSpecialtiesJson from '../data/demo/doctorSpecialties.json'
import demoDoctorTreatmentsJson from '../data/demo/doctorTreatments.json'
import demoDoctorsJson from '../data/demo/doctors.json'
import demoFavoriteClinicsJson from '../data/demo/favoriteClinics.json'
import demoPostsJson from '../data/demo/posts.json'
import demoReviewsJson from '../data/demo/reviews.json'

type SeedKind = 'baseline' | 'demo'

type SeedRecord = Record<string, unknown> & { stableId: string }

const baselineAccreditations: unknown = baselineAccreditationsJson
const baselineCategories: unknown = baselineCategoriesJson
const baselineCities: unknown = baselineCitiesJson
const baselineCountries: unknown = baselineCountriesJson
const baselineGlobals: unknown = baselineGlobalsJson
const baselineMedicalSpecialties: unknown = baselineMedicalSpecialtiesJson
const baselineTags: unknown = baselineTagsJson
const baselineTreatments: unknown = baselineTreatmentsJson

const demoClinicTreatments: unknown = demoClinicTreatmentsJson
const demoClinics: unknown = demoClinicsJson
const demoDoctorSpecialties: unknown = demoDoctorSpecialtiesJson
const demoDoctorTreatments: unknown = demoDoctorTreatmentsJson
const demoDoctors: unknown = demoDoctorsJson
const demoFavoriteClinics: unknown = demoFavoriteClinicsJson
const demoPosts: unknown = demoPostsJson
const demoReviews: unknown = demoReviewsJson

const seedFileMap: Record<SeedKind, Record<string, unknown>> = {
  baseline: {
    accreditations: baselineAccreditations,
    categories: baselineCategories,
    cities: baselineCities,
    countries: baselineCountries,
    globals: baselineGlobals,
    medicalSpecialties: baselineMedicalSpecialties,
    tags: baselineTags,
    treatments: baselineTreatments,
  },
  demo: {
    clinicTreatments: demoClinicTreatments,
    clinics: demoClinics,
    doctorSpecialties: demoDoctorSpecialties,
    doctorTreatments: demoDoctorTreatments,
    doctors: demoDoctors,
    favoriteClinics: demoFavoriteClinics,
    posts: demoPosts,
    reviews: demoReviews,
  },
}

function getSeedFile(kind: SeedKind, name: string): unknown {
  const bucket = seedFileMap[kind]
  const file = bucket?.[name]
  if (!file) {
    throw new Error(`Seed file ${kind}/${name}.json is not registered`)
  }
  return file
}

function loadSeedArray(kind: SeedKind, name: string): unknown[] {
  const parsed = getSeedFile(kind, name)
  if (!Array.isArray(parsed)) {
    throw new Error(`Seed file ${kind}/${name}.json must contain a JSON array`)
  }
  return parsed
}

function ensureStableId(value: unknown, index: number, filePath: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Seed file ${filePath} is missing stableId for item ${index}`)
  }
  return value
}

export async function loadSeedFile(kind: SeedKind, name: string): Promise<SeedRecord[]> {
  const filePath = `${kind}/${name}.json`
  const parsed = loadSeedArray(kind, name)

  const seen = new Set<string>()
  const records = parsed.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Seed file ${filePath} must contain objects, item ${index} is invalid`)
    }
    const record = item as Record<string, unknown>
    const stableId = ensureStableId(record.stableId, index, filePath)
    if (seen.has(stableId)) {
      throw new Error(`Seed file ${filePath} has duplicate stableId ${stableId}`)
    }
    seen.add(stableId)
    return { ...record, stableId } as SeedRecord
  })

  return records
}

export async function loadSeedGlobals(): Promise<unknown[]> {
  return loadSeedArray('baseline', 'globals')
}

export type { SeedKind, SeedRecord }

import { createRequire } from 'node:module'

type SeedKind = 'baseline' | 'demo'
const loadSeedJson = createRequire(import.meta.url)

// Seed-only identifier for reproducibility across environments.
// Do not use `stableId` in runtime filters, URLs, or API contracts.
type SeedRecord = Record<string, unknown> & { stableId: string }

const baselineAccreditations: unknown = loadSeedJson('../data/baseline/accreditations.json')
const baselineBasicUsers: unknown = loadSeedJson('../data/baseline/basicUsers.json')
const baselineCategories: unknown = loadSeedJson('../data/baseline/categories.json')
const baselineCities: unknown = loadSeedJson('../data/baseline/cities.json')
const baselineCountries: unknown = loadSeedJson('../data/baseline/countries.json')
const baselineGlobals: unknown = loadSeedJson('../data/baseline/globals.json')
const baselineMedicalSpecialties: unknown = loadSeedJson('../data/baseline/medicalSpecialties.json')
const baselinePlatformContentMedia: unknown = loadSeedJson('../data/baseline/platformContentMedia.json')
const baselineTags: unknown = loadSeedJson('../data/baseline/tags.json')
const baselineTreatments: unknown = loadSeedJson('../data/baseline/treatments.json')

const demoClinicMedia: unknown = loadSeedJson('../data/demo/clinicMedia.json')
const demoClinicTreatments: unknown = loadSeedJson('../data/demo/clinicTreatments.json')
const demoClinics: unknown = loadSeedJson('../data/demo/clinics.json')
const demoDoctorSpecialties: unknown = loadSeedJson('../data/demo/doctorSpecialties.json')
const demoDoctorTreatments: unknown = loadSeedJson('../data/demo/doctorTreatments.json')
const demoDoctors: unknown = loadSeedJson('../data/demo/doctors.json')
const demoFavoriteClinics: unknown = loadSeedJson('../data/demo/favoriteClinics.json')
const demoBasicUsers: unknown = loadSeedJson('../data/demo/basicUsers.json')
const demoPatients: unknown = loadSeedJson('../data/demo/patients.json')
const demoPlatformContentMedia: unknown = loadSeedJson('../data/demo/platformContentMedia.json')
const demoPosts: unknown = loadSeedJson('../data/demo/posts.json')
const demoReviews: unknown = loadSeedJson('../data/demo/reviews.json')
const demoUserProfileMedia: unknown = loadSeedJson('../data/demo/userProfileMedia.json')

type SeedFileMap = Record<SeedKind, Record<string, unknown>>

const seedFileMap: SeedFileMap = {
  baseline: {
    accreditations: baselineAccreditations,
    basicUsers: baselineBasicUsers,
    categories: baselineCategories,
    cities: baselineCities,
    countries: baselineCountries,
    globals: baselineGlobals,
    medicalSpecialties: baselineMedicalSpecialties,
    platformContentMedia: baselinePlatformContentMedia,
    tags: baselineTags,
    treatments: baselineTreatments,
  },
  demo: {
    clinicMedia: demoClinicMedia,
    clinicTreatments: demoClinicTreatments,
    clinics: demoClinics,
    doctorSpecialties: demoDoctorSpecialties,
    doctorTreatments: demoDoctorTreatments,
    doctors: demoDoctors,
    favoriteClinics: demoFavoriteClinics,
    basicUsers: demoBasicUsers,
    patients: demoPatients,
    platformContentMedia: demoPlatformContentMedia,
    posts: demoPosts,
    reviews: demoReviews,
    userProfileMedia: demoUserProfileMedia,
  },
}

function createSeedLoader(map: SeedFileMap) {
  const getSeedFile = (kind: SeedKind, name: string): unknown => {
    const bucket = map[kind]
    const file = bucket?.[name]
    if (!file) {
      throw new Error(`Seed file ${kind}/${name}.json is not registered`)
    }
    return file
  }

  const loadSeedArray = (kind: SeedKind, name: string): unknown[] => {
    const parsed = getSeedFile(kind, name)
    if (!Array.isArray(parsed)) {
      throw new Error(`Seed file ${kind}/${name}.json must contain a JSON array`)
    }
    return parsed
  }

  const loadSeedFile = async (kind: SeedKind, name: string): Promise<SeedRecord[]> => {
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

  const loadSeedGlobals = async (): Promise<unknown[]> => loadSeedArray('baseline', 'globals')

  return { loadSeedFile, loadSeedGlobals }
}

const defaultLoader = createSeedLoader(seedFileMap)

function ensureStableId(value: unknown, index: number, filePath: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Seed file ${filePath} is missing stableId for item ${index}`)
  }
  return value
}

export const loadSeedFile = defaultLoader.loadSeedFile

export const loadSeedGlobals = defaultLoader.loadSeedGlobals

export { createSeedLoader }

export type { SeedKind, SeedRecord, SeedFileMap }

import type { Payload } from 'payload'
import clinicsJson from '@/endpoints/seed/data/demo/clinics.json'
import doctorsJson from '@/endpoints/seed/data/demo/doctors.json'
import type { Clinic, Doctor } from '@/payload-types'

type ClinicLanguage = Clinic['supportedLanguages'][number]
type ClinicStatus = NonNullable<Clinic['status']>
type DoctorTitle = NonNullable<Doctor['title']>
type DoctorLanguage = Doctor['languages'][number]

type ClinicSeed = {
  name: string
  address: {
    street: string
    houseNumber: string
    zipCode: string | number
    country: string
  }
  contact?: {
    phoneNumber?: string
    email?: string
    website?: string | null
  }
  supportedLanguages?: string[]
  status?: string
}

type DoctorSeed = {
  title?: string
  firstName?: string
  lastName?: string
  fullName?: string
  qualifications?: string[]
  languages?: string[]
}

const clinicLanguages: readonly ClinicLanguage[] = [
  'german',
  'english',
  'french',
  'spanish',
  'italian',
  'turkish',
  'russian',
  'arabic',
  'chinese',
  'japanese',
  'korean',
  'portuguese',
]

const doctorLanguages: readonly DoctorLanguage[] = clinicLanguages

const clinicStatuses: readonly ClinicStatus[] = ['draft', 'pending', 'approved', 'rejected']

const doctorTitles: readonly DoctorTitle[] = ['dr', 'specialist', 'surgeon', 'assoc_prof', 'prof_dr']

function normalizeEnumArray<T extends string>(value: unknown, allowed: readonly T[], fallback: T[]): T[] {
  if (Array.isArray(value)) {
    const filtered = value.filter((item): item is T => {
      if (typeof item !== 'string') return false
      return allowed.includes(item as T)
    })
    if (filtered.length > 0) return filtered
  }
  return fallback
}

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value === 'string' && allowed.includes(value as T)) {
    return value as T
  }
  return fallback
}

function normalizeZipCode(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return 0
}

const clinicSeedData = clinicsJson as unknown as ClinicSeed[]
const doctorSeedData = doctorsJson as unknown as DoctorSeed[]

/**
 * Create a clinic (and doctor) using seed data for integration tests.
 * Ensures consistency with demo seeding without invoking full demo run.
 * @param payload Payload instance
 * @param cityId Foreign key for city relationship
 * @param opts.slugPrefix Deterministic slug prefix for later cleanup
 * @param opts.clinicIndex Index into clinic seed array
 * @param opts.doctorIndex Index into doctor seed array
 */
export async function createClinicFixture(
  payload: Payload,
  cityId: number,
  opts?: { slugPrefix?: string; clinicIndex?: number; doctorIndex?: number },
) {
  const slugBaseRaw = opts?.slugPrefix ?? 'test-clinic'
  const slugBase = slugBaseRaw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
  const clinicIndex = opts?.clinicIndex ?? 0
  const doctorIndex = opts?.doctorIndex ?? 0

  const clinicData = clinicSeedData[clinicIndex] ?? clinicSeedData[0]!
  const doctorData = doctorSeedData[doctorIndex] ?? doctorSeedData[0]!

  const clinic = await payload.create({
    collection: 'clinics',
    data: {
      name: `${slugBase}-${clinicData.name}`,
      address: {
        street: clinicData.address.street,
        houseNumber: clinicData.address.houseNumber,
        zipCode: normalizeZipCode(clinicData.address.zipCode),
        country: clinicData.address.country,
        city: cityId,
      },
      contact: {
        phoneNumber: clinicData.contact?.phoneNumber ?? '+1000000000',
        email: clinicData.contact?.email ?? `${slugBase}@example.com`,
        website: clinicData.contact?.website ?? null,
      },
      supportedLanguages: normalizeEnumArray(clinicData.supportedLanguages, clinicLanguages, ['english']),
      status: normalizeEnum(clinicData.status, clinicStatuses, 'draft'),
      slug: `${slugBase}-clinic`,
    },
    overrideAccess: true,
    depth: 0,
  })

  const doctor = await payload.create({
    collection: 'doctors',
    data: {
      title: normalizeEnum(doctorData.title, doctorTitles, 'dr'),
      firstName: doctorData.firstName ?? 'Test',
      lastName: doctorData.lastName ?? 'Doctor',
      fullName: doctorData.fullName ?? 'Dr. Test Doctor',
      clinic: clinic.id,
      qualifications: doctorData.qualifications ?? ['MD'],
      languages: normalizeEnumArray(doctorData.languages, doctorLanguages, ['english']),
      slug: `${slugBase}-doctor`,
    },
    overrideAccess: true,
    depth: 0,
  })

  return { clinic, doctor }
}

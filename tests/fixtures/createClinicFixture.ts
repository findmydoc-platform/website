import type { Payload } from 'payload'
import { clinics as clinicSeed } from '@/endpoints/seed/clinics/clinics'
import { doctors as doctorSeed } from '@/endpoints/seed/clinics/doctors'

/**
 * Creates a clinic and related doctor for integration tests using the same
 * underlying seed data as demo seeds (single source of truth).
 * You pass the cityId to satisfy the FK relation.
 */
export async function createClinicFixture(
  payload: Payload,
  cityId: number,
  opts?: { slugPrefix?: string; clinicIndex?: number; doctorIndex?: number },
) {
  const slugBase = opts?.slugPrefix ?? 'test-clinic'
  const clinicIndex = opts?.clinicIndex ?? 0
  const doctorIndex = opts?.doctorIndex ?? 0

  const clinicData = clinicSeed[clinicIndex] ?? clinicSeed[0]!
  const doctorData = doctorSeed[doctorIndex] ?? doctorSeed[0]!

  const clinic = await payload.create({
    collection: 'clinics',
    data: {
      name: `${slugBase}-${clinicData.name}`,
      address: {
        street: clinicData.address.street,
        houseNumber: clinicData.address.houseNumber,
        zipCode: clinicData.address.zipCode,
        country: clinicData.address.country,
        city: cityId,
      },
      contact: {
        phoneNumber: clinicData.contact?.phoneNumber ?? '+1000000000',
        email: clinicData.contact?.email ?? `${slugBase}@example.com`,
        website: clinicData.contact?.website ?? null,
      },
      supportedLanguages: clinicData.supportedLanguages ?? ['english'],
      status: clinicData.status ?? 'draft',
      slug: `${slugBase}-clinic`,
    },
    overrideAccess: true,
  })

  const doctor = await payload.create({
    collection: 'doctors',
    data: {
      title: doctorData.title ?? 'dr',
      firstName: doctorData.firstName ?? 'Test',
      lastName: doctorData.lastName ?? 'Doctor',
      fullName: doctorData.fullName ?? 'Dr. Test Doctor',
      clinic: clinic.id,
      qualifications: doctorData.qualifications ?? ['MD'],
      languages: doctorData.languages ?? ['english'],
      slug: `${slugBase}-doctor`,
    },
    overrideAccess: true,
  })

  return { clinic, doctor }
}

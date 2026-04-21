import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import { cleanupTrackedDocs } from '../fixtures/cleanupTrackedDocs'
import { createTinyPngFile } from '../fixtures/mediaFile'
import { buildRichText } from '../fixtures/richText'
import { approveClinicStaff, asBasicUserPayload, createClinicUserWithStaff } from '../fixtures/clinicUserFixtures'
import type { ClinicMedia, Clinictreatment, DoctorMedia, Doctortreatment, Treatment } from '@/payload-types'

vi.mock('@payloadcms/storage-s3', () => ({
  s3Storage: () => (incomingConfig: unknown) => incomingConfig,
}))

type PayloadCreateArgs = Parameters<Payload['create']>[0]

function expectRelationObject(value: unknown): Record<string, unknown> {
  expect(value).toBeTruthy()
  expect(typeof value).toBe('object')
  expect(Array.isArray(value)).toBe(false)

  return value as Record<string, unknown>
}

describe('Medical network defaultPopulate', () => {
  let payload: Payload
  let cityId: number
  let medicalSpecialtyId: number
  const slugPrefix = testSlug('medicalNetwork.defaultPopulate.test.ts')

  const createdClinicTreatmentIds: Array<number> = []
  const createdDoctorTreatmentIds: Array<number> = []
  const createdClinicMediaIds: Array<number> = []
  const createdDoctorMediaIds: Array<number> = []
  const createdClinicStaffIds: Array<number> = []
  const createdBasicUserIds: Array<number> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true, depth: 0 })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for defaultPopulate tests')
    cityId = cityDoc.id as number

    const specialtyRes = await payload.find({
      collection: 'medical-specialties',
      limit: 1,
      overrideAccess: true,
      depth: 0,
    })
    const specialtyDoc = specialtyRes.docs[0]
    if (!specialtyDoc) throw new Error('Expected baseline medical specialty for defaultPopulate tests')
    medicalSpecialtyId = specialtyDoc.id as number
  }, 60000)

  afterEach(async () => {
    await cleanupTrackedDocs(payload, [
      { collection: 'doctortreatments', ids: createdDoctorTreatmentIds },
      { collection: 'clinictreatments', ids: createdClinicTreatmentIds },
      { collection: 'doctorMedia', ids: createdDoctorMediaIds },
      { collection: 'clinicMedia', ids: createdClinicMediaIds },
      { collection: 'clinicStaff', ids: createdClinicStaffIds },
      { collection: 'basicUsers', ids: createdBasicUserIds },
    ])

    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
    await cleanupTestEntities(payload, 'treatments', slugPrefix)
  })

  it('populates clinic and treatment relations with display defaults', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-clinic-treatment` })

    const treatment = (await payload.create({
      collection: 'treatments',
      data: {
        name: `${slugPrefix}-clinic-treatment-card`,
        description: buildRichText('Display-friendly treatment summary'),
        medicalSpecialty: medicalSpecialtyId,
        averagePrice: 2100,
        averageRating: 4.4,
      },
      overrideAccess: true,
      depth: 0,
    })) as Treatment

    const { basicUser, clinicStaff } = await createClinicUserWithStaff(payload, {
      slugPrefix,
      suffix: 'clinic-treatment',
      createdBasicUserIds,
      createdClinicStaffIds,
    })

    await approveClinicStaff(payload, clinicStaff.id, clinic.id as number)

    const clinicMedia = (await payload.create({
      collection: 'clinicMedia',
      data: {
        alt: 'Clinic card image',
        clinic: clinic.id,
      } as Partial<ClinicMedia>,
      file: createTinyPngFile(`${slugPrefix}-clinic-card.png`),
      user: asBasicUserPayload(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicMedia

    createdClinicMediaIds.push(clinicMedia.id)

    await payload.update({
      collection: 'clinics',
      id: clinic.id,
      data: {
        averageRating: 4.8,
        verification: 'gold',
        thumbnail: clinicMedia.id,
      },
      overrideAccess: true,
      depth: 0,
    })

    const clinicTreatment = (await payload.create({
      collection: 'clinictreatments',
      data: {
        clinic: clinic.id,
        treatment: treatment.id,
        price: 2200,
      },
      overrideAccess: true,
      depth: 0,
    })) as Clinictreatment

    createdClinicTreatmentIds.push(clinicTreatment.id)

    const hydrated = (await payload.findByID({
      collection: 'clinictreatments',
      id: clinicTreatment.id,
      overrideAccess: true,
      depth: 2,
    })) as Clinictreatment

    const populatedClinic = expectRelationObject(hydrated.clinic)
    expect(populatedClinic.name).toBe(clinic.name)
    expect(populatedClinic.slug).toBe(clinic.slug)
    expect(populatedClinic.averageRating).toBe(4.8)
    expect(populatedClinic.verification).toBe('gold')

    const clinicAddress = expectRelationObject(populatedClinic.address)
    expect(clinicAddress.country).toBe(clinic.address.country)
    expect(clinicAddress).not.toHaveProperty('street')
    expect(clinicAddress).not.toHaveProperty('houseNumber')

    const populatedThumbnail = expectRelationObject(populatedClinic.thumbnail)
    expect(populatedThumbnail.alt).toBe('Clinic card image')
    expect(typeof populatedThumbnail.url).toBe('string')
    expect(typeof populatedThumbnail.filename).toBe('string')

    expect(populatedClinic).not.toHaveProperty('contact')
    expect(populatedClinic).not.toHaveProperty('supportedLanguages')

    const populatedTreatment = expectRelationObject(hydrated.treatment)
    expect(populatedTreatment.name).toBe(treatment.name)
    expect(populatedTreatment.averagePrice).toBe(2200)
    expect(populatedTreatment.averageRating).toBe(4.4)

    const populatedSpecialty = expectRelationObject(populatedTreatment.medicalSpecialty)
    expect(typeof populatedSpecialty.name).toBe('string')

    expect(populatedTreatment).not.toHaveProperty('description')
    expect(populatedTreatment).not.toHaveProperty('tags')
  })

  it('populates doctor relations with display defaults', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-doctor` })

    const treatment = (await payload.create({
      collection: 'treatments',
      data: {
        name: `${slugPrefix}-doctor-card`,
        description: buildRichText('Doctor treatment relation fixture'),
        medicalSpecialty: medicalSpecialtyId,
      },
      overrideAccess: true,
      depth: 0,
    })) as Treatment

    const { basicUser, clinicStaff } = await createClinicUserWithStaff(payload, {
      slugPrefix,
      suffix: 'doctor',
      createdBasicUserIds,
      createdClinicStaffIds,
    })

    await approveClinicStaff(payload, clinicStaff.id, clinic.id as number)

    const doctorMedia = (await payload.create({
      collection: 'doctorMedia',
      data: {
        alt: 'Doctor portrait',
        doctor: doctor.id,
      } as Partial<DoctorMedia>,
      file: createTinyPngFile(`${slugPrefix}-doctor-card.png`),
      user: asBasicUserPayload(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as DoctorMedia

    createdDoctorMediaIds.push(doctorMedia.id)

    await payload.update({
      collection: 'doctors',
      id: doctor.id,
      data: {
        averageRating: 4.7,
        profileImage: doctorMedia.id,
      },
      overrideAccess: true,
      depth: 0,
    })

    const doctorTreatment = (await payload.create({
      collection: 'doctortreatments',
      data: {
        doctor: doctor.id,
        treatment: treatment.id,
        specializationLevel: 'specialist',
      },
      overrideAccess: true,
      depth: 0,
    })) as Doctortreatment

    createdDoctorTreatmentIds.push(doctorTreatment.id)

    const hydrated = (await payload.findByID({
      collection: 'doctortreatments',
      id: doctorTreatment.id,
      overrideAccess: true,
      depth: 2,
    })) as Doctortreatment

    const populatedDoctor = expectRelationObject(hydrated.doctor)
    expect(populatedDoctor.fullName).toBe(doctor.fullName)
    expect(populatedDoctor.firstName).toBe(doctor.firstName)
    expect(populatedDoctor.lastName).toBe(doctor.lastName)
    expect(populatedDoctor.slug).toBe(doctor.slug)
    expect(populatedDoctor.gender).toBe(doctor.gender)
    expect(populatedDoctor.averageRating).toBe(4.7)

    const populatedProfileImage = expectRelationObject(populatedDoctor.profileImage)
    expect(populatedProfileImage.alt).toBe('Doctor portrait')
    expect(typeof populatedProfileImage.url).toBe('string')
    expect(typeof populatedProfileImage.filename).toBe('string')

    expect(populatedDoctor).not.toHaveProperty('biography')
    expect(populatedDoctor).not.toHaveProperty('languages')
    expect(populatedDoctor).not.toHaveProperty('qualifications')
    expect(populatedDoctor).not.toHaveProperty('clinic')
  })
})

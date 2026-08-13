import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload } from 'payload'

import config from '@payload-config'
import { updateClinicTreatment } from '@/features/clinicDashboard/treatments/service'
import { buildRichText } from '../fixtures/richText'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'

vi.mock('@payloadcms/storage-s3', () => ({
  s3Storage: () => (incomingConfig: unknown) => incomingConfig,
}))

describe('Clinic Dashboard treatment concurrency', () => {
  let payload: Payload
  let clinicId: number
  let doctorId: number
  let offeringId: number
  let treatmentId: number
  const name = `${testSlug('clinicDashboardTreatments.concurrency.test.ts')}-treatment`

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const [cityResult, specialtyResult] = await Promise.all([
      payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true }),
      payload.find({ collection: 'medical-specialties', depth: 0, limit: 1, overrideAccess: true }),
    ])
    const city = cityResult.docs[0]
    const specialty = specialtyResult.docs[0]
    if (!city || !specialty) throw new Error('Expected baseline city and medical specialty')
    const fixture = await createClinicFixture(payload, city.id, { slugPrefix: name })
    clinicId = fixture.clinic.id
    doctorId = fixture.doctor.id

    const treatment = await payload.create({
      collection: 'treatments',
      data: {
        description: buildRichText('Concurrency test treatment'),
        medicalSpecialty: specialty.id,
        name,
      },
      depth: 0,
      overrideAccess: true,
    })
    treatmentId = treatment.id

    const offering = await payload.create({
      collection: 'clinictreatments',
      data: {
        active: false,
        clinic: clinicId,
        price: 100,
        treatment: treatment.id,
      },
      depth: 0,
      overrideAccess: true,
    })
    offeringId = offering.id
  }, 60_000)

  afterAll(async () => {
    if (!payload) return
    if (offeringId) await payload.delete({ collection: 'clinictreatments', id: offeringId, overrideAccess: true })
    if (doctorId) await payload.delete({ collection: 'doctors', id: doctorId, overrideAccess: true })
    if (clinicId) await payload.delete({ collection: 'clinics', id: clinicId, overrideAccess: true })
    if (treatmentId) await payload.delete({ collection: 'treatments', id: treatmentId, overrideAccess: true })
  })

  it('allows only one of two updates that start from the same revision', async () => {
    const initial = await payload.findByID({
      collection: 'clinictreatments',
      depth: 0,
      id: offeringId,
      overrideAccess: true,
    })
    const [firstReq, secondReq] = await Promise.all([createLocalReq({}, payload), createLocalReq({}, payload)])

    const results = await Promise.allSettled([
      updateClinicTreatment(firstReq, clinicId, {
        active: true,
        expectedRevision: initial.updatedAt,
        offeringId: String(initial.id),
        priceEUR: 110,
      }),
      updateClinicTreatment(secondReq, clinicId, {
        active: true,
        expectedRevision: initial.updatedAt,
        offeringId: String(initial.id),
        priceEUR: 120,
      }),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((result) => result.status === 'rejected')
    expect(rejected).toMatchObject({ reason: { kind: 'conflict' }, status: 'rejected' })

    const stored = await payload.findByID({
      collection: 'clinictreatments',
      depth: 0,
      id: offeringId,
      overrideAccess: true,
    })
    expect([110, 120]).toContain(stored.price)
  })
})

import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'

const createdClinicTreatmentIds: Array<string | number> = []

describe('Clinic treatment average price hooks', () => {
  let payload: Payload
  let cityId: number
  let treatmentId: number
  const slugPrefix = testSlug('clinicTreatments.averagePrice.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for clinic treatment tests')
    cityId = cityDoc.id as number

    const treatmentRes = await payload.find({ collection: 'treatments', limit: 1, overrideAccess: true })
    const treatmentDoc = treatmentRes.docs[0]
    if (!treatmentDoc) throw new Error('Expected baseline treatment for clinic treatment tests')
    treatmentId = treatmentDoc.id as number
  }, 60000)

  afterEach(async () => {
    while (createdClinicTreatmentIds.length) {
      const id = createdClinicTreatmentIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'clinictreatments', id, overrideAccess: true })
      } catch {}
    }

    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  it('recalculates average price when clinic treatments are created and deleted', async () => {
    const { clinic: firstClinic } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-a`,
    })
    const { clinic: secondClinic } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-b`,
      clinicIndex: 1,
      doctorIndex: 1,
    })

    const firstTreatment = await payload.create({
      collection: 'clinictreatments',
      data: {
        clinic: firstClinic.id,
        treatment: treatmentId,
        price: 100,
      },
      overrideAccess: true,
    })
    createdClinicTreatmentIds.push(firstTreatment.id)

    const treatmentAfterFirst = await payload.findByID({
      collection: 'treatments',
      id: treatmentId,
      overrideAccess: true,
    })
    expect(treatmentAfterFirst.averagePrice).toBeCloseTo(100, 5)

    const secondTreatment = await payload.create({
      collection: 'clinictreatments',
      data: {
        clinic: secondClinic.id,
        treatment: treatmentId,
        price: 200,
      },
      overrideAccess: true,
    })
    createdClinicTreatmentIds.push(secondTreatment.id)

    const treatmentAfterSecond = await payload.findByID({
      collection: 'treatments',
      id: treatmentId,
      overrideAccess: true,
    })
    expect(treatmentAfterSecond.averagePrice).toBeCloseTo(150, 5)

    await payload.delete({ collection: 'clinictreatments', id: firstTreatment.id, overrideAccess: true })
    createdClinicTreatmentIds.splice(createdClinicTreatmentIds.indexOf(firstTreatment.id), 1)

    const treatmentAfterDeleteOne = await payload.findByID({
      collection: 'treatments',
      id: treatmentId,
      overrideAccess: true,
    })
    expect(treatmentAfterDeleteOne.averagePrice).toBeCloseTo(200, 5)

    await payload.delete({ collection: 'clinictreatments', id: secondTreatment.id, overrideAccess: true })
    const indexSecond = createdClinicTreatmentIds.indexOf(secondTreatment.id)
    if (indexSecond !== -1) createdClinicTreatmentIds.splice(indexSecond, 1)

    const treatmentAfterDeleteTwo = await payload.findByID({
      collection: 'treatments',
      id: treatmentId,
      overrideAccess: true,
    })
    expect(treatmentAfterDeleteTwo.averagePrice ?? null).toBeNull()
  }, 60000)

  it('includes zero-priced clinic treatments in average calculation (integration)', async () => {
    // create one clinic treatment with zero price and one with 100
    const { clinic: zeroClinic } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-zero`,
    })
    const { clinic: hundredClinic } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-hundred`,
      clinicIndex: 1,
      doctorIndex: 1,
    })

    const zeroTreatment = await payload.create({
      collection: 'clinictreatments',
      data: { clinic: zeroClinic.id, treatment: treatmentId, price: 0 },
      overrideAccess: true,
    })
    createdClinicTreatmentIds.push(zeroTreatment.id)

    const hundredTreatment = await payload.create({
      collection: 'clinictreatments',
      data: { clinic: hundredClinic.id, treatment: treatmentId, price: 100 },
      overrideAccess: true,
    })
    createdClinicTreatmentIds.push(hundredTreatment.id)

    const treatmentAfter = await payload.findByID({ collection: 'treatments', id: treatmentId, overrideAccess: true })
    expect(treatmentAfter.averagePrice).toBeCloseTo(50, 5)

    // cleanup created entries
    await payload.delete({ collection: 'clinictreatments', id: zeroTreatment.id, overrideAccess: true })
    await payload.delete({ collection: 'clinictreatments', id: hundredTreatment.id, overrideAccess: true })
  }, 60000)
})

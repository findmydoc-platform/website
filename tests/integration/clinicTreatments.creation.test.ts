/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import type { BasicUser, Treatment } from '@/payload-types'

const createdClinicTreatmentIds: Array<string | number> = []
const createdBasicUserIds: Array<number> = []

describe('ClinicTreatments Creation and Hooks Integration Tests', () => {
  let payload: Payload
  let cityId: number
  let treatmentId: number
  let secondTreatmentId: number
  const slugPrefix = testSlug('clinicTreatments.creation.test.ts')

  const createClinicUser = async (emailPrefix: string, clinicId: number) => {
    const basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: `${emailPrefix}@example.com`,
        userType: 'clinic',
        firstName: 'Clinic',
        lastName: 'Tester',
        supabaseUserId: `sb-${emailPrefix}`,
      },
      overrideAccess: true,
      depth: 0,
    })) as BasicUser

    createdBasicUserIds.push(basicUser.id)

    return {
      ...basicUser,
      collection: 'basicUsers' as const,
      clinicId,
    }
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true, depth: 0 })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for clinic treatment tests')
    cityId = cityDoc.id as number

    const treatmentRes = await payload.find({ collection: 'treatments', limit: 2, overrideAccess: true, depth: 0 })
    const treatmentDoc = treatmentRes.docs[0]
    const secondTreatmentDoc = treatmentRes.docs[1]
    if (!treatmentDoc || !secondTreatmentDoc) {
      throw new Error('Expected at least 2 baseline treatments for clinic treatment tests')
    }
    treatmentId = treatmentDoc.id as number
    secondTreatmentId = secondTreatmentDoc.id as number
  }, 60000)

  afterEach(async () => {
    // Clean up created clinic treatments
    while (createdClinicTreatmentIds.length) {
      const id = createdClinicTreatmentIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'clinictreatments', id, overrideAccess: true })
      } catch {}
    }

    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)

    while (createdBasicUserIds.length) {
      const id = createdBasicUserIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'basicUsers', id, overrideAccess: true })
      } catch {}
    }
  })

  it('creates a clinic treatment with required fields', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })

    const clinicTreatment = await payload.create({
      collection: 'clinictreatments',
      data: {
        clinic: clinic.id,
        treatment: treatmentId,
        price: 1500,
      },
      overrideAccess: true,
      depth: 0,
    })

    createdClinicTreatmentIds.push(clinicTreatment.id)

    expect(clinicTreatment.id).toBeDefined()
    expect(clinicTreatment.clinic).toBe(clinic.id)
    expect(clinicTreatment.treatment).toBe(treatmentId)
    expect(clinicTreatment.price).toBe(1500)
  })

  it('validates required fields when creating clinic treatment', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })

    await expect(
      payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: clinic.id,
          // Missing required treatment and price
        } as any,
        overrideAccess: true,
        depth: 0,
      }),
    ).rejects.toThrow()
  })

  it('enforces unique constraint on clinic-treatment combination', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })

    const firstTreatment = await payload.create({
      collection: 'clinictreatments',
      data: {
        clinic: clinic.id,
        treatment: treatmentId,
        price: 1000,
      },
      overrideAccess: true,
      depth: 0,
    })

    createdClinicTreatmentIds.push(firstTreatment.id)

    // Try to create duplicate clinic-treatment combination
    await expect(
      payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: clinic.id,
          treatment: treatmentId,
          price: 2000,
        },
        overrideAccess: true,
        depth: 0,
      }),
    ).rejects.toThrow()
  })

  it('updates treatment average price after creating clinic treatment (hook test)', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-hook-create`,
    })

    // Get initial treatment state
    const treatmentBefore = await payload.findByID({
      collection: 'treatments',
      id: treatmentId,
      overrideAccess: true,
      depth: 0,
    })

    const initialAvgPrice = treatmentBefore.averagePrice

    // Create clinic treatment
    const clinicTreatment = await payload.create({
      collection: 'clinictreatments',
      data: {
        clinic: clinic.id,
        treatment: treatmentId,
        price: 5000,
      },
      overrideAccess: true,
      depth: 0,
    })

    createdClinicTreatmentIds.push(clinicTreatment.id)

    // Check that the treatment's average price was updated by the hook
    const treatmentAfter = await payload.findByID({
      collection: 'treatments',
      id: treatmentId,
      overrideAccess: true,
    })

    expect(treatmentAfter.averagePrice).toBeDefined()
    // The average should have changed from initial state
    if (initialAvgPrice === null || initialAvgPrice === undefined) {
      expect(treatmentAfter.averagePrice).toBeCloseTo(5000, 5)
    } else {
      expect(treatmentAfter.averagePrice).not.toBe(initialAvgPrice)
    }
  })

  it('updates treatment average price after updating clinic treatment (hook test)', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-hook-update`,
    })

    // Create initial clinic treatment
    const clinicTreatment = await payload.create({
      collection: 'clinictreatments',
      data: {
        clinic: clinic.id,
        treatment: secondTreatmentId,
        price: 3000,
      },
      overrideAccess: true,
    })

    createdClinicTreatmentIds.push(clinicTreatment.id)

    // Get treatment state after initial create
    const treatmentAfterCreate = await payload.findByID({
      collection: 'treatments',
      id: secondTreatmentId,
      overrideAccess: true,
    })

    const avgPriceAfterCreate = treatmentAfterCreate.averagePrice

    // Update clinic treatment price
    await payload.update({
      collection: 'clinictreatments',
      id: clinicTreatment.id,
      data: {
        price: 6000,
      },
      overrideAccess: true,
    })

    // Check that the treatment's average price was updated by the hook
    const treatmentAfterUpdate = await payload.findByID({
      collection: 'treatments',
      id: secondTreatmentId,
      overrideAccess: true,
    })

    expect(treatmentAfterUpdate.averagePrice).toBeDefined()
    expect(treatmentAfterUpdate.averagePrice).not.toBe(avgPriceAfterCreate)
  })

  it('updates treatment average price after deleting clinic treatment (hook test)', async () => {
    const { clinic: clinic1 } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-hook-delete-1`,
    })
    const { clinic: clinic2 } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-hook-delete-2`,
      clinicIndex: 1,
      doctorIndex: 1,
    })

    // Create two clinic treatments for the same treatment
    const clinicTreatment1 = await payload.create({
      collection: 'clinictreatments',
      data: {
        clinic: clinic1.id,
        treatment: treatmentId,
        price: 2000,
      },
      overrideAccess: true,
    })
    createdClinicTreatmentIds.push(clinicTreatment1.id)

    const clinicTreatment2 = await payload.create({
      collection: 'clinictreatments',
      data: {
        clinic: clinic2.id,
        treatment: treatmentId,
        price: 4000,
      },
      overrideAccess: true,
    })
    createdClinicTreatmentIds.push(clinicTreatment2.id)

    // Get treatment state with both clinic treatments
    const treatmentBefore = await payload.findByID({
      collection: 'treatments',
      id: treatmentId,
      overrideAccess: true,
    })

    // Average should be (2000 + 4000) / 2 = 3000
    expect(treatmentBefore.averagePrice).toBeCloseTo(3000, 5)

    // Delete one clinic treatment
    await payload.delete({
      collection: 'clinictreatments',
      id: clinicTreatment1.id,
      overrideAccess: true,
    })
    createdClinicTreatmentIds.splice(createdClinicTreatmentIds.indexOf(clinicTreatment1.id), 1)

    // Check that the treatment's average price was updated by the hook
    const treatmentAfter = await payload.findByID({
      collection: 'treatments',
      id: treatmentId,
      overrideAccess: true,
    })

    // Average should now be just 4000
    expect(treatmentAfter.averagePrice).toBeCloseTo(4000, 5)
  })

  it('allows multiple clinics to offer the same treatment with different prices', async () => {
    const { clinic: clinic1 } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-multi-1`,
    })
    const { clinic: clinic2 } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-multi-2`,
      clinicIndex: 1,
      doctorIndex: 1,
    })

    const ct1 = await payload.create({
      collection: 'clinictreatments',
      data: {
        clinic: clinic1.id,
        treatment: treatmentId,
        price: 1000,
      },
      overrideAccess: true,
    })

    const ct2 = await payload.create({
      collection: 'clinictreatments',
      data: {
        clinic: clinic2.id,
        treatment: treatmentId,
        price: 2000,
      },
      overrideAccess: true,
    })

    createdClinicTreatmentIds.push(ct1.id, ct2.id)

    expect(ct1.id).toBeDefined()
    expect(ct2.id).toBeDefined()
    expect(ct1.price).toBe(1000)
    expect(ct2.price).toBe(2000)
  })

  it('blocks clinic users from deleting clinic treatments (platform-only delete)', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })

    const clinicTreatment = await payload.create({
      collection: 'clinictreatments',
      data: {
        clinic: clinic.id,
        treatment: treatmentId,
        price: 1200,
      },
      overrideAccess: true,
      depth: 0,
    })

    createdClinicTreatmentIds.push(clinicTreatment.id)

    const clinicUser = await createClinicUser(`${slugPrefix}-clinic-delete`, clinic.id as number)

    await expect(
      payload.delete({
        collection: 'clinictreatments',
        id: clinicTreatment.id,
        user: clinicUser,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('includes clinic treatments in the Treatment join list', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-join`,
    })

    const clinicTreatment = await payload.create({
      collection: 'clinictreatments',
      data: {
        clinic: clinic.id,
        treatment: secondTreatmentId,
        price: 2200,
      },
      overrideAccess: true,
      depth: 0,
    })

    createdClinicTreatmentIds.push(clinicTreatment.id)

    const hydratedTreatment = (await payload.findByID({
      collection: 'treatments',
      id: secondTreatmentId,
      overrideAccess: true,
      depth: 2,
      joins: {
        Clinics: {
          limit: 10,
        },
      },
    })) as Treatment

    const clinicTreatmentIds = (hydratedTreatment.Clinics?.docs ?? []).map((doc) =>
      typeof doc === 'object' ? doc.id : doc,
    )

    expect(clinicTreatmentIds).toContain(clinicTreatment.id)
  })

  it('updates clinic treatment price', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })

    const clinicTreatment = await payload.create({
      collection: 'clinictreatments',
      data: {
        clinic: clinic.id,
        treatment: treatmentId,
        price: 1500,
      },
      overrideAccess: true,
    })

    createdClinicTreatmentIds.push(clinicTreatment.id)

    const updated = await payload.update({
      collection: 'clinictreatments',
      id: clinicTreatment.id,
      data: {
        price: 2500,
      },
      overrideAccess: true,
    })

    expect(updated.id).toBe(clinicTreatment.id)
    expect(updated.price).toBe(2500)
  })

  it('includes zero-priced treatments in average calculation', async () => {
    const { clinic: clinic1 } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-zero-1`,
    })
    const { clinic: clinic2 } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-zero-2`,
      clinicIndex: 1,
      doctorIndex: 1,
    })

    const ct1 = await payload.create({
      collection: 'clinictreatments',
      data: {
        clinic: clinic1.id,
        treatment: secondTreatmentId,
        price: 0, // Free treatment
      },
      overrideAccess: true,
    })

    const ct2 = await payload.create({
      collection: 'clinictreatments',
      data: {
        clinic: clinic2.id,
        treatment: secondTreatmentId,
        price: 1000,
      },
      overrideAccess: true,
    })

    createdClinicTreatmentIds.push(ct1.id, ct2.id)

    const treatment = await payload.findByID({
      collection: 'treatments',
      id: secondTreatmentId,
      overrideAccess: true,
    })

    // Average should be (0 + 1000) / 2 = 500
    expect(treatment.averagePrice).toBeCloseTo(500, 5)
  })
})

import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import type { City } from '@/payload-types'

describe('Clinic Integration Tests (fixtures)', () => {
  let payload: Payload
  const slugPrefix = testSlug('clinic.test.ts')
  let cities: City[] = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const res = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    cities = res.docs
  })

  afterEach(async () => {
    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  it('creates a clinic and doctor via fixture', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cities[0]!.id as number, {
      slugPrefix,
    })
    expect(clinic?.id).toBeDefined()
    expect(doctor?.id).toBeDefined()
  })
})

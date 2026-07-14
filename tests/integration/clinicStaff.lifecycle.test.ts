import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'

describe('ClinicStaff lifecycle integration', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('clinicStaff.lifecycle.test.ts')
  const staffIds: number[] = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const city = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    if (!city.docs[0]) throw new Error('Expected a baseline city')
    cityId = city.docs[0].id
  })

  afterEach(async () => {
    while (staffIds.length) {
      const id = staffIds.pop()
      if (id) await payload.delete({ collection: 'clinicStaff', id, overrideAccess: true }).catch(() => undefined)
    }
  })

  it('requires both approval and clinic assignment for clinic access', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })
    const staff = await payload.create({
      collection: 'clinicStaff',
      data: {
        email: `${slugPrefix}-pending@example.com`,
        firstName: 'Clinic',
        lastName: 'Staff',
        status: 'pending',
        supabaseUserId: `sb-${slugPrefix}-pending`,
      },
      overrideAccess: true,
    })
    staffIds.push(staff.id)

    const approved = await payload.update({
      collection: 'clinicStaff',
      id: staff.id,
      data: { clinic: clinic.id, status: 'approved' },
      overrideAccess: true,
    })

    expect(approved.status).toBe('approved')
    expect(typeof approved.clinic === 'object' ? approved.clinic?.id : approved.clinic).toBe(clinic.id)
  })

  it('rejects a duplicate Supabase identity', async () => {
    const identity = `sb-${slugPrefix}-duplicate`
    const first = await payload.create({
      collection: 'clinicStaff',
      data: {
        email: `${slugPrefix}-one@example.com`,
        firstName: 'One',
        lastName: 'Staff',
        status: 'pending',
        supabaseUserId: identity,
      },
      overrideAccess: true,
    })
    staffIds.push(first.id)

    await expect(
      payload.create({
        collection: 'clinicStaff',
        data: {
          email: `${slugPrefix}-two@example.com`,
          firstName: 'Two',
          lastName: 'Staff',
          status: 'pending',
          supabaseUserId: identity,
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/already assigned|unique|duplicate/i)
  })
})

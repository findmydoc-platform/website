import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { asClinicScopedPayloadUser, createClinicTestUser, cleanupTrackedUsers } from '../fixtures/testUsers'
import { testSlug } from '../fixtures/testSlug'
import { readClinicAccessState } from '@/auth/utilities/clinicAccessState'

describe('native clinic account evidence boundary', () => {
  let payload: Payload
  let cityId: number
  const clinicIds: number[] = []
  const doctorIds: number[] = []
  const staffIds: Array<number | string> = []
  const prefix = testSlug('clinicAccountCompletion.lifecycle.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const cities = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true, depth: 0 })
    cityId = cities.docs[0]!.id
  })

  afterEach(async () => {
    await cleanupTrackedUsers(payload, { staffIds })
    for (const id of doctorIds.splice(0)) await payload.delete({ collection: 'doctors', id, overrideAccess: true })
    for (const id of clinicIds.splice(0)) await payload.delete({ collection: 'clinics', id, overrideAccess: true })
  })

  it('accepts signed synthetic legacy evidence through real hooks and keeps unpublished access private', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, { slugPrefix: prefix })
    clinicIds.push(clinic.id)
    doctorIds.push(doctor.id)
    await payload.update({ collection: 'clinics', id: clinic.id, data: { status: 'approved' }, overrideAccess: true })
    const staff = await createClinicTestUser(payload, { emailPrefix: prefix, createdStaffIds: staffIds })
    expect(await readClinicAccessState(payload, staff.id)).toBeNull()
    await asClinicScopedPayloadUser(payload, staff, clinic.id)
    const stored = await payload.findByID({ collection: 'clinicStaff', id: staff.id, overrideAccess: true, depth: 0 })
    expect(stored.accountCompletion).toMatchObject({
      source: 'legacy-audit',
      subject: staff.supabaseUserId,
      clinicId: String(clinic.id),
    })
    expect(stored.legacyAccess?.initialParticipant).toBe(false)
    expect(await readClinicAccessState(payload, staff.id)).not.toBeNull()
    const updated = await payload.update({
      collection: 'clinicStaff',
      id: staff.id,
      data: { firstName: 'Updated' },
      context: { skipClinicStaffAuthSync: true },
      overrideAccess: true,
      depth: 0,
    })
    expect(updated.accountCompletion).toEqual(stored.accountCompletion)
    expect(updated.legacyAccess).toEqual(stored.legacyAccess)
    await expect(
      payload.update({
        collection: 'clinicStaff',
        id: staff.id,
        data: { accountCompletion: { ...stored.accountCompletion, subject: 'forged' } },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
    await payload.update({ collection: 'clinics', id: clinic.id, data: { status: 'pending' }, overrideAccess: true })
    expect(await readClinicAccessState(payload, staff.id)).not.toBeNull()
    const publicRead = await payload.find({
      collection: 'clinics',
      where: { id: { equals: clinic.id } },
      overrideAccess: false,
      depth: 0,
    })
    expect(publicRead.docs).toHaveLength(0)
    await payload.update({
      collection: 'clinics',
      id: clinic.id,
      data: { participationStatus: 'disabled' },
      overrideAccess: true,
    })
    expect(await readClinicAccessState(payload, staff.id)).toBeNull()
  })
})

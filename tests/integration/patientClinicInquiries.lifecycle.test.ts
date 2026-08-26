import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import config from '@payload-config'
import type { PatientClinicInquiry } from '@/payload-types'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import {
  asClinicScopedPayloadUser,
  asPayloadStaffUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPlatformTestUser,
} from '../fixtures/testUsers'

describe('PatientClinicInquiries lifecycle integration', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('patientClinicInquiries.lifecycle.test.ts')
  const createdInquiryIds: Array<number | string> = []
  const createdStaffIds: Array<number | string> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const city = (await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })).docs[0]
    if (!city) throw new Error('Expected baseline city for patient clinic inquiry tests')
    cityId = city.id as number
  }, 60_000)

  afterEach(async () => {
    while (createdInquiryIds.length) {
      const id = createdInquiryIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'patientClinicInquiries', id, overrideAccess: true })
      } catch {}
    }
    await cleanupTrackedUsers(payload, { staffIds: createdStaffIds })
    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  const createTarget = async (suffix: string) =>
    createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-${suffix}` })

  const originalData = (clinicId: number, doctorId: number, suffix: string) => ({
    clinic: clinicId,
    consent: {
      accepted: true,
      acceptedAt: '2026-08-24T10:00:00.000Z',
      text: 'Synthetic consent.',
    },
    doctor: doctorId,
    email: `${slugPrefix}-${suffix}@example.com`,
    fullName: `Synthetic ${suffix}`,
    message: 'Synthetic original inquiry text.',
    phoneNumber: '+49301234567',
    preferredContactWindow: 'morning' as const,
    status: 'submitted' as const,
    treatmentTimeline: 'within_two_weeks' as const,
  })

  const createLegacyInquiry = async (suffix: string, status: 'closed' | 'submitted' = 'submitted') => {
    const { clinic, doctor } = await createTarget(suffix)
    const inquiry = (await payload.create({
      collection: 'patientClinicInquiries',
      context: { inquiryCommunicationCommand: true },
      data: { ...originalData(clinic.id, doctor.id, suffix), status },
      depth: 0,
      overrideAccess: true,
    })) as PatientClinicInquiry
    createdInquiryIds.push(inquiry.id)
    return { clinic, doctor, inquiry }
  }

  it('keeps legacy state lossless and nullable until the dedicated cutover', async () => {
    const { inquiry } = await createLegacyInquiry('legacy-closed', 'closed')

    expect(inquiry.status).toBe('closed')
    expect(inquiry.handlingStatus).toBeNull()
    expect(inquiry.lifecycle).toBeNull()
    expect(inquiry.revision).toBeNull()
    expect(inquiry.activitySequence).toBeNull()
    expect(inquiry.clinicNotificationSequence).toBeNull()
  })

  it('initializes every new guest aggregate explicitly without creating a patient binding', async () => {
    const { clinic, doctor } = await createTarget('new-guest')
    const now = '2026-08-24T10:00:00.000Z'
    const inquiry = (await payload.create({
      collection: 'patientClinicInquiries',
      context: { inquiryCommunicationCommand: true },
      data: {
        ...originalData(clinic.id, doctor.id, 'new-guest'),
        activitySequence: 1,
        clinicNotificationSequence: 1,
        clinicUnreadEpoch: 0,
        clinicUnreadFloor: 0,
        externalSequence: 0,
        handlingStatus: 'submitted',
        lastActivityAt: now,
        lifecycle: 'open',
        revision: 0,
      },
      depth: 0,
      overrideAccess: true,
    })) as PatientClinicInquiry
    createdInquiryIds.push(inquiry.id)

    expect(inquiry).toMatchObject({
      activitySequence: 1,
      clinicNotificationSequence: 1,
      clinicUnreadEpoch: 0,
      clinicUnreadFloor: 0,
      externalSequence: 0,
      handlingStatus: 'submitted',
      lifecycle: 'open',
      patient: null,
      revision: 0,
      status: 'submitted',
    })
  })

  it('denies generic CRUD to platform and clinic roles', async () => {
    const { clinic, doctor, inquiry } = await createLegacyInquiry('closed-access')
    const platform = await createPlatformTestUser(payload, {
      createdStaffIds,
      emailPrefix: `${slugPrefix}-platform`,
    })
    const clinicStaff = await createClinicTestUser(payload, {
      createdStaffIds,
      emailPrefix: `${slugPrefix}-clinic`,
    })
    const clinicUser = await asClinicScopedPayloadUser(payload, clinicStaff, clinic.id)

    for (const user of [asPayloadStaffUser(platform), clinicUser]) {
      await expect(
        payload.find({ collection: 'patientClinicInquiries', depth: 0, overrideAccess: false, user }),
      ).rejects.toThrow(/not allowed|perform this action/i)
      await expect(
        payload.create({
          collection: 'patientClinicInquiries',
          data: originalData(clinic.id, doctor.id, `denied-${String(user.id)}`),
          depth: 0,
          overrideAccess: false,
          user,
        }),
      ).rejects.toThrow(/not allowed|perform this action/i)
      await expect(
        payload.update({
          collection: 'patientClinicInquiries',
          data: { revision: 1 },
          depth: 0,
          id: inquiry.id,
          overrideAccess: false,
          user,
        }),
      ).rejects.toThrow(/not allowed|perform this action/i)
      await expect(
        payload.delete({
          collection: 'patientClinicInquiries',
          depth: 0,
          id: inquiry.id,
          overrideAccess: false,
          user,
        }),
      ).rejects.toThrow(/not allowed|perform this action/i)
    }
  })

  it('freezes the original submission and requires the server-only command marker for domain state', async () => {
    const { inquiry } = await createLegacyInquiry('immutable')

    await expect(
      payload.update({
        collection: 'patientClinicInquiries',
        context: { inquiryCommunicationCommand: true },
        data: { email: 'changed@example.com' },
        depth: 0,
        id: inquiry.id,
        overrideAccess: true,
      }),
    ).rejects.toThrow(/email cannot be changed after inquiry submission/i)

    await expect(
      payload.update({
        collection: 'patientClinicInquiries',
        data: { revision: 1 },
        depth: 0,
        id: inquiry.id,
        overrideAccess: true,
      }),
    ).rejects.toThrow(/invalid.*revision|domain fields cannot be changed/i)

    await expect(
      payload.update({
        collection: 'patientClinicInquiries',
        context: { inquiryCommunicationCommand: true },
        data: { revision: 1 },
        depth: 0,
        id: inquiry.id,
        overrideAccess: true,
      }),
    ).resolves.toMatchObject({ revision: 1, status: 'submitted' })
  })
})

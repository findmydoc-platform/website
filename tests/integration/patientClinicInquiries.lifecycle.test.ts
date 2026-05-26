import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import {
  cleanupTrackedUsers,
  createClinicTestUser,
  createPlatformTestUser,
  asPayloadBasicUser,
} from '../fixtures/testUsers'
import { runBaselineContract } from './contracts/baselineContract'
import type { BasicUser, PatientClinicInquiry } from '@/payload-types'

type PayloadCreateArgs = Parameters<Payload['create']>[0]
type PayloadUpdateArgs = Parameters<Payload['update']>[0]
type PayloadFindArgs = Parameters<Payload['find']>[0]

describe('PatientClinicInquiries lifecycle integration', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('patientClinicInquiries.lifecycle.test.ts')
  const createdInquiryIds: Array<number> = []
  const createdBasicUserIds: Array<number | string> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true, depth: 0 })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for patient clinic inquiry tests')
    cityId = cityDoc.id as number
  }, 60000)

  afterEach(async () => {
    while (createdInquiryIds.length) {
      const id = createdInquiryIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'patientClinicInquiries', id, overrideAccess: true })
      } catch {}
    }

    await cleanupTrackedUsers(payload, { basicUserIds: createdBasicUserIds })
    await cleanupTestEntities(payload, 'patientClinicInquiries', slugPrefix)
    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  const createPlatformUser = async (suffix: string): Promise<BasicUser> =>
    createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-platform-${suffix}`,
      createdBasicUserIds,
    })

  const createClinicUser = async (suffix: string): Promise<BasicUser> =>
    createClinicTestUser(payload, {
      emailPrefix: `${slugPrefix}-clinic-${suffix}`,
      createdBasicUserIds,
    })

  const buildInquiryData = async (suffix: string) => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-${suffix}` })

    return {
      clinicId: clinic.id,
      doctorId: doctor.id,
      data: {
        clinic: clinic.id,
        doctor: doctor.id,
        fullName: `${slugPrefix}-${suffix} Patient`,
        email: `${slugPrefix}-${suffix}@example.com`,
        phoneNumber: '+49301234567',
        treatmentTimeline: 'within_two_weeks',
        preferredContactWindow: 'morning',
        message: 'Please contact me about this clinic.',
        consent: {
          accepted: true,
          acceptedAt: '2026-05-20T10:00:00.000Z',
          text: 'Consent captured in integration test.',
        },
        status: 'submitted',
      },
    }
  }

  it('stores clinic context, contact details, and contact preferences', async () => {
    const { data, clinicId, doctorId } = await buildInquiryData('store')

    const inquiry = (await payload.create({
      collection: 'patientClinicInquiries',
      data,
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as PatientClinicInquiry

    createdInquiryIds.push(inquiry.id)

    expect(inquiry.clinic).toBe(clinicId)
    expect(inquiry.doctor).toBe(doctorId)
    expect(inquiry.status).toBe('submitted')
    expect(inquiry.fullName).toContain(slugPrefix)
    expect(inquiry.phoneNumber).toBe('+49301234567')
    expect(inquiry.treatmentTimeline).toBe('within_two_weeks')
    expect(inquiry.preferredContactWindow).toBe('morning')
    expect(inquiry.consent?.accepted).toBe(true)
  })

  it('allows platform handling and blocks clinic users from inquiry records', async () => {
    const { data } = await buildInquiryData('access')

    const inquiry = (await payload.create({
      collection: 'patientClinicInquiries',
      data,
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as PatientClinicInquiry

    createdInquiryIds.push(inquiry.id)

    const platformUser = await createPlatformUser('handler')
    const updated = (await payload.update({
      collection: 'patientClinicInquiries',
      id: inquiry.id,
      data: {
        status: 'contacted',
        assignedTo: platformUser.id,
      },
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadUpdateArgs)) as PatientClinicInquiry

    expect(updated.status).toBe('contacted')
    expect(updated.assignedTo).toBe(platformUser.id)

    const clinicUser = await createClinicUser('blocked')

    await expect(
      payload.find({
        collection: 'patientClinicInquiries',
        user: asPayloadBasicUser(clinicUser),
        overrideAccess: false,
        depth: 0,
      } as PayloadFindArgs),
    ).rejects.toThrow(/not allowed|perform this action/i)

    await expect(
      payload.create({
        collection: 'patientClinicInquiries',
        data,
        user: asPayloadBasicUser(clinicUser),
        overrideAccess: false,
        depth: 0,
      } as PayloadCreateArgs),
    ).rejects.toThrow(/not allowed|perform this action/i)
  })

  it('prevents platform users from changing consent evidence', async () => {
    const { data } = await buildInquiryData('evidence')

    const inquiry = (await payload.create({
      collection: 'patientClinicInquiries',
      data,
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as PatientClinicInquiry

    createdInquiryIds.push(inquiry.id)

    const platformUser = await createPlatformUser('evidence')

    await expect(
      payload.update({
        collection: 'patientClinicInquiries',
        id: inquiry.id,
        data: {
          consent: {
            accepted: false,
            acceptedAt: '2026-05-21T10:00:00.000Z',
            text: 'Tampered consent.',
          },
        },
        user: asPayloadBasicUser(platformUser),
        overrideAccess: false,
        depth: 0,
      } as PayloadUpdateArgs),
    ).rejects.toThrow(/submission evidence cannot be changed/i)

    await expect(
      payload.update({
        collection: 'patientClinicInquiries',
        id: inquiry.id,
        data: { treatmentTimeline: 'flexible' },
        user: asPayloadBasicUser(platformUser),
        overrideAccess: false,
        depth: 0,
      } as PayloadUpdateArgs),
    ).resolves.toMatchObject({ treatmentTimeline: 'flexible' })

    const unchanged = (await payload.findByID({
      collection: 'patientClinicInquiries',
      id: inquiry.id,
      overrideAccess: true,
      depth: 0,
    })) as PatientClinicInquiry

    expect(unchanged.consent?.accepted).toBe(true)
    expect(unchanged.treatmentTimeline).toBe('flexible')
  })

  it('matches the baseline collection contract', async () => {
    const { data } = await buildInquiryData('baseline')

    await runBaselineContract<PatientClinicInquiry>({
      collection: 'patientClinicInquiries',
      createPrivileged: async () => {
        const created = (await payload.create({
          collection: 'patientClinicInquiries',
          data,
          overrideAccess: true,
          depth: 0,
        } as PayloadCreateArgs)) as PatientClinicInquiry

        createdInquiryIds.push(created.id)
        return created
      },
      getId: (doc) => doc.id,
      readPrivileged: async (id) =>
        (await payload.findByID({
          collection: 'patientClinicInquiries',
          id,
          overrideAccess: true,
          depth: 0,
        })) as PatientClinicInquiry,
      updatePrivileged: async (id) =>
        (await payload.update({
          collection: 'patientClinicInquiries',
          id,
          data: { status: 'in_review' },
          overrideAccess: true,
          depth: 0,
        } as PayloadUpdateArgs)) as PatientClinicInquiry,
      assertUpdated: (doc) => {
        expect(doc.status).toBe('in_review')
      },
      assertDeniedWrite: async (id) => {
        const clinicUser = await createClinicUser('baseline-denied')

        await expect(
          payload.update({
            collection: 'patientClinicInquiries',
            id,
            data: { status: 'closed' },
            user: asPayloadBasicUser(clinicUser),
            overrideAccess: false,
            depth: 0,
          } as PayloadUpdateArgs),
        ).rejects.toThrow(/not allowed|perform this action/i)
      },
      deletePrivileged: async (id) => {
        const platformUser = await createPlatformUser('baseline-delete')

        const deleted = await payload.delete({
          collection: 'patientClinicInquiries',
          id,
          user: asPayloadBasicUser(platformUser),
          overrideAccess: false,
          depth: 0,
        })

        const index = createdInquiryIds.indexOf(Number(id))
        if (index >= 0) createdInquiryIds.splice(index, 1)
        return deleted
      },
    })
  })
})

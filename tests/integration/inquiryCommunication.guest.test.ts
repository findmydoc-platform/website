import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import config from '@payload-config'
import { POST as submitGuestClinicInquiry } from '@/app/api/clinic-contact-requests/route'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'

const makeGuestRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/clinic-contact-requests', {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

describe('guest inquiry HTTP persistence', () => {
  let payload: Payload
  let clinicId: number
  let doctorId: number | string
  const createdInquiryIds: Array<number | string> = []
  const slugPrefix = testSlug('inquiryCommunication.guest.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const city = (await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })).docs[0]
    if (!city) throw new Error('Expected a baseline city for the guest inquiry test.')

    const fixture = await createClinicFixture(payload, city.id, { slugPrefix })
    clinicId = fixture.clinic.id
    doctorId = fixture.doctor.id
    await payload.update({
      collection: 'clinics',
      data: { status: 'approved' },
      depth: 0,
      id: clinicId,
      overrideAccess: true,
    })
  }, 60_000)

  afterAll(async () => {
    for (const collection of ['inquiryAuditEvents', 'inquiryReadPositions', 'inquiryConversations'] as const) {
      await payload.delete({
        collection: collection as never,
        overrideAccess: true,
        trash: true,
        where: { inquiry: { in: createdInquiryIds } },
      })
    }
    for (const id of createdInquiryIds) {
      await payload.delete({ collection: 'patientClinicInquiries', id, overrideAccess: true, trash: true })
    }
    await payload.delete({
      collection: 'doctors',
      overrideAccess: true,
      trash: true,
      where: { clinic: { equals: clinicId } },
    })
    await payload.delete({ collection: 'clinics', id: clinicId, overrideAccess: true, trash: true })
  })

  it('initializes and deduplicates a guest POST with one content-free system audit event', async () => {
    const privateGuestContent = {
      email: `${slugPrefix}-guest@example.com`,
      fullName: 'Synthetic Guest Patient',
      message: 'Synthetic guest request that must not enter the audit event.',
      phoneNumber: '+493000000012',
    }
    const body = {
      clinicId,
      consent: true,
      doctorId,
      ...privateGuestContent,
      preferredContactWindow: 'morning',
      treatmentTimeline: 'within_two_weeks',
    }
    const firstResponse = await submitGuestClinicInquiry(makeGuestRequest(body))
    const first = (await firstResponse.json()) as {
      deduped?: boolean
      id?: string
      status?: string
      success?: boolean
    }
    if (first.id) createdInquiryIds.push(first.id)

    expect(firstResponse.status).toBe(200)
    expect(first).toEqual({ success: true, id: expect.any(String), status: 'submitted' })

    const replayResponse = await submitGuestClinicInquiry(makeGuestRequest(body))
    expect(replayResponse.status).toBe(200)
    await expect(replayResponse.json()).resolves.toEqual({
      deduped: true,
      id: first.id,
      status: 'submitted',
      success: true,
    })

    const inquiries = await payload.find({
      collection: 'patientClinicInquiries',
      depth: 0,
      limit: 10,
      overrideAccess: true,
      pagination: false,
      showHiddenFields: true,
      where: {
        and: [{ clinic: { equals: clinicId } }, { email: { equals: privateGuestContent.email } }],
      },
    })
    expect(inquiries.docs).toHaveLength(1)
    expect(inquiries.docs[0]).toMatchObject({
      activitySequence: 1,
      clinic: clinicId,
      clinicNotificationSequence: 1,
      clinicUnreadEpoch: 0,
      clinicUnreadFloor: 0,
      consent: { accepted: true, acceptedAt: expect.any(String), text: expect.any(String) },
      externalSequence: 0,
      handlingStatus: 'submitted',
      lastActivityAt: expect.any(String),
      lifecycle: 'open',
      patient: null,
      revision: 0,
      status: 'submitted',
    })

    const audit = await payload.find({
      collection: 'inquiryAuditEvents' as never,
      depth: 0,
      limit: 10,
      overrideAccess: true,
      pagination: false,
      showHiddenFields: true,
      where: { inquiry: { equals: first.id } },
    } as never)
    expect(audit.docs).toHaveLength(1)
    expect(audit.docs[0]).toMatchObject({
      actorId: 'system',
      actorKind: 'system',
      clinicNotificationSequence: 1,
      eventType: 'inquiry-created',
      sequence: 1,
      targetId: first.id,
      targetType: 'inquiry',
    })
    const serializedAudit = JSON.stringify(audit.docs[0])
    for (const content of Object.values(privateGuestContent)) expect(serializedAudit).not.toContain(content)

    for (const collection of ['inquiryConversations', 'inquiryReadPositions'] as const) {
      const result = await payload.find({
        collection: collection as never,
        depth: 0,
        limit: 10,
        overrideAccess: true,
        pagination: false,
        where: { inquiry: { equals: first.id } },
      } as never)
      expect(result.docs).toHaveLength(0)
    }
  })

  it.each([
    ['doctor', { doctorId: 2_147_483_647 }, 'Doctor is not available for this clinic.'],
    ['treatment', { treatmentId: 2_147_483_647 }, 'Treatment is not available for this clinic.'],
  ] as const)('preserves the specific unavailable-%s field error', async (kind, target, message) => {
    const email = `${slugPrefix}-unavailable-${kind}@example.com`
    const response = await submitGuestClinicInquiry(
      makeGuestRequest({
        clinicId,
        consent: true,
        email,
        fullName: `Synthetic Unavailable ${kind}`,
        message: `Synthetic unavailable ${kind} selection.`,
        phoneNumber: '+493000000013',
        treatmentTimeline: 'within_two_weeks',
        ...target,
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: message })
    const persisted = await payload.count({
      collection: 'patientClinicInquiries',
      overrideAccess: true,
      where: { email: { equals: email } },
    })
    expect(persisted.totalDocs).toBe(0)
  })
})

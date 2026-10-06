import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import {
  createVerifiedPatientInquiry,
  sendClinicInquiryMessage,
  updateClinicInquiryState,
} from '@/features/inquiryCommunication/service'
import { bindTransactionalEmail } from '@/features/transactionalEmail/payloadIntegration'
import { createTransactionalEmailWorker } from '@/features/transactionalEmail/worker'
import type { DeliveryAdapter } from '@/features/transactionalEmail/delivery'
import { cleanupTransactionalEmailFixtures } from '../fixtures/cleanupTransactionalEmailFixtures'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import {
  asClinicScopedPayloadUser,
  asPayloadPatientUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPatientTestUser,
} from '../fixtures/testUsers'
import { testSlug } from '../fixtures/testSlug'

const { closeDeliveryEdgeNetworkBoundary, deliveryEdgeNetworkGuard } = await vi.hoisted(
  () => import('../helpers/deliveryEdgeNetworkBoundary'),
)
vi.mock('@payloadcms/storage-s3', () => ({ s3Storage: () => (incomingConfig: unknown) => incomingConfig }))

describe('conversation command through the existing delivery worker', () => {
  let payload: Payload
  let patientReq: PayloadRequest
  let clinicReq: PayloadRequest
  let clinicId: number
  let doctorId: number
  let patientEmail: string
  const prefix = testSlug('transactionalEmail.conversationMessage.test.ts')
  const patientIds: Array<number | string> = []
  const staffIds: Array<number | string> = []
  const inquiryIds: Array<number | string> = []
  const references: string[] = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const cities = await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })
    const fixture = await createClinicFixture(payload, cities.docs[0]!.id, { slugPrefix: prefix })
    clinicId = fixture.clinic.id
    doctorId = fixture.doctor.id
    const patient = await createPatientTestUser(payload, {
      createdPatientIds: patientIds,
      emailPrefix: `${prefix}-patient`,
      firstName: 'Private',
      lastName: 'Patient',
    })
    patientEmail = patient.email
    patientReq = await createLocalReq({}, payload)
    patientReq.user = asPayloadPatientUser(patient)
    const staff = await createClinicTestUser(payload, { createdStaffIds: staffIds, emailPrefix: `${prefix}-clinic` })
    clinicReq = await createLocalReq({}, payload)
    clinicReq.user = await asClinicScopedPayloadUser(payload, staff, clinicId)
  }, 60000)

  beforeEach(() => vi.stubEnv('CI', 'false'))
  afterEach(() => {
    try {
      deliveryEdgeNetworkGuard.assertNoAttempts()
    } finally {
      vi.unstubAllEnvs()
    }
  })
  afterAll(async () => {
    try {
      if (!payload) return
      await cleanupTransactionalEmailFixtures(payload, references)
      for (const collection of [
        'inquiryAuditEvents',
        'inquiryReadPositions',
        'inquiryMessages',
        'inquiryAttachments',
        'inquiryConversations',
      ] as const)
        await payload.delete({ collection, overrideAccess: true, where: { inquiry: { in: inquiryIds } } })
      for (const id of inquiryIds)
        await payload.delete({ collection: 'patientClinicInquiries', id, overrideAccess: true })
      await cleanupTrackedUsers(payload, { patientIds, staffIds })
      if (doctorId) await payload.delete({ collection: 'doctors', id: doctorId, overrideAccess: true })
      if (clinicId) await payload.delete({ collection: 'clinics', id: clinicId, overrideAccess: true })
    } finally {
      closeDeliveryEdgeNetworkBoundary()
    }
  })

  async function acceptMessage() {
    const { inquiry } = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicId),
      doctorId: String(doctorId),
      consent: true,
      idempotencyKey: `${prefix}-${inquiryIds.length}-create`,
      message: 'Private treatment inquiry',
      phoneNumber: '+493000000001',
      treatmentTimeline: 'within_two_weeks',
    })
    inquiryIds.push(inquiry.id)
    const result = await sendClinicInquiryMessage(clinicReq, {
      inquiryId: inquiry.id,
      expectedRevision: 0,
      idempotencyKey: `${prefix}-${inquiryIds.length}-reply`,
      text: 'Private clinic reply',
    })
    const activity = result.inquiry.timeline.find(
      (item) => item.kind === 'external-message' && item.text === 'Private clinic reply',
    )
    if (!activity) throw new Error('Expected the authoritative clinic message')
    const messageId = Number(activity.id.replace('message:', ''))
    references.push(`v1|conversation-message|${messageId}`)
    const accepted = await bindTransactionalEmail(clinicReq).accept({
      type: 'conversation.external-message-received',
      messageId,
    })
    return { ...accepted, inquiryId: inquiry.id, messageId, revision: result.inquiry.revision }
  }

  it('delivers one neutral package notice even after inquiry closure and clinic offboarding', async () => {
    const accepted = await acceptMessage()
    await updateClinicInquiryState(clinicReq, {
      inquiryId: accepted.inquiryId,
      expectedRevision: accepted.revision,
      action: 'close',
    })
    await payload.update({
      collection: 'clinics',
      id: clinicId,
      data: { participationStatus: 'disabled' },
      overrideAccess: true,
    })
    const delivery: DeliveryAdapter = {
      deliver: vi.fn(async () => ({ type: 'accepted' as const, messageId: 'fake-conversation-notice' })),
    }
    const log = vi.fn()
    await createTransactionalEmailWorker(clinicReq, { delivery, suppression: async () => 'cleared', log }).run(
      accepted.operationId,
    )
    expect(delivery.deliver).toHaveBeenCalledOnce()
    const prepared = vi.mocked(delivery.deliver).mock.calls[0]![0]!
    expect(prepared).toMatchObject({ recipientAddress: patientEmail, subject: 'You have a new message on findmydoc' })
    expect(prepared.html).toContain(`href="https://example.test/patient/inquiries/${accepted.inquiryId}"`)
    expect(prepared.text).toContain('A clinic sent you a new message. Sign in to findmydoc to view it.')
    expect(prepared.text).not.toContain('Private')
    expect(log.mock.calls[0]![0]).toEqual({
      operationId: String(accepted.operationId),
      commandType: 'conversation.external-message-received',
      environment: 'test',
      attemptNumber: 1,
      outcomeCode: 'fake-accepted',
      outboxState: 'accepted',
      durationBucket: expect.any(String),
      queueAgeBucket: expect.any(String),
    })
    expect(JSON.stringify(log.mock.calls)).not.toContain(patientEmail)
    await payload.update({
      collection: 'clinics',
      id: clinicId,
      data: { participationStatus: 'approved' },
      overrideAccess: true,
    })
  })

  it('never calls the delivery edge after the triggering message is trashed', async () => {
    await payload.update({
      collection: 'clinics',
      id: clinicId,
      data: { participationStatus: 'approved' },
      overrideAccess: true,
    })
    const accepted = await acceptMessage()
    await payload.delete({ collection: 'inquiryMessages', id: accepted.messageId, overrideAccess: true })
    const delivery: DeliveryAdapter = { deliver: vi.fn() }
    const log = vi.fn()
    await createTransactionalEmailWorker(clinicReq, { delivery, suppression: async () => 'cleared', log }).run(
      accepted.operationId,
    )
    expect(delivery.deliver).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ outcomeCode: 'source-unavailable' }))
  })
})

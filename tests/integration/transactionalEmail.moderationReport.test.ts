import http from 'node:http'
import https from 'node:https'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import { createVerifiedPatientInquiry, updateClinicInquiryState } from '@/features/inquiryCommunication/service'
import { createInquiryModerationReport } from '@/features/inquiryModeration/service'
import { bindTransactionalEmail } from '@/features/transactionalEmail/payloadIntegration'
import { createTransactionalEmailWorker } from '@/features/transactionalEmail/worker'
import type { DeliveryAdapter, DeliveryLog } from '@/features/transactionalEmail/delivery'
import { runOwnedTransaction } from '@/features/transactionalEmail/transactions'
import { TransactionalEmailError } from '@/features/transactionalEmail/errors'
import { bindPayloadCommandCatalog } from '@/features/transactionalEmail/payloadCatalog'
import { openStorageCapability } from '@/features/transactionalEmail/capability'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import { cleanupTransactionalEmailFixtures } from '../fixtures/cleanupTransactionalEmailFixtures'
import {
  asClinicScopedPayloadUser,
  asPayloadPatientUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPatientTestUser,
} from '../fixtures/testUsers'

vi.mock('@payloadcms/storage-s3', () => ({ s3Storage: () => (incoming: unknown) => incoming }))

describe('authoritative moderation report receipt', () => {
  let payload: Payload
  let patientReq: PayloadRequest
  let clinicReq: PayloadRequest
  let otherClinicReq: PayloadRequest
  let clinicId: number
  let doctorId: number
  const inquiryIds: string[] = []
  const patientIds: Array<number | string> = []
  const staffIds: Array<number | string> = []
  const references: string[] = []
  const prefix = testSlug('transactionalEmail.moderationReport.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const city = (await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })).docs[0]
    if (!city) throw new Error('Expected baseline city')
    const fixture = await createClinicFixture(payload, city.id, { slugPrefix: prefix })
    clinicId = fixture.clinic.id
    doctorId = fixture.doctor.id
    const patient = await createPatientTestUser(payload, {
      createdPatientIds: patientIds,
      emailPrefix: `${prefix}-patient`,
      firstName: 'ForbiddenPatientName',
    })
    patientReq = await createLocalReq({}, payload)
    patientReq.user = asPayloadPatientUser(patient)
    const clinic = await createClinicTestUser(payload, { createdStaffIds: staffIds, emailPrefix: `${prefix}-clinic` })
    clinicReq = await createLocalReq({}, payload)
    clinicReq.user = await asClinicScopedPayloadUser(payload, clinic, clinicId)
    const other = await createClinicTestUser(payload, { createdStaffIds: staffIds, emailPrefix: `${prefix}-other` })
    otherClinicReq = await createLocalReq({}, payload)
    otherClinicReq.user = await asClinicScopedPayloadUser(payload, other, clinicId)
  }, 60_000)

  beforeEach(() => {
    vi.stubEnv('CI', 'false')
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://website.example.test')
    vi.stubEnv('CLINIC_DASHBOARD_URL', 'https://dashboard.example.test')
    const deny = () => {
      throw new Error('External network forbidden')
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(deny)
    vi.spyOn(http, 'request').mockImplementation(deny)
    vi.spyOn(https, 'request').mockImplementation(deny)
  })

  afterEach(() => {
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(http.request).not.toHaveBeenCalled()
    expect(https.request).not.toHaveBeenCalled()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  afterAll(async () => {
    if (!payload) return
    await cleanupTransactionalEmailFixtures(payload, references)
    for (const collection of [
      'inquiryModerationEvents',
      'inquiryModerationCases',
      'inquiryAuditEvents',
      'inquiryReadPositions',
      'inquiryMessages',
      'inquiryConversations',
    ] as const) {
      await payload.delete({ collection, overrideAccess: true, where: { inquiry: { in: inquiryIds } } })
    }
    for (const id of inquiryIds)
      await payload.delete({ collection: 'patientClinicInquiries', id, overrideAccess: true })
    await cleanupTrackedUsers(payload, { patientIds, staffIds })
    await payload.delete({ collection: 'doctors', overrideAccess: true, where: { clinic: { equals: clinicId } } })
    await payload.delete({ collection: 'clinics', id: clinicId, overrideAccess: true })
  })

  async function report(
    actorReq = patientReq,
    category:
      | 'privacy-concern'
      | 'other'
      | 'harassment-threats'
      | 'spam-fraud-impersonation'
      | 'suspected-illegal-content' = 'privacy-concern',
  ) {
    const created = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicId),
      doctorId: String(doctorId),
      consent: true,
      idempotencyKey: `${prefix}-inquiry-${inquiryIds.length}`,
      message: 'ForbiddenHealthDetails',
      phoneNumber: '+493000000001',
    })
    inquiryIds.push(created.inquiry.id)
    const conversation = (
      await payload.find({
        collection: 'inquiryConversations',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: { inquiry: { equals: created.inquiry.id } },
      })
    ).docs[0]
    if (!conversation) throw new Error('Expected conversation')
    const receipt = await createInquiryModerationReport(actorReq, {
      category,
      description: 'ForbiddenReportDescription',
      inquiryId: created.inquiry.id,
      idempotencyKey: `${prefix}-report-${inquiryIds.length}`,
      targetId: String(conversation.id),
      targetType: 'conversation',
    })
    const event = (
      await payload.find({
        collection: 'inquiryModerationEvents',
        req: actorReq,
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: {
          and: [{ moderationCase: { equals: receipt.reportId } }, { eventType: { equals: 'report-received' } }],
        },
      })
    ).docs[0]
    if (!event) throw new Error('Expected report event')
    references.push(`v1|moderation-event|${event.id}|reporter`)
    return { inquiryId: created.inquiry.id, eventId: event.id, caseId: receipt.reportId }
  }

  it('delivers the authoritative neutral package receipt to its patient reporter through the normal command catalog', async () => {
    const source = await report()
    const command = {
      type: 'moderation.report-received' as const,
      moderationEventId: source.eventId,
      recipientSlot: 'reporter' as const,
    }
    const accepted = await bindTransactionalEmail(patientReq).accept(command)
    await expect(bindTransactionalEmail(patientReq).accept(command)).resolves.toMatchObject({
      operationId: accepted.operationId,
      deduplicated: true,
    })
    const delivery: DeliveryAdapter = {
      deliver: vi.fn<DeliveryAdapter['deliver']>(async () => ({ type: 'accepted', messageId: 'fake-report-receipt' })),
    }
    await createTransactionalEmailWorker(await createLocalReq({}, payload), {
      delivery,
      suppression: async () => 'cleared',
    }).run(accepted.operationId)
    expect(delivery.deliver).toHaveBeenCalledOnce()
    const message = vi.mocked(delivery.deliver).mock.calls[0]![0]
    expect(message).toMatchObject({ recipientAddress: recipientEmail(patientReq), subject: 'We received your report' })
    expect(message.html).toContain(`https://website.example.test/patient/inquiries/${source.inquiryId}`)
    expect(message.text).toContain('Privacy concern or wrong recipient')
    for (const forbidden of [
      'ForbiddenPatientName',
      'ForbiddenHealthDetails',
      'ForbiddenReportDescription',
      'moderationCase',
      'targetType',
    ]) {
      expect(message.html).not.toContain(forbidden)
      expect(message.text).not.toContain(forbidden)
    }
  })

  const commandFor = (eventId: number) => ({
    type: 'moderation.report-received' as const,
    moderationEventId: eventId,
    recipientSlot: 'reporter' as const,
  })

  function recipientEmail(req: PayloadRequest): string {
    if (!req.user || !('email' in req.user) || typeof req.user.email !== 'string')
      throw new Error('Expected a participant email')
    return req.user.email
  }

  async function deliver(operationId: string, adapter?: DeliveryAdapter, now?: () => number) {
    const logs: DeliveryLog[] = []
    const delivery: DeliveryAdapter = adapter ?? {
      deliver: vi.fn<DeliveryAdapter['deliver']>(async () => ({ type: 'accepted', messageId: 'fake-receipt' })),
    }
    await createTransactionalEmailWorker(await createLocalReq({}, payload), {
      delivery,
      suppression: async () => 'cleared',
      log: (event) => logs.push(event),
      now,
    }).run(operationId)
    return { delivery, logs }
  }

  it('rejects another access-ready staff member and anonymous callers instead of choosing a clinic-wide recipient', async () => {
    const source = await report(clinicReq)
    await expect(bindTransactionalEmail(otherClinicReq).accept(commandFor(source.eventId))).rejects.toMatchObject({
      code: 'access-denied',
    })
    await expect(
      bindTransactionalEmail(await createLocalReq({}, payload)).accept(commandFor(source.eventId)),
    ).rejects.toMatchObject({ code: 'access-denied' })
    await expect(bindTransactionalEmail(patientReq).accept(commandFor(source.eventId))).rejects.toMatchObject({
      code: 'access-denied',
    })
  })

  it('delivers only to the exact stored clinic reporter using the existing protected Dashboard inquiry target', async () => {
    const source = await report(clinicReq, 'other')
    const accepted = await bindTransactionalEmail(clinicReq).accept(commandFor(source.eventId))
    const { delivery } = await deliver(accepted.operationId)
    expect(delivery.deliver).toHaveBeenCalledOnce()
    const message = vi.mocked(delivery.deliver).mock.calls[0]![0]
    expect(message.recipientAddress).toBe(recipientEmail(clinicReq))
    expect(message.recipientAddress).not.toBe(recipientEmail(otherClinicReq))
    expect(message.html).toContain(`https://dashboard.example.test/?inquiry=${source.inquiryId}`)
    expect(message.text).toContain('Other')
    expect(message.html).not.toContain('ForbiddenReportDescription')
  })

  it('keeps a closed but readable Inquiry eligible for its report receipt', async () => {
    const source = await report()
    const inquiry = await payload.findByID({
      collection: 'patientClinicInquiries',
      id: source.inquiryId,
      overrideAccess: true,
    })
    await updateClinicInquiryState(clinicReq, {
      action: 'close',
      inquiryId: source.inquiryId,
      expectedRevision: inquiry.revision ?? 0,
    })
    const accepted = await bindTransactionalEmail(patientReq).accept(commandFor(source.eventId))
    const { delivery } = await deliver(accepted.operationId)
    expect(delivery.deliver).toHaveBeenCalledOnce()
    expect(vi.mocked(delivery.deliver).mock.calls[0]![0].recipientAddress).toBe(recipientEmail(patientReq))
  })

  it.each([
    ['harassment-threats', 'Harassment, threats, or inappropriate conduct'],
    ['spam-fraud-impersonation', 'Spam, fraud, or impersonation'],
    ['suspected-illegal-content', 'Suspected illegal content'],
  ] as const)('renders the package category label for %s', async (category, label) => {
    const source = await report(patientReq, category)
    const accepted = await bindTransactionalEmail(patientReq).accept(commandFor(source.eventId))
    const { delivery } = await deliver(accepted.operationId)
    expect(vi.mocked(delivery.deliver).mock.calls[0]![0].text).toContain(label)
  })

  it('rejects wrong slots, caller-controlled template props and unavailable moderation events', async () => {
    const source = await report()
    for (const invalid of [
      { ...commandFor(source.eventId), recipientSlot: 'affected' },
      { ...commandFor(source.eventId), recipientAddress: 'another@example.test' },
      { ...commandFor(source.eventId), actionUrl: 'https://external.example.test' },
      { ...commandFor(source.eventId), category: 'other' },
    ])
      await expect(bindTransactionalEmail(patientReq).accept(invalid as never)).rejects.toMatchObject({
        code: 'invalid-command',
      })
    await expect(bindTransactionalEmail(patientReq).accept(commandFor(2_147_483_647))).rejects.toMatchObject({
      code: 'source-missing',
    })
  })

  it('suppresses an unavailable source before transport', async () => {
    const source = await report()
    const accepted = await bindTransactionalEmail(patientReq).accept(commandFor(source.eventId))
    await payload.delete({ collection: 'inquiryModerationEvents', id: source.eventId, overrideAccess: true })
    const { delivery, logs } = await deliver(accepted.operationId)
    expect(delivery.deliver).not.toHaveBeenCalled()
    expect(logs).toContainEqual(
      expect.objectContaining({ outcomeCode: 'source-unavailable', outboxState: 'suppressed' }),
    )
  })

  it('suppresses current access loss without substituting another clinic participant', async () => {
    const source = await report(clinicReq)
    const accepted = await bindTransactionalEmail(clinicReq).accept(commandFor(source.eventId))
    const staffId = clinicReq.user!.id
    try {
      await payload.update({
        collection: 'clinicStaff',
        id: staffId,
        data: { authSync: { status: 'failed' } },
        overrideAccess: true,
        context: { skipClinicStaffAuthSync: true },
      })
      const { delivery, logs } = await deliver(accepted.operationId)
      expect(delivery.deliver).not.toHaveBeenCalled()
      expect(logs).toContainEqual(expect.objectContaining({ outcomeCode: 'ineligible', outboxState: 'suppressed' }))
    } finally {
      await payload.update({
        collection: 'clinicStaff',
        id: staffId,
        data: { authSync: { status: 'synced' } },
        overrideAccess: true,
        context: { skipClinicStaffAuthSync: true },
      })
    }
  })

  it('classifies a moved clinic reporter as recipient-changed before their now-ineligible completion proof', async () => {
    const source = await report(clinicReq)
    const accepted = await bindTransactionalEmail(clinicReq).accept(commandFor(source.eventId))
    const staffId = clinicReq.user!.id
    try {
      await payload.update({
        collection: 'clinicStaff',
        id: staffId,
        data: { clinic: null },
        overrideAccess: true,
        context: { skipClinicStaffAuthSync: true },
      })
      const { delivery, logs } = await deliver(accepted.operationId)
      expect(delivery.deliver).not.toHaveBeenCalled()
      expect(logs).toContainEqual(
        expect.objectContaining({ outcomeCode: 'recipient-changed', outboxState: 'suppressed' }),
      )
    } finally {
      await payload.update({
        collection: 'clinicStaff',
        id: staffId,
        data: { clinic: clinicId },
        overrideAccess: true,
        context: { skipClinicStaffAuthSync: true },
      })
    }
  })

  it('revalidates the current address on retry and never sends the frozen HTML to a replacement recipient', async () => {
    const source = await report()
    let clock = Date.now()
    const accepted = await bindTransactionalEmail(patientReq, undefined, () => clock).accept(commandFor(source.eventId))
    const adapter: DeliveryAdapter = { deliver: vi.fn<DeliveryAdapter['deliver']>(async () => ({ type: 'retryable' })) }
    await deliver(accepted.operationId, adapter, () => clock)
    expect(adapter.deliver).toHaveBeenCalledOnce()
    const patientId = patientReq.user!.id
    const original = recipientEmail(patientReq)
    try {
      await payload.update({
        collection: 'patients',
        id: patientId,
        data: { email: `${prefix}-changed@example.test` },
        overrideAccess: true,
      })
      clock += 60_001
      const { logs } = await deliver(accepted.operationId, adapter, () => clock)
      expect(adapter.deliver).toHaveBeenCalledOnce()
      expect(logs).toContainEqual(
        expect.objectContaining({ outcomeCode: 'recipient-changed', outboxState: 'suppressed' }),
      )
    } finally {
      await payload.update({ collection: 'patients', id: patientId, data: { email: original }, overrideAccess: true })
    }
  })

  it('uses the borrowed transaction for current participant reads and rolls back participant changes and email acceptance together', async () => {
    const source = await report()
    const original = recipientEmail(patientReq)
    const changed = `${prefix}-transaction@example.test`
    let operationId: string | undefined
    let observedAddress: string | null | undefined
    await expect(
      runOwnedTransaction(patientReq, async (transactionReq) => {
        await payload.update({
          collection: 'patients',
          id: patientReq.user!.id,
          data: { email: changed },
          overrideAccess: true,
          req: transactionReq,
        })
        const accepted = await bindTransactionalEmail(transactionReq).accept(commandFor(source.eventId))
        operationId = accepted.operationId
        const recipient = await bindPayloadCommandCatalog(transactionReq)[
          'moderation.report-received'
        ].authorizeAndResolve(commandFor(source.eventId), `patients:${String(patientReq.user!.id)}`)
        observedAddress = recipient.address
        throw new TransactionalEmailError('access-denied')
      }),
    ).rejects.toMatchObject({ code: 'access-denied' })
    expect(operationId).toBeDefined()
    expect(observedAddress).toBe(changed)
    expect(
      (await payload.findByID({ collection: 'patients', id: patientReq.user!.id, overrideAccess: true })).email,
    ).toBe(original)
    const counts = await runOwnedTransaction(await createLocalReq({}, payload), async (_, transactionID) => {
      const capability = openStorageCapability(transactionID)
      try {
        const req = await createLocalReq(
          { context: capability.context, req: { transactionID: Promise.resolve(transactionID) } },
          payload,
        )
        const outbox = await payload.find({
          collection: 'transactionalEmailOutbox',
          overrideAccess: true,
          req,
          where: { operationReference: { equals: `v1|moderation-event|${source.eventId}|reporter` } },
          pagination: false,
        })
        const events = await payload.find({
          collection: 'transactionalEmailEvents',
          overrideAccess: true,
          req,
          where: { outbox: { equals: operationId } },
          pagination: false,
        })
        return { outbox: outbox.docs.length, events: events.docs.length }
      } finally {
        capability.close()
      }
    })
    expect(counts).toEqual({ outbox: 0, events: 0 })
  })
})

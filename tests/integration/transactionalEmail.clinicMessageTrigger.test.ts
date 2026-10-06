import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import {
  addClinicInquiryNote,
  createAttachmentDraft,
  createVerifiedPatientInquiry,
  finalizeAttachmentDraft,
  readClinicInquiryDetail,
  sendClinicInquiryMessage,
  sendPatientInquiryMessage,
  updateClinicInquiryState,
} from '@/features/inquiryCommunication/service'
import type { InquiryAttachmentStorageGateway } from '@/features/inquiryCommunication/storage'
import { createInquiryModerationReport, decideInquiryModerationCase } from '@/features/inquiryModeration/service'
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
  createPlatformTestUser,
} from '../fixtures/testUsers'
import { testSlug } from '../fixtures/testSlug'

const { closeDeliveryEdgeNetworkBoundary, deliveryEdgeNetworkGuard } = await vi.hoisted(
  () => import('../helpers/deliveryEdgeNetworkBoundary'),
)
vi.mock('@payloadcms/storage-s3', () => ({ s3Storage: () => (incomingConfig: unknown) => incomingConfig }))

describe('clinic message atomic email trigger', () => {
  let payload: Payload
  let patientReq: PayloadRequest
  let clinicReq: PayloadRequest
  let clinicId: number
  let doctorId: number
  const prefix = testSlug('transactionalEmail.clinicMessageTrigger.test.ts')
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
    })
    patientReq = await createLocalReq({}, payload)
    patientReq.user = asPayloadPatientUser(patient)
    const staff = await createClinicTestUser(payload, { createdStaffIds: staffIds, emailPrefix: `${prefix}-clinic` })
    clinicReq = await createLocalReq({}, payload)
    clinicReq.user = await asClinicScopedPayloadUser(payload, staff, clinicId)
  }, 60000)

  afterEach(() => {
    try {
      deliveryEdgeNetworkGuard.assertNoAttempts()
    } finally {
      vi.restoreAllMocks()
      vi.unstubAllEnvs()
      deliveryEdgeNetworkGuard.reinstall()
      deliveryEdgeNetworkGuard.resetAttempts()
    }
  })
  afterAll(async () => {
    try {
      if (!payload) return
      const messages = await payload.find({
        collection: 'inquiryMessages',
        depth: 0,
        pagination: false,
        overrideAccess: true,
        where: { inquiry: { in: inquiryIds } },
      })
      const reportEvents = await payload.find({
        collection: 'inquiryModerationEvents',
        depth: 0,
        pagination: false,
        overrideAccess: true,
        where: { and: [{ inquiry: { in: inquiryIds } }, { eventType: { equals: 'report-received' } }] },
      })
      await cleanupTransactionalEmailFixtures(payload, [
        ...references,
        ...messages.docs.map(({ id }) => `v1|conversation-message|${id}`),
        ...reportEvents.docs.map(({ id }) => `v1|moderation-event|${id}|reporter`),
      ])
      for (const collection of [
        'inquiryModerationEvents',
        'inquiryModerationCases',
        'inquiryAuditEvents',
        'inquiryReadPositions',
        'inquiryMessages',
        'inquiryInternalNotes',
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

  async function createInquiry() {
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
    return inquiry
  }

  it('accepts a real restricted clinic message as terminally suppressed without provider work', async () => {
    const inquiry = await createInquiry()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CI', 'false')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('DEPLOYMENT_ENV', 'preview')
    const sent = await sendClinicInquiryMessage(clinicReq, {
      inquiryId: inquiry.id,
      expectedRevision: 0,
      idempotencyKey: `${prefix}-restricted-reply`,
      text: 'Private reply selected for a normal moderation decision',
    })
    vi.unstubAllEnvs()
    const message = sent.inquiry.timeline.find(
      (item) => item.kind === 'external-message' && item.actor.kind === 'clinic',
    )
    if (!message) throw new Error('Expected the persisted clinic message')
    const messageId = Number(message.id.replace('message:', ''))
    references.push(`v1|conversation-message|${messageId}`)
    const report = await createInquiryModerationReport(patientReq, {
      inquiryId: inquiry.id,
      idempotencyKey: `${prefix}-restricted-report`,
      targetType: 'message',
      targetId: message.id,
      category: 'privacy-concern',
      description: 'Synthetic content restriction test',
    })
    const moderator = await createPlatformTestUser(payload, {
      createdStaffIds: staffIds,
      emailPrefix: `${prefix}-moderator`,
    })
    const moderatorWithCapability = await payload.update({
      collection: 'platformStaff',
      context: { trustedPlatformStaffOps: true },
      data: { capabilities: ['conversation-moderation'] },
      id: moderator.id,
      overrideAccess: true,
      depth: 0,
    })
    const moderatorReq = await createLocalReq({}, payload)
    moderatorReq.user = { ...moderatorWithCapability, collection: 'platformStaff' }
    await decideInquiryModerationCase(moderatorReq, {
      caseId: report.reportId,
      category: 'privacy-concern',
      outcome: 'content-restricted',
      reason: 'Synthetic normal content restriction',
    })
    const commands = bindTransactionalEmail(clinicReq)
    const command = { type: 'conversation.external-message-received' as const, messageId }
    const accepted = await commands.accept(command)
    expect(accepted.deduplicated).toBe(false)
    await expect(commands.accept(command)).resolves.toEqual({ ...accepted, deduplicated: true })
    const delivery: DeliveryAdapter = {
      deliver: vi.fn(async () => ({ type: 'accepted' as const, messageId: 'never' })),
    }
    const worker = createTransactionalEmailWorker(clinicReq, { delivery, suppression: async () => 'cleared' })
    expect(await worker.candidatesForBatch(0)).not.toContain(Number(accepted.operationId))
    await worker.run(accepted.operationId)
    expect(delivery.deliver).not.toHaveBeenCalled()
  })

  it('accepts the persisted clinic message through the catalog before returning and delivers only after commit', async () => {
    const inquiry = await createInquiry()
    const result = await sendClinicInquiryMessage(clinicReq, {
      inquiryId: inquiry.id,
      expectedRevision: 0,
      idempotencyKey: `${prefix}-reply`,
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
    expect(accepted.deduplicated).toBe(true)
    expect(clinicReq.transactionID).toBeUndefined()
    const delivery: DeliveryAdapter = {
      deliver: vi.fn(async () => ({ type: 'accepted' as const, messageId: 'fake-clinic-message' })),
    }
    await createTransactionalEmailWorker(clinicReq, { delivery, suppression: async () => 'cleared' }).run(
      accepted.operationId,
    )
    expect(delivery.deliver).toHaveBeenCalledOnce()
    expect(vi.mocked(delivery.deliver).mock.calls[0]![0]!.text).not.toContain('Private')
  })

  it('accepts attachment-only clinic messages without invoking storage while a transaction is open', async () => {
    const inquiry = await createInquiry()
    const storage: InquiryAttachmentStorageGateway = {
      createReadAccess: vi.fn(),
      createUpload: vi.fn<InquiryAttachmentStorageGateway['createUpload']>(async ({ mimeType }) => ({
        headers: { 'content-type': mimeType },
        method: 'PUT',
        url: 'https://storage.invalid/upload',
      })),
      deleteObjects: vi.fn(),
      sealDraft: vi.fn(async ({ declaredMimeType, declaredSizeBytes, readyObjectKey }) => ({
        mimeType: declaredMimeType,
        sizeBytes: declaredSizeBytes,
        readyObjectKey,
      })),
      verifySealed: vi.fn(async () => {
        if (clinicReq.transactionID !== undefined) throw new Error('Storage network attempted inside a transaction')
      }),
    }
    const draft = await createAttachmentDraft(
      clinicReq,
      { fileName: 'private.pdf', inquiryId: inquiry.id, mimeType: 'application/pdf', sizeBytes: 128 },
      storage,
    )
    const finalized = await finalizeAttachmentDraft(
      clinicReq,
      { draftId: draft.draftId, inquiryId: inquiry.id },
      storage,
    )
    const sent = await sendClinicInquiryMessage(
      clinicReq,
      {
        attachmentDraftId: finalized.attachment.id,
        inquiryId: inquiry.id,
        expectedRevision: 0,
        idempotencyKey: `${prefix}-attachment-reply`,
      },
      storage,
    )
    const activity = sent.inquiry.timeline.find((item) => item.kind === 'external-message' && item.attachment)
    if (!activity) throw new Error('Expected the authoritative attachment-only message')
    const messageId = Number(activity.id.replace('message:', ''))
    const accepted = await bindTransactionalEmail(clinicReq).accept({
      type: 'conversation.external-message-received',
      messageId,
    })
    expect(accepted.deduplicated).toBe(true)
    const delivery: DeliveryAdapter = {
      deliver: vi.fn(async () => ({ type: 'accepted' as const, messageId: 'fake-attachment-message' })),
    }
    await createTransactionalEmailWorker(clinicReq, { delivery, suppression: async () => 'cleared' }).run(
      accepted.operationId,
    )
    expect(delivery.deliver).toHaveBeenCalledOnce()
    expect(vi.mocked(delivery.deliver).mock.calls[0]![0]!.text).not.toContain('private.pdf')
  })

  it.each(['40001', '40P01'])(
    'retries the complete clinic mutation after %s during command acceptance',
    async (code) => {
      const inquiry = await createInquiry()
      const delivery: DeliveryAdapter = {
        deliver: vi.fn(async () => ({ type: 'accepted' as const, messageId: 'fake-retried-message' })),
      }
      const worker = createTransactionalEmailWorker(clinicReq, { delivery, suppression: async () => 'cleared' })
      const queuedBefore = await worker.candidatesForBatch(0)
      const hooks = payload.collections.transactionalEmailEvents.config.hooks.beforeChange
      let attempts = 0
      const failFirstTwo: (typeof hooks)[number] = ({ data }) => {
        if (data.type === 'command.accepted' && ++attempts < 3)
          throw Object.assign(new Error('Synthetic database conflict'), { code })
        return data
      }
      hooks.push(failFirstTwo)
      let sent
      try {
        sent = await sendClinicInquiryMessage(clinicReq, {
          inquiryId: inquiry.id,
          expectedRevision: 0,
          idempotencyKey: `${prefix}-retry-${code}`,
          text: 'Private retry reply',
        })
      } finally {
        hooks.splice(hooks.indexOf(failFirstTwo), 1)
      }
      const detail = await readClinicInquiryDetail(clinicReq, { inquiryId: inquiry.id })
      expect(detail.inquiry.revision).toBe(1)
      const messages = detail.inquiry.timeline.filter(
        (item) => item.kind === 'external-message' && item.text === 'Private retry reply',
      )
      expect(messages).toHaveLength(1)
      expect(attempts).toBe(3)
      expect(sent.replayed).toBe(false)
      const messageId = Number(messages[0]!.id.replace('message:', ''))
      const accepted = await bindTransactionalEmail(clinicReq).accept({
        type: 'conversation.external-message-received',
        messageId,
      })
      expect(accepted.deduplicated).toBe(true)
      expect(await worker.candidatesForBatch(0)).toEqual([...queuedBefore, Number(accepted.operationId)])
      await worker.run(accepted.operationId)
      expect(delivery.deliver).toHaveBeenCalledOnce()
    },
  )

  it('rolls back the clinic message, state, audit and read position on an unexpected accepted-event failure', async () => {
    const inquiry = await createInquiry()
    const before = await readClinicInquiryDetail(clinicReq, { inquiryId: inquiry.id })
    const worker = createTransactionalEmailWorker(clinicReq, {
      delivery: { deliver: vi.fn() },
      suppression: async () => 'cleared',
    })
    const queuedBefore = await worker.candidatesForBatch(0)
    const hooks = payload.collections.transactionalEmailEvents.config.hooks.beforeChange
    const fail: (typeof hooks)[number] = ({ data }) => {
      if (data.type === 'command.accepted') throw new Error('Synthetic accepted-event storage failure')
      return data
    }
    const input = {
      inquiryId: inquiry.id,
      expectedRevision: 0,
      idempotencyKey: `${prefix}-rollback`,
      text: 'Private rollback reply',
    }
    hooks.push(fail)
    try {
      await expect(sendClinicInquiryMessage(clinicReq, input)).rejects.toMatchObject({ code: 'storage-unavailable' })
    } finally {
      hooks.splice(hooks.indexOf(fail), 1)
    }
    expect(await readClinicInquiryDetail(clinicReq, { inquiryId: inquiry.id })).toEqual(before)
    expect(await worker.candidatesForBatch(0)).toEqual(queuedBefore)
    const sent = await sendClinicInquiryMessage(clinicReq, input)
    expect(sent.replayed).toBe(false)
    expect(sent.inquiry.revision).toBe(1)
  })

  it('stops after three conflicting complete attempts and leaves no clinic mutation or queued operation', async () => {
    const inquiry = await createInquiry()
    const before = await readClinicInquiryDetail(clinicReq, { inquiryId: inquiry.id })
    const worker = createTransactionalEmailWorker(clinicReq, {
      delivery: { deliver: vi.fn() },
      suppression: async () => 'cleared',
    })
    const queuedBefore = await worker.candidatesForBatch(0)
    const hooks = payload.collections.transactionalEmailEvents.config.hooks.beforeChange
    let attempts = 0
    const conflict: (typeof hooks)[number] = ({ data }) => {
      if (data.type === 'command.accepted') {
        attempts++
        throw Object.assign(new Error('Synthetic exhausted conflict'), { code: '40001' })
      }
      return data
    }
    hooks.push(conflict)
    try {
      await expect(
        sendClinicInquiryMessage(clinicReq, {
          inquiryId: inquiry.id,
          expectedRevision: 0,
          idempotencyKey: `${prefix}-exhausted`,
          text: 'Private exhausted reply',
        }),
      ).rejects.toMatchObject({ kind: 'conflict' })
    } finally {
      hooks.splice(hooks.indexOf(conflict), 1)
    }
    expect(attempts).toBe(3)
    expect(await readClinicInquiryDetail(clinicReq, { inquiryId: inquiry.id })).toEqual(before)
    expect(await worker.candidatesForBatch(0)).toEqual(queuedBefore)
  })

  it('rolls back attachment binding with the message when command storage fails', async () => {
    const inquiry = await createInquiry()
    const storage: InquiryAttachmentStorageGateway = {
      createReadAccess: vi.fn(),
      createUpload: vi.fn<InquiryAttachmentStorageGateway['createUpload']>(async ({ mimeType }) => ({
        headers: { 'content-type': mimeType },
        method: 'PUT',
        url: 'https://storage.invalid/upload',
      })),
      deleteObjects: vi.fn(),
      sealDraft: vi.fn(async ({ declaredMimeType, declaredSizeBytes, readyObjectKey }) => ({
        mimeType: declaredMimeType,
        sizeBytes: declaredSizeBytes,
        readyObjectKey,
      })),
      verifySealed: vi.fn(async () => undefined),
    }
    const draft = await createAttachmentDraft(
      clinicReq,
      { fileName: 'rollback.pdf', inquiryId: inquiry.id, mimeType: 'application/pdf', sizeBytes: 128 },
      storage,
    )
    const finalized = await finalizeAttachmentDraft(
      clinicReq,
      { draftId: draft.draftId, inquiryId: inquiry.id },
      storage,
    )
    const before = await readClinicInquiryDetail(clinicReq, { inquiryId: inquiry.id })
    const hooks = payload.collections.transactionalEmailOutbox.config.hooks.beforeChange
    const fail: (typeof hooks)[number] = () => {
      throw new Error('Synthetic command storage failure')
    }
    hooks.push(fail)
    const input = {
      attachmentDraftId: finalized.attachment.id,
      inquiryId: inquiry.id,
      expectedRevision: 0,
      idempotencyKey: `${prefix}-attachment-rollback`,
    }
    try {
      await expect(sendClinicInquiryMessage(clinicReq, input, storage)).rejects.toMatchObject({
        code: 'storage-unavailable',
      })
    } finally {
      hooks.splice(hooks.indexOf(fail), 1)
    }
    expect(await readClinicInquiryDetail(clinicReq, { inquiryId: inquiry.id })).toEqual(before)
    expect(
      await payload.findByID({
        collection: 'inquiryAttachments',
        id: finalized.attachment.id,
        depth: 0,
        overrideAccess: true,
      }),
    ).toMatchObject({ state: 'verified', boundMessage: null })
    const sent = await sendClinicInquiryMessage(clinicReq, input, storage)
    expect(sent.replayed).toBe(false)
    expect(sent.inquiry.timeline.filter((item) => item.kind === 'external-message' && item.attachment)).toHaveLength(1)
  })

  it('reuses the committed operation on normal and concurrent idempotent replay', async () => {
    const inquiry = await createInquiry()
    const input = {
      inquiryId: inquiry.id,
      expectedRevision: 0,
      idempotencyKey: `${prefix}-parallel`,
      text: 'Private concurrent reply',
    }
    const competingReq = await createLocalReq({}, payload)
    competingReq.user = clinicReq.user
    const responses = await Promise.all([
      sendClinicInquiryMessage(clinicReq, input),
      sendClinicInquiryMessage(competingReq, input),
    ])
    const replay = await sendClinicInquiryMessage(clinicReq, input)
    expect(replay.replayed).toBe(true)
    expect(responses.map(({ inquiry: current }) => current.revision)).toEqual([1, 1])
    const messages = replay.inquiry.timeline.filter(
      (item) => item.kind === 'external-message' && item.text === input.text,
    )
    expect(messages).toHaveLength(1)
    const messageId = Number(messages[0]!.id.replace('message:', ''))
    const receipt = await bindTransactionalEmail(clinicReq).accept({
      type: 'conversation.external-message-received',
      messageId,
    })
    expect(receipt.deduplicated).toBe(true)
    const worker = createTransactionalEmailWorker(clinicReq, {
      delivery: { deliver: vi.fn() },
      suppression: async () => 'cleared',
    })
    expect((await worker.candidatesForBatch(0)).filter((id) => id === Number(receipt.operationId))).toHaveLength(1)
  })

  it('keeps patient messages, internal clinic notes, status-only changes and rejected sends outside the email trigger', async () => {
    const inquiry = await createInquiry()
    const worker = createTransactionalEmailWorker(clinicReq, {
      delivery: { deliver: vi.fn() },
      suppression: async () => 'cleared',
    })
    const before = await worker.candidatesForBatch(0)
    const patient = await sendPatientInquiryMessage(patientReq, {
      inquiryId: inquiry.id,
      expectedRevision: 0,
      idempotencyKey: `${prefix}-patient`,
      text: 'Private patient reply',
    })
    const note = await addClinicInquiryNote(clinicReq, {
      inquiryId: inquiry.id,
      idempotencyKey: `${prefix}-note`,
      text: 'Private internal note',
    })
    const closed = await updateClinicInquiryState(clinicReq, {
      inquiryId: inquiry.id,
      expectedRevision: note.inquiry.revision,
      action: 'close',
    })
    await expect(
      sendClinicInquiryMessage(clinicReq, {
        inquiryId: inquiry.id,
        expectedRevision: closed.inquiry.revision,
        idempotencyKey: `${prefix}-rejected`,
        text: 'Private rejected reply',
      }),
    ).rejects.toMatchObject({ kind: 'invalid-state' })
    expect(
      patient.inquiry.timeline.some(
        (item) => item.kind === 'external-message' && item.text === 'Private patient reply',
      ),
    ).toBe(true)
    expect(note.inquiry.timeline.some((item) => item.kind === 'internal-note')).toBe(true)
    expect(await worker.candidatesForBatch(0)).toEqual(before)
  })

  it.each(['preview', 'production'])(
    'preserves normal clinic messaging with the hosted %s command inactive',
    async (environment) => {
      const inquiry = await createInquiry()
      const worker = createTransactionalEmailWorker(clinicReq, {
        delivery: { deliver: vi.fn() },
        suppression: async () => 'cleared',
      })
      const before = await worker.candidatesForBatch(0)
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('CI', 'false')
      vi.stubEnv('VERCEL_ENV', environment)
      vi.stubEnv('DEPLOYMENT_ENV', environment)
      const sent = await sendClinicInquiryMessage(clinicReq, {
        inquiryId: inquiry.id,
        expectedRevision: 0,
        idempotencyKey: `${prefix}-inactive-${environment}`,
        text: 'Private inactive reply',
      })
      expect(sent.inquiry.revision).toBe(1)
      expect(
        sent.inquiry.timeline.some(
          (item) => item.kind === 'external-message' && item.text === 'Private inactive reply',
        ),
      ).toBe(true)
      vi.unstubAllEnvs()
      expect(await worker.candidatesForBatch(0)).toEqual(before)
    },
  )

  it('keeps the committed clinic response unchanged when the later provider attempt fails', async () => {
    const inquiry = await createInquiry()
    const sent = await sendClinicInquiryMessage(clinicReq, {
      inquiryId: inquiry.id,
      expectedRevision: 0,
      idempotencyKey: `${prefix}-provider-failure`,
      text: 'Private committed reply',
    })
    const activity = sent.inquiry.timeline.find(
      (item) => item.kind === 'external-message' && item.text === 'Private committed reply',
    )
    if (!activity) throw new Error('Expected the committed clinic message')
    const messageId = Number(activity.id.replace('message:', ''))
    const accepted = await bindTransactionalEmail(clinicReq).accept({
      type: 'conversation.external-message-received',
      messageId,
    })
    const log = vi.fn()
    const delivery: DeliveryAdapter = { deliver: vi.fn(async () => ({ type: 'permanent' as const })) }
    await createTransactionalEmailWorker(clinicReq, { delivery, log, suppression: async () => 'cleared' }).run(
      accepted.operationId,
    )
    expect(delivery.deliver).toHaveBeenCalledOnce()
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ outboxState: 'failed' }))
    expect((await readClinicInquiryDetail(clinicReq, { inquiryId: inquiry.id })).inquiry).toEqual(sent.inquiry)
    expect(JSON.stringify(log.mock.calls)).not.toContain('Private')
  })
})

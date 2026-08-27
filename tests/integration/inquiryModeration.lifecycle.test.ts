import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'

import config from '@payload-config'
import {
  addClinicInquiryNote,
  createVerifiedPatientInquiry,
  readClinicInquiryDetail,
  readPatientInquiryDetail,
  readPatientInquiryQueue,
  sendClinicInquiryMessage,
  sendPatientInquiryMessage,
} from '@/features/inquiryCommunication/service'
import { createInquiryModerationReport, InquiryModerationServiceError } from '@/features/inquiryModeration/service'
import {
  decideInquiryModerationAppeal,
  decideInquiryModerationCase,
  expandInquiryModerationAccess,
  readInquiryModerationCase,
  reconcileExpiredInquiryModerationMeasures,
  submitInquiryModerationAppeal,
} from '@/features/inquiryModeration/service'
import {
  hardDeleteInquiryContent,
  placeInquiryLegalHold,
  readInquiryRetentionReviewQueue,
  releaseInquiryLegalHold,
} from '@/features/inquiryRetention/service'
import { moderationReviewDueAt } from '@/features/inquiryRetention/policy'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import {
  asClinicScopedPayloadUser,
  asPayloadPatientUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPatientTestUser,
  createPlatformTestUser,
} from '../fixtures/testUsers'

vi.mock('@payloadcms/storage-s3', () => ({
  s3Storage: () => (incomingConfig: unknown) => incomingConfig,
}))

describe('inquiry moderation lifecycle', () => {
  let payload: Payload
  let patientReq: PayloadRequest
  let foreignPatientReq: PayloadRequest
  let clinicReq: PayloadRequest
  let moderatorReq: PayloadRequest
  let platformWithoutCapabilityReq: PayloadRequest
  let clinicId: number
  let doctorId: number
  const createdInquiryIds: Array<number | string> = []
  const createdPatientIds: Array<number | string> = []
  const createdStaffIds: Array<number | string> = []
  const slugPrefix = testSlug('inquiryModeration.lifecycle.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const city = (await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })).docs[0]
    if (!city) throw new Error('Expected baseline city')
    const fixture = await createClinicFixture(payload, city.id, { slugPrefix })
    clinicId = fixture.clinic.id
    doctorId = fixture.doctor.id

    const patient = await createPatientTestUser(payload, {
      createdPatientIds,
      emailPrefix: `${slugPrefix}-patient`,
      firstName: 'Synthetic',
      lastName: 'Patient',
    })
    const foreignPatient = await createPatientTestUser(payload, {
      createdPatientIds,
      emailPrefix: `${slugPrefix}-foreign`,
      firstName: 'Foreign',
      lastName: 'Patient',
    })
    const clinicStaff = await createClinicTestUser(payload, {
      createdStaffIds,
      emailPrefix: `${slugPrefix}-clinic`,
      firstName: 'Synthetic',
      lastName: 'Clinic',
    })

    patientReq = await createLocalReq({}, payload)
    patientReq.user = asPayloadPatientUser(patient)
    foreignPatientReq = await createLocalReq({}, payload)
    foreignPatientReq.user = asPayloadPatientUser(foreignPatient)
    clinicReq = await createLocalReq({}, payload)
    clinicReq.user = await asClinicScopedPayloadUser(payload, clinicStaff, clinicId)

    const moderator = await createPlatformTestUser(payload, {
      createdStaffIds,
      emailPrefix: `${slugPrefix}-moderator`,
      firstName: 'Synthetic',
      lastName: 'Moderator',
    })
    const moderatorWithCapability = await payload.update({
      collection: 'platformStaff',
      context: { trustedPlatformStaffOps: true },
      data: { capabilities: ['conversation-moderation', 'inquiry-retention'] },
      depth: 0,
      id: moderator.id,
      overrideAccess: true,
    })
    moderatorReq = await createLocalReq({}, payload)
    moderatorReq.user = { ...moderatorWithCapability, collection: 'platformStaff' } as never

    const platformWithoutCapability = await createPlatformTestUser(payload, {
      createdStaffIds,
      emailPrefix: `${slugPrefix}-platform-no-capability`,
    })
    platformWithoutCapabilityReq = await createLocalReq({}, payload)
    platformWithoutCapabilityReq.user = { ...platformWithoutCapability, collection: 'platformStaff' } as never
  }, 60_000)

  afterAll(async () => {
    for (const collection of [
      'inquiryLegalHolds',
      'inquiryDeletionProofs',
      'inquiryModerationEvents',
      'inquiryModerationCases',
      'inquiryAuditEvents',
      'inquiryReadPositions',
      'inquiryMessages',
      'inquiryInternalNotes',
      'inquiryAttachments',
      'inquiryConversations',
    ]) {
      await payload.delete({
        collection: collection as never,
        overrideAccess: true,
        where:
          collection === 'inquiryLegalHolds'
            ? { placedBy: { equals: moderatorReq.user?.id } }
            : collection === 'inquiryDeletionProofs'
              ? { inquiryId: { in: createdInquiryIds.map(String) } }
              : { inquiry: { in: createdInquiryIds } },
      } as never)
    }
    for (const id of createdInquiryIds) {
      await payload.delete({ collection: 'patientClinicInquiries', id, overrideAccess: true })
    }
    await cleanupTrackedUsers(payload, { patientIds: createdPatientIds, staffIds: createdStaffIds })
    await payload.delete({ collection: 'doctors', overrideAccess: true, where: { clinic: { equals: clinicId } } })
    await payload.delete({ collection: 'clinics', id: clinicId, overrideAccess: true })
  })

  it('opens a report for the opposite-party message without restricting content or a foreign tenant', async () => {
    const created = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(doctorId),
      idempotencyKey: `${slugPrefix}-inquiry-create`,
      message: 'Synthetic inquiry for moderation.',
      phoneNumber: '+493000000001',
    })
    createdInquiryIds.push(created.inquiry.id)
    const sent = await sendClinicInquiryMessage(clinicReq, {
      expectedRevision: created.inquiry.revision,
      idempotencyKey: `${slugPrefix}-clinic-message`,
      inquiryId: created.inquiry.id,
      text: 'Synthetic clinic reply that remains visible after reporting.',
    })
    const message = sent.inquiry.timeline.find(
      (item) => item.kind === 'external-message' && item.actor.kind === 'clinic',
    )
    if (!message) throw new Error('Expected clinic message')

    const receipt = await createInquiryModerationReport(patientReq, {
      category: 'privacy-concern',
      description: 'Synthetic wrong-recipient report.',
      idempotencyKey: `${slugPrefix}-report-0001`,
      inquiryId: created.inquiry.id,
      targetId: message.id,
      targetType: 'message',
    })
    const hold = await placeInquiryLegalHold(moderatorReq, {
      reasonCategory: 'regulatory-review',
      responsibleFunction: 'data-protection',
      reviewAt: '2027-08-24T00:00:00.000Z',
      targetId: receipt.reportId,
      targetType: 'moderation-case',
    })
    await expect(
      hardDeleteInquiryContent(moderatorReq, {
        inquiryId: created.inquiry.id,
        reasonCategory: 'authorized-erasure',
        targetId: message.id.replace(/^message:/u, ''),
        targetType: 'message',
      }),
    ).rejects.toMatchObject({ kind: 'invalid-state' })
    await releaseInquiryLegalHold(moderatorReq, { holdId: hold.holdId })

    await expect(
      createInquiryModerationReport(patientReq, {
        category: 'privacy-concern',
        description: 'Synthetic wrong-recipient report.',
        idempotencyKey: `${slugPrefix}-report-0001`,
        inquiryId: created.inquiry.id,
        targetId: message.id,
        targetType: 'message',
      }),
    ).resolves.toEqual(receipt)
    await expect(
      createInquiryModerationReport(patientReq, {
        category: 'privacy-concern',
        idempotencyKey: `${slugPrefix}-report-duplicate-target`,
        inquiryId: created.inquiry.id,
        targetId: message.id,
        targetType: 'message',
      }),
    ).rejects.toMatchObject({ kind: 'invalid-state' } satisfies Partial<InquiryModerationServiceError>)

    const secondSent = await sendClinicInquiryMessage(clinicReq, {
      expectedRevision: sent.inquiry.revision,
      idempotencyKey: `${slugPrefix}-clinic-message-concurrent-report`,
      inquiryId: created.inquiry.id,
      text: 'Synthetic clinic reply for a concurrent duplicate report.',
    })
    const secondMessage = secondSent.inquiry.timeline.find(
      (item) =>
        item.kind === 'external-message' &&
        item.actor.kind === 'clinic' &&
        item.text === 'Synthetic clinic reply for a concurrent duplicate report.',
    )
    if (!secondMessage) throw new Error('Expected concurrent report target message')
    const secondPatientReq = await createLocalReq({}, payload)
    secondPatientReq.user = patientReq.user
    const concurrent = await Promise.allSettled([
      createInquiryModerationReport(patientReq, {
        category: 'privacy-concern',
        idempotencyKey: `${slugPrefix}-concurrent-report-one`,
        inquiryId: created.inquiry.id,
        targetId: secondMessage.id,
        targetType: 'message',
      }),
      createInquiryModerationReport(secondPatientReq, {
        category: 'privacy-concern',
        idempotencyKey: `${slugPrefix}-concurrent-report-two`,
        inquiryId: created.inquiry.id,
        targetId: secondMessage.id.replace(/^message:/u, ''),
        targetType: 'message',
      }),
    ])
    expect(concurrent.filter(({ status }) => status === 'fulfilled')).toHaveLength(1)
    expect(concurrent.filter(({ status }) => status === 'rejected')).toHaveLength(1)
    const rejected = concurrent.find(({ status }) => status === 'rejected')
    expect(rejected).toMatchObject({
      reason: expect.objectContaining({ kind: expect.stringMatching(/conflict|invalid-state/u) }),
      status: 'rejected',
    })
    const moderationLocks = await payload.find({
      collection: 'inquiryCommandLocks',
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    expect(moderationLocks.totalDocs).toBe(0)

    expect(receipt).toMatchObject({ received: true, reportId: expect.any(String) })
    const cases = await payload.find({
      collection: 'inquiryModerationCases' as never,
      depth: 0,
      limit: 10,
      overrideAccess: true,
      where: { inquiry: { equals: created.inquiry.id } },
    })
    expect(cases.docs).toHaveLength(2)
    expect(cases.docs.find(({ id }) => String(id) === receipt.reportId)).toMatchObject({
      category: 'privacy-concern',
      reporterKind: 'patient',
      status: 'open',
      targetType: 'message',
    })

    const detail = await readPatientInquiryDetail(patientReq, { inquiryId: created.inquiry.id })
    expect(detail.actions.canReply).toBe(true)
    expect(detail.timeline).toContainEqual(
      expect.objectContaining({
        id: message.id,
        kind: 'external-message',
        text: 'Synthetic clinic reply that remains visible after reporting.',
      }),
    )

    await expect(
      createInquiryModerationReport(foreignPatientReq, {
        category: 'privacy-concern',
        idempotencyKey: `${slugPrefix}-foreign-report`,
        inquiryId: created.inquiry.id,
        targetId: message.id,
        targetType: 'message',
      }),
    ).rejects.toMatchObject({ kind: 'not-found' } satisfies Partial<InquiryModerationServiceError>)
  })

  it('requires additive capability, logs scoped access, and restricts only the decided message', async () => {
    const created = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(doctorId),
      idempotencyKey: `${slugPrefix}-moderated-inquiry-create`,
      message: 'Synthetic inquiry for a controlled moderation decision.',
      phoneNumber: '+493000000002',
    })
    createdInquiryIds.push(created.inquiry.id)
    const sent = await sendClinicInquiryMessage(clinicReq, {
      expectedRevision: created.inquiry.revision,
      idempotencyKey: `${slugPrefix}-moderated-clinic-message`,
      inquiryId: created.inquiry.id,
      text: 'Synthetic message selected for restriction.',
    })
    const message = sent.inquiry.timeline.find(
      (item) => item.kind === 'external-message' && item.actor.kind === 'clinic',
    )
    if (!message) throw new Error('Expected clinic message')
    const report = await createInquiryModerationReport(patientReq, {
      category: 'harassment-threats',
      description: 'Synthetic controlled report.',
      idempotencyKey: `${slugPrefix}-controlled-report`,
      inquiryId: created.inquiry.id,
      targetId: message.id,
      targetType: 'message',
    })

    await expect(
      readInquiryModerationCase(platformWithoutCapabilityReq, { caseId: report.reportId, scope: 'reported-object' }),
    ).rejects.toMatchObject({ kind: 'access-denied' } satisfies Partial<InquiryModerationServiceError>)

    const initial = await readInquiryModerationCase(moderatorReq, {
      caseId: report.reportId,
      scope: 'reported-object',
    })
    expect(initial).toMatchObject({
      caseId: report.reportId,
      category: 'harassment-threats',
      description: 'Synthetic controlled report.',
      target: { id: message.id, text: 'Synthetic message selected for restriction.', type: 'message' },
    })
    expect(initial).not.toHaveProperty('conversation')

    await expect(
      readInquiryModerationCase(moderatorReq, { caseId: report.reportId, scope: 'full-conversation' }),
    ).rejects.toMatchObject({ kind: 'invalid-state' } satisfies Partial<InquiryModerationServiceError>)

    await expandInquiryModerationAccess(moderatorReq, {
      caseId: report.reportId,
      reason: 'Need the surrounding external exchange to assess the report.',
    })
    const expanded = await readInquiryModerationCase(moderatorReq, {
      caseId: report.reportId,
      scope: 'full-conversation',
    })
    expect(expanded.conversation?.some((item) => item.id === message.id)).toBe(true)

    const inquiryBeforeDecision = await payload.findByID({
      collection: 'patientClinicInquiries',
      depth: 0,
      id: created.inquiry.id,
      overrideAccess: true,
    })
    const effectiveUntil = new Date(Date.now() + 60_000).toISOString()
    await decideInquiryModerationCase(moderatorReq, {
      caseId: report.reportId,
      category: 'harassment-threats',
      effectiveUntil,
      outcome: 'content-restricted',
      reason: 'Synthetic decision rationale.',
    })

    const inquiryAfterDecision = await payload.findByID({
      collection: 'patientClinicInquiries',
      depth: 0,
      id: created.inquiry.id,
      overrideAccess: true,
    })
    expect(inquiryAfterDecision.lastExternalActivityAt).toBe(inquiryBeforeDecision.lastExternalActivityAt)

    const patientDetail = await readPatientInquiryDetail(patientReq, { inquiryId: created.inquiry.id })
    expect(patientDetail.actions.canReply).toBe(true)
    expect(patientDetail.timeline).toContainEqual(
      expect.objectContaining({
        contentState: 'restricted',
        id: message.id,
        kind: 'external-message',
      }),
    )
    expect(JSON.stringify(patientDetail)).not.toContain('Synthetic message selected for restriction.')
    const patientQueue = await readPatientInquiryQueue(patientReq, { lifecycle: 'all', limit: 50 })
    expect(patientQueue.items.find(({ id }) => id === created.inquiry.id)).toMatchObject({
      latestActivityKind: 'system-event',
      preview: 'Communication restricted',
    })
    const affectedClinicDetail = await readClinicInquiryDetail(clinicReq, { inquiryId: created.inquiry.id })
    expect(affectedClinicDetail.inquiry.timeline).toContainEqual(
      expect.objectContaining({
        contentState: 'restricted',
        id: message.id,
        moderation: expect.objectContaining({
          appeal: { caseId: report.reportId, state: 'available' },
          category: 'harassment-threats',
          isCurrentActorAffected: true,
        }),
      }),
    )

    const events = await payload.find({
      collection: 'inquiryModerationEvents' as never,
      depth: 0,
      limit: 20,
      overrideAccess: true,
      sort: 'sequence',
      where: { moderationCase: { equals: report.reportId } },
    })
    expect(events.docs.map((event) => (event as { eventType: string }).eventType)).toEqual([
      'report-received',
      'case-accessed',
      'access-expanded',
      'case-accessed',
      'decision-recorded',
    ])

    await submitInquiryModerationAppeal(clinicReq, {
      caseId: report.reportId,
      text: 'Synthetic appeal asking for a second review.',
    })
    await expect(
      submitInquiryModerationAppeal(foreignPatientReq, {
        caseId: report.reportId,
        text: 'A foreign participant must not learn that this appeal is already pending.',
      }),
    ).rejects.toMatchObject({ kind: 'not-found' } satisfies Partial<InquiryModerationServiceError>)
    await expect(
      submitInquiryModerationAppeal(clinicReq, {
        caseId: report.reportId,
        text: 'A second appeal must not be accepted.',
      }),
    ).rejects.toMatchObject({ kind: 'invalid-state' } satisfies Partial<InquiryModerationServiceError>)

    const appealedDetail = await readPatientInquiryDetail(patientReq, { inquiryId: created.inquiry.id })
    expect(appealedDetail.timeline).toContainEqual(
      expect.objectContaining({ contentState: 'restricted', id: message.id }),
    )
    await decideInquiryModerationAppeal(moderatorReq, {
      caseId: report.reportId,
      outcome: 'overturned',
      reason: 'Synthetic appeal review restored the original content.',
    })

    const overturnedCase = await payload.findByID({
      collection: 'inquiryModerationCases',
      depth: 0,
      id: report.reportId,
      overrideAccess: true,
    })
    expect(overturnedCase).toMatchObject({
      appealOutcome: 'overturned',
      finalOutcomeAt: expect.any(String),
      measureEndedAt: expect.any(String),
      status: 'resolved',
    })
    expect(overturnedCase.retentionReviewDueAt).toBe(
      moderationReviewDueAt({
        finalOutcomeAt: String(overturnedCase.finalOutcomeAt),
        measureEndedAt: String(overturnedCase.measureEndedAt),
        reviewMonths: 24,
      }),
    )
    await expect(
      reconcileExpiredInquiryModerationMeasures(moderatorReq, {
        inquiryId: created.inquiry.id,
        now: new Date(Date.parse(effectiveUntil) + 1_000),
      }),
    ).resolves.toEqual({ reconciled: 0 })

    const restoredDetail = await readPatientInquiryDetail(patientReq, { inquiryId: created.inquiry.id })
    expect(restoredDetail.actions.canReply).toBe(true)
    expect(restoredDetail.timeline).toContainEqual(
      expect.objectContaining({
        contentState: 'available',
        id: message.id,
        text: 'Synthetic message selected for restriction.',
      }),
    )
    expect(restoredDetail.timeline).toContainEqual(
      expect.objectContaining({ event: 'moderation-restored', kind: 'system-event' }),
    )
    const restoredQueue = await readPatientInquiryQueue(patientReq, { lifecycle: 'all', limit: 50 })
    expect(restoredQueue.changeCursor).not.toBe(patientQueue.changeCursor)
    expect(restoredQueue.items.find(({ id }) => id === created.inquiry.id)).toMatchObject({
      latestActivityKind: 'system-event',
      preview: 'Communication restored',
    })
    const finalEvents = await payload.find({
      collection: 'inquiryModerationEvents' as never,
      depth: 0,
      limit: 20,
      overrideAccess: true,
      sort: 'sequence',
      where: { moderationCase: { equals: report.reportId } },
    })
    expect(finalEvents.docs.map((event) => (event as { eventType: string }).eventType)).toEqual([
      'report-received',
      'case-accessed',
      'access-expanded',
      'case-accessed',
      'decision-recorded',
      'appeal-submitted',
      'appeal-decided',
    ])

    await hardDeleteInquiryContent(moderatorReq, {
      inquiryId: created.inquiry.id,
      reasonCategory: 'authorized-erasure',
      targetId: message.id.replace(/^message:/u, ''),
      targetType: 'message',
    })
    await (
      payload.db as unknown as {
        pool: { query: (query: string, values: unknown[]) => Promise<unknown> }
      }
    ).pool.query('UPDATE inquiry_messages SET content_state = $1, text = $2 WHERE id = $3', [
      'available',
      'Synthetic message selected for restriction.',
      Number(message.id.replace(/^message:/u, '')),
    ])
    const afterRestore = await readInquiryModerationCase(moderatorReq, {
      caseId: report.reportId,
      scope: 'reported-object',
    })
    expect(afterRestore.target).toMatchObject({ contentState: 'hard-deleted', id: message.id })
    expect(afterRestore.target).not.toHaveProperty('text')
  })

  it('blocks a suspended patient from writing across conversations while preserving read access', async () => {
    const first = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(doctorId),
      idempotencyKey: `${slugPrefix}-suspended-inquiry-one`,
      message: 'First synthetic inquiry before a messaging suspension.',
      phoneNumber: '+493000000003',
    })
    const second = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(doctorId),
      idempotencyKey: `${slugPrefix}-suspended-inquiry-two`,
      message: 'Second synthetic inquiry before a messaging suspension.',
      phoneNumber: '+493000000003',
    })
    createdInquiryIds.push(first.inquiry.id, second.inquiry.id)
    const patientMessageResult = await sendPatientInquiryMessage(patientReq, {
      expectedRevision: first.inquiry.revision,
      idempotencyKey: `${slugPrefix}-suspended-patient-message`,
      inquiryId: first.inquiry.id,
      text: 'Synthetic patient message selected for an identity decision.',
    })
    const patientMessage = patientMessageResult.inquiry.timeline.find(
      (item) => item.kind === 'external-message' && item.actor.kind === 'patient',
    )
    if (!patientMessage) throw new Error('Expected patient message')
    const report = await createInquiryModerationReport(clinicReq, {
      category: 'harassment-threats',
      idempotencyKey: `${slugPrefix}-identity-report`,
      inquiryId: first.inquiry.id,
      targetId: patientMessage.id,
      targetType: 'message',
    })
    await decideInquiryModerationCase(moderatorReq, {
      affectedActor: { id: String(patientReq.user?.id), kind: 'patient' },
      caseId: report.reportId,
      category: 'harassment-threats',
      outcome: 'identity-messaging-suspended',
      reason: 'Synthetic cross-conversation suspension decision.',
    })

    const firstDetail = await readPatientInquiryDetail(patientReq, { inquiryId: first.inquiry.id })
    const secondDetail = await readPatientInquiryDetail(patientReq, { inquiryId: second.inquiry.id })
    expect(firstDetail.actions.canReply).toBe(false)
    expect(secondDetail.actions.canReply).toBe(false)
    expect(firstDetail.timeline.length).toBeGreaterThan(0)
    expect(secondDetail.originalRequest.message).toBe('Second synthetic inquiry before a messaging suspension.')
    expect(firstDetail.moderation?.identity).toMatchObject({
      appeal: { caseId: report.reportId, state: 'available' },
      isCurrentActorAffected: true,
      state: 'messaging-suspended',
    })
    await expect(
      sendPatientInquiryMessage(patientReq, {
        expectedRevision: secondDetail.revision,
        idempotencyKey: `${slugPrefix}-blocked-cross-conversation-message`,
        inquiryId: second.inquiry.id,
        text: 'This message must remain blocked.',
      }),
    ).rejects.toMatchObject({ kind: 'invalid-state' } satisfies Partial<InquiryModerationServiceError>)
  })

  it('blocks both external writers for a restricted conversation while preserving clinic notes and lifecycle', async () => {
    const created = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(doctorId),
      idempotencyKey: `${slugPrefix}-conversation-inquiry`,
      message: 'Synthetic inquiry before a conversation restriction.',
      phoneNumber: '+493000000004',
    })
    createdInquiryIds.push(created.inquiry.id)
    const conversation = (
      await payload.find({
        collection: 'inquiryConversations',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: { inquiry: { equals: created.inquiry.id } },
      })
    ).docs[0]
    if (!conversation) throw new Error('Expected inquiry conversation')

    const report = await createInquiryModerationReport(patientReq, {
      category: 'spam-fraud-impersonation',
      description: 'Synthetic whole-conversation report.',
      idempotencyKey: `${slugPrefix}-conversation-report`,
      inquiryId: created.inquiry.id,
      targetId: String(conversation.id),
      targetType: 'conversation',
    })
    const initialModerationRead = await readInquiryModerationCase(moderatorReq, {
      caseId: report.reportId,
      scope: 'full-conversation',
    })
    expect(initialModerationRead.conversation).toBeDefined()

    await decideInquiryModerationCase(moderatorReq, {
      affectedActor: { id: String(patientReq.user?.id), kind: 'patient' },
      caseId: report.reportId,
      category: 'spam-fraud-impersonation',
      outcome: 'conversation-restricted',
      reason: 'Synthetic conversation restriction decision.',
    })

    const patientDetail = await readPatientInquiryDetail(patientReq, { inquiryId: created.inquiry.id })
    const clinicDetail = await readClinicInquiryDetail(clinicReq, { inquiryId: created.inquiry.id })
    expect(patientDetail).toMatchObject({ actions: { canReply: false }, lifecycle: 'open' })
    expect(clinicDetail.inquiry).toMatchObject({ actions: { canReply: false }, lifecycle: 'open' })
    expect(patientDetail.moderation?.conversation).toMatchObject({
      appeal: { caseId: report.reportId, state: 'available' },
      isCurrentActorAffected: true,
      state: 'restricted',
    })
    expect(clinicDetail.inquiry.moderation?.conversation).toMatchObject({
      isCurrentActorAffected: false,
      state: 'restricted',
    })

    await expect(
      sendPatientInquiryMessage(patientReq, {
        expectedRevision: patientDetail.revision,
        idempotencyKey: `${slugPrefix}-blocked-patient-conversation-message`,
        inquiryId: created.inquiry.id,
        text: 'This patient message must remain blocked.',
      }),
    ).rejects.toMatchObject({ kind: 'invalid-state' } satisfies Partial<InquiryModerationServiceError>)
    await expect(
      sendClinicInquiryMessage(clinicReq, {
        expectedRevision: clinicDetail.inquiry.revision,
        idempotencyKey: `${slugPrefix}-blocked-clinic-conversation-message`,
        inquiryId: created.inquiry.id,
        text: 'This clinic message must remain blocked.',
      }),
    ).rejects.toMatchObject({ kind: 'invalid-state' } satisfies Partial<InquiryModerationServiceError>)

    const noted = await addClinicInquiryNote(clinicReq, {
      idempotencyKey: `${slugPrefix}-conversation-internal-note`,
      inquiryId: created.inquiry.id,
      text: 'Synthetic clinic-only note remains available during restriction.',
    })
    expect(noted.inquiry.lifecycle).toBe('open')
    expect(noted.inquiry.timeline).toContainEqual(
      expect.objectContaining({
        kind: 'internal-note',
        text: 'Synthetic clinic-only note remains available during restriction.',
      }),
    )
  })

  it('resolves no-action without changing inquiry activity or unread state', async () => {
    const created = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(doctorId),
      idempotencyKey: `${slugPrefix}-no-action-inquiry`,
      message: 'Synthetic inquiry for a no-action decision.',
      phoneNumber: '+493000000006',
    })
    createdInquiryIds.push(created.inquiry.id)
    const sent = await sendClinicInquiryMessage(clinicReq, {
      expectedRevision: created.inquiry.revision,
      idempotencyKey: `${slugPrefix}-no-action-message`,
      inquiryId: created.inquiry.id,
      text: 'Synthetic message that does not require action.',
    })
    const message = sent.inquiry.timeline.find(
      (item) => item.kind === 'external-message' && item.actor.kind === 'clinic',
    )
    if (!message) throw new Error('Expected no-action target message')
    const report = await createInquiryModerationReport(patientReq, {
      category: 'other',
      description: 'Synthetic report resolved without action.',
      idempotencyKey: `${slugPrefix}-no-action-report`,
      inquiryId: created.inquiry.id,
      targetId: message.id,
      targetType: 'message',
    })
    const before = await payload.findByID({
      collection: 'patientClinicInquiries',
      depth: 0,
      id: created.inquiry.id,
      overrideAccess: true,
    })
    const patientBefore = await readPatientInquiryDetail(patientReq, { inquiryId: created.inquiry.id })

    await decideInquiryModerationCase(moderatorReq, {
      caseId: report.reportId,
      category: 'other',
      outcome: 'no-action',
      reason: 'Synthetic review found no policy violation.',
    })

    const after = await payload.findByID({
      collection: 'patientClinicInquiries',
      depth: 0,
      id: created.inquiry.id,
      overrideAccess: true,
    })
    const patientAfter = await readPatientInquiryDetail(patientReq, { inquiryId: created.inquiry.id })
    expect(after).toMatchObject({
      activitySequence: before.activitySequence,
      lastActivityAt: before.lastActivityAt,
      lastExternalActivityAt: before.lastExternalActivityAt,
      revision: before.revision,
    })
    expect(patientAfter.unread).toEqual(patientBefore.unread)
    expect(patientAfter.timeline).toEqual(patientBefore.timeline)
    const noActionCase = await payload.findByID({
      collection: 'inquiryModerationCases',
      depth: 0,
      id: report.reportId,
      overrideAccess: true,
    })
    expect(noActionCase).toMatchObject({
      decisionOutcome: 'no-action',
      finalOutcomeAt: expect.any(String),
      measureEndedAt: expect.any(String),
      status: 'resolved',
    })
    expect(noActionCase.retentionReviewDueAt).toBe(
      moderationReviewDueAt({
        finalOutcomeAt: String(noActionCase.finalOutcomeAt),
        measureEndedAt: String(noActionCase.measureEndedAt),
        reviewMonths: 24,
      }),
    )
    const afterDue = new Date(Date.parse(String(noActionCase.retentionReviewDueAt)) + 1_000).toISOString()
    const dueQueue = await readInquiryRetentionReviewQueue(moderatorReq, { limit: 100, now: afterDue })
    expect(dueQueue.items).toContainEqual(
      expect.objectContaining({
        id: String(report.reportId),
        reviewDueAt: noActionCase.retentionReviewDueAt,
        targetType: 'moderation-case',
      }),
    )
    const hold = await placeInquiryLegalHold(moderatorReq, {
      reasonCategory: 'regulatory-review',
      responsibleFunction: 'data-protection',
      reviewAt: new Date(Date.parse(afterDue) + 24 * 60 * 60 * 1_000).toISOString(),
      targetId: report.reportId,
      targetType: 'moderation-case',
    })
    const heldQueue = await readInquiryRetentionReviewQueue(moderatorReq, { limit: 100, now: afterDue })
    expect(heldQueue.items).not.toContainEqual(
      expect.objectContaining({ id: String(report.reportId), targetType: 'moderation-case' }),
    )
    await releaseInquiryLegalHold(moderatorReq, { holdId: hold.holdId })
    const releasedQueue = await readInquiryRetentionReviewQueue(moderatorReq, { limit: 100, now: afterDue })
    expect(releasedQueue.items).toContainEqual(
      expect.objectContaining({
        id: String(report.reportId),
        reviewDueAt: noActionCase.retentionReviewDueAt,
        targetType: 'moderation-case',
      }),
    )
  })

  it('keeps an upheld appeal restricted and terminal', async () => {
    const created = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(doctorId),
      idempotencyKey: `${slugPrefix}-upheld-inquiry`,
      message: 'Synthetic inquiry for an upheld appeal.',
      phoneNumber: '+493000000007',
    })
    createdInquiryIds.push(created.inquiry.id)
    const sent = await sendClinicInquiryMessage(clinicReq, {
      expectedRevision: created.inquiry.revision,
      idempotencyKey: `${slugPrefix}-upheld-message`,
      inquiryId: created.inquiry.id,
      text: 'Synthetic message whose restriction remains upheld.',
    })
    const message = sent.inquiry.timeline.find(
      (item) => item.kind === 'external-message' && item.actor.kind === 'clinic',
    )
    if (!message) throw new Error('Expected upheld target message')
    const report = await createInquiryModerationReport(patientReq, {
      category: 'harassment-threats',
      idempotencyKey: `${slugPrefix}-upheld-report`,
      inquiryId: created.inquiry.id,
      targetId: message.id,
      targetType: 'message',
    })
    const effectiveUntil = new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString()
    await decideInquiryModerationCase(moderatorReq, {
      caseId: report.reportId,
      category: 'harassment-threats',
      effectiveUntil,
      outcome: 'content-restricted',
      reason: 'Synthetic restriction before appeal.',
    })
    await submitInquiryModerationAppeal(clinicReq, {
      caseId: report.reportId,
      text: 'Synthetic appeal that will be upheld.',
    })
    await decideInquiryModerationAppeal(moderatorReq, {
      caseId: report.reportId,
      outcome: 'upheld',
      reason: 'Synthetic appeal review upheld the restriction.',
    })

    const detail = await readPatientInquiryDetail(patientReq, { inquiryId: created.inquiry.id })
    expect(detail.timeline).toContainEqual(
      expect.objectContaining({ contentState: 'restricted', id: message.id, kind: 'external-message' }),
    )
    const upheldCase = await payload.findByID({
      collection: 'inquiryModerationCases',
      depth: 0,
      id: report.reportId,
      overrideAccess: true,
    })
    expect(upheldCase).toMatchObject({
      appealOutcome: 'upheld',
      finalOutcomeAt: expect.any(String),
      measureEndedAt: null,
      status: 'resolved',
    })
    expect(upheldCase.retentionReviewDueAt).toBe(
      moderationReviewDueAt({
        finalOutcomeAt: String(upheldCase.finalOutcomeAt),
        measureEndedAt: effectiveUntil,
        reviewMonths: 24,
      }),
    )
    await expect(
      reconcileExpiredInquiryModerationMeasures(moderatorReq, {
        inquiryId: created.inquiry.id,
        now: new Date(Date.parse(effectiveUntil) + 1_000),
      }),
    ).resolves.toEqual({ reconciled: 1 })
    const restored = await readPatientInquiryDetail(patientReq, { inquiryId: created.inquiry.id })
    expect(restored.timeline).toContainEqual(
      expect.objectContaining({ event: 'moderation-restored', kind: 'system-event' }),
    )
    const endedCase = await payload.findByID({
      collection: 'inquiryModerationCases',
      depth: 0,
      id: report.reportId,
      overrideAccess: true,
    })
    expect(endedCase).toMatchObject({
      finalOutcomeAt: upheldCase.finalOutcomeAt,
      measureEndedAt: effectiveUntil,
      retentionReviewDueAt: upheldCase.retentionReviewDueAt,
    })
  })

  it('rate-limits persistent report bursts per participant', async () => {
    const ratePatient = await createPatientTestUser(payload, {
      createdPatientIds,
      emailPrefix: `${slugPrefix}-rate-patient`,
      firstName: 'Rate',
      lastName: 'Patient',
    })
    const ratePatientReq = await createLocalReq({}, payload)
    ratePatientReq.user = asPayloadPatientUser(ratePatient)
    let current = (
      await createVerifiedPatientInquiry(ratePatientReq, {
        clinicId: String(clinicId),
        consent: true,
        doctorId: String(doctorId),
        idempotencyKey: `${slugPrefix}-rate-inquiry`,
        message: 'Synthetic inquiry for report rate limiting.',
        phoneNumber: '+493000000008',
      })
    ).inquiry
    createdInquiryIds.push(current.id)

    for (let index = 0; index <= 10; index += 1) {
      current = (
        await sendClinicInquiryMessage(clinicReq, {
          expectedRevision: current.revision,
          idempotencyKey: `${slugPrefix}-rate-message-${index}`,
          inquiryId: current.id,
          text: `Synthetic distinct report target ${index}.`,
        })
      ).inquiry
      const target = current.timeline.find(
        (item) => item.kind === 'external-message' && item.text === `Synthetic distinct report target ${index}.`,
      )
      if (!target) throw new Error('Expected report rate target')
      const reportInput = {
        category: 'privacy-concern' as const,
        idempotencyKey: `${slugPrefix}-rate-report-${index}`,
        inquiryId: current.id,
        targetId: target.id,
        targetType: 'message' as const,
      }
      if (index < 10) {
        await expect(createInquiryModerationReport(ratePatientReq, reportInput)).resolves.toMatchObject({
          received: true,
        })
      } else {
        await expect(createInquiryModerationReport(ratePatientReq, reportInput)).rejects.toMatchObject({
          kind: 'rate-limited',
        } satisfies Partial<InquiryModerationServiceError>)
      }
    }
  })

  it('ends a timed restriction once, restores the composer, and appends neutral activity without unread', async () => {
    const effectiveUntil = new Date(Date.now() + 24 * 60 * 60 * 1_000)
    const reconciledAt = new Date(effectiveUntil.getTime() + 24 * 60 * 60 * 1_000)
    const created = await createVerifiedPatientInquiry(foreignPatientReq, {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(doctorId),
      idempotencyKey: `${slugPrefix}-timed-inquiry`,
      message: 'Synthetic inquiry before a timed restriction.',
      phoneNumber: '+493000000005',
    })
    createdInquiryIds.push(created.inquiry.id)
    const conversation = (
      await payload.find({
        collection: 'inquiryConversations',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: { inquiry: { equals: created.inquiry.id } },
      })
    ).docs[0]
    if (!conversation) throw new Error('Expected timed inquiry conversation')
    const heldMessageResult = await sendClinicInquiryMessage(clinicReq, {
      expectedRevision: created.inquiry.revision,
      idempotencyKey: `${slugPrefix}-timed-held-message`,
      inquiryId: created.inquiry.id,
      text: 'Synthetic message protected by a conversation-case hold.',
    })
    const heldMessage = heldMessageResult.inquiry.timeline.find(
      (item) =>
        item.kind === 'external-message' && item.text === 'Synthetic message protected by a conversation-case hold.',
    )
    if (!heldMessage) throw new Error('Expected held conversation message')
    const report = await createInquiryModerationReport(foreignPatientReq, {
      category: 'privacy-concern',
      idempotencyKey: `${slugPrefix}-timed-report`,
      inquiryId: created.inquiry.id,
      targetId: String(conversation.id),
      targetType: 'conversation',
    })
    const conversationHold = await placeInquiryLegalHold(moderatorReq, {
      reasonCategory: 'regulatory-review',
      responsibleFunction: 'data-protection',
      reviewAt: '2027-08-24T00:00:00.000Z',
      targetId: report.reportId,
      targetType: 'moderation-case',
    })
    await expect(
      hardDeleteInquiryContent(moderatorReq, {
        inquiryId: created.inquiry.id,
        reasonCategory: 'authorized-erasure',
        targetId: heldMessage.id.replace(/^message:/u, ''),
        targetType: 'message',
      }),
    ).rejects.toMatchObject({ kind: 'invalid-state' })
    await releaseInquiryLegalHold(moderatorReq, { holdId: conversationHold.holdId })
    await decideInquiryModerationCase(moderatorReq, {
      affectedActor: { id: String(foreignPatientReq.user?.id), kind: 'patient' },
      caseId: report.reportId,
      category: 'privacy-concern',
      effectiveUntil: effectiveUntil.toISOString(),
      outcome: 'conversation-restricted',
      reason: 'Synthetic timed restriction decision.',
    })

    const restricted = await readPatientInquiryDetail(foreignPatientReq, { inquiryId: created.inquiry.id })
    expect(restricted.actions.canReply).toBe(false)
    const unreadBeforeEnd = restricted.unread

    await expect(
      reconcileExpiredInquiryModerationMeasures(foreignPatientReq, {
        inquiryId: created.inquiry.id,
        now: reconciledAt,
      }),
    ).resolves.toEqual({ reconciled: 1 })
    await expect(
      reconcileExpiredInquiryModerationMeasures(foreignPatientReq, {
        inquiryId: created.inquiry.id,
        now: new Date(reconciledAt.getTime() + 1_000),
      }),
    ).resolves.toEqual({ reconciled: 0 })

    const restored = await readPatientInquiryDetail(foreignPatientReq, { inquiryId: created.inquiry.id })
    expect(restored.actions.canReply).toBe(true)
    expect(restored.unread).toEqual(unreadBeforeEnd)
    expect(restored.timeline).toContainEqual(
      expect.objectContaining({ event: 'moderation-restored', kind: 'system-event' }),
    )
    const moderationCase = await payload.findByID({
      collection: 'inquiryModerationCases',
      depth: 0,
      id: report.reportId,
      overrideAccess: true,
    })
    expect(moderationCase).toMatchObject({
      finalOutcomeAt: effectiveUntil.toISOString(),
      measureEndedAt: effectiveUntil.toISOString(),
      status: 'resolved',
    })
    expect(moderationCase.retentionReviewDueAt).toBe(
      moderationReviewDueAt({
        finalOutcomeAt: effectiveUntil.toISOString(),
        measureEndedAt: effectiveUntil.toISOString(),
        reviewMonths: 24,
      }),
    )
  })
})

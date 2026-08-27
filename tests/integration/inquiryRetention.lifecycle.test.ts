import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'

import config from '@payload-config'
import {
  anonymizeInquiryPackage,
  cutoverLegacyInquiryCommunication,
  hardDeleteInquiryContent,
  hardDeleteInquiryPackage,
  type InquiryRetentionServiceError,
  placeInquiryLegalHold,
  readInquiryRetentionReviewQueue,
  releaseInquiryLegalHold,
  resolveActiveInquiryRetentionPolicy,
} from '@/features/inquiryRetention/service'
import {
  addClinicInquiryNote,
  createAttachmentDraft,
  createVerifiedPatientInquiry,
  finalizeAttachmentDraft,
  readClinicInquiryDetail,
  readClinicInquiryQueue,
  readPatientInquiryDetail,
  sendClinicInquiryMessage,
  sendPatientInquiryMessage,
  updateClinicInquiryState,
} from '@/features/inquiryCommunication/service'
import { createInquiryModerationReport, decideInquiryModerationCase } from '@/features/inquiryModeration/service'
import { communicationReviewDueAt } from '@/features/inquiryRetention/policy'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import {
  asPayloadPatientUser,
  asClinicScopedPayloadUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPatientTestUser,
} from '../fixtures/testUsers'

describe('inquiry retention lifecycle', () => {
  let payload: Payload
  let operatorReq: PayloadRequest
  let operatorId: number | string
  let clinicId: number
  let inquiryId: number | string
  let doctorId: number | string
  const createdPatientIds: Array<number | string> = []
  const createdStaffIds: Array<number | string> = []
  const createdInquiryIds: Array<number | string> = []
  const slugPrefix = testSlug('inquiryRetention.lifecycle.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const city = (await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })).docs[0]
    if (!city) throw new Error('Expected a baseline city for retention tests.')
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

    const operator = await payload.create({
      collection: 'platformStaff',
      context: { trustedPlatformStaffOps: true },
      data: {
        capabilities: ['conversation-moderation', 'inquiry-retention'],
        email: `${slugPrefix}-operator@findmydoc.eu`,
        firstName: 'Retention',
        lastName: 'Operator',
        role: 'support',
        supabaseUserId: `${slugPrefix}-operator`,
      },
      depth: 0,
      overrideAccess: true,
    })
    operatorId = operator.id
    operatorReq = await createLocalReq({}, payload)
    operatorReq.user = { ...operator, collection: 'platformStaff' }

    const legacy = await payload.create({
      collection: 'patientClinicInquiries',
      context: { inquiryCommunicationCommand: true },
      data: {
        clinic: clinicId,
        consent: { accepted: true, acceptedAt: '2024-01-15T12:00:00.000Z', text: 'Synthetic consent.' },
        createdAt: '2024-01-15T12:00:00.000Z',
        creationActorKey: `guest:${slugPrefix}`,
        creationRequestHash: slugPrefix,
        email: `${slugPrefix}-legacy@example.com`,
        fullName: 'Synthetic Legacy Patient',
        message: 'Synthetic legacy inquiry.',
        phoneNumber: '+493000000099',
        status: 'closed',
      },
      depth: 0,
      overrideAccess: true,
    })
    inquiryId = legacy.id
    createdInquiryIds.push(legacy.id)
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
    ] as const) {
      await payload.delete({
        collection: collection as never,
        overrideAccess: true,
        where:
          collection === 'inquiryLegalHolds'
            ? { targetId: { in: createdInquiryIds.map(String) } }
            : collection === 'inquiryDeletionProofs'
              ? { inquiryId: { in: createdInquiryIds.map(String) } }
              : { inquiry: { in: createdInquiryIds } },
      } as never)
    }
    for (const id of createdInquiryIds) {
      await payload.delete({ collection: 'patientClinicInquiries', id, overrideAccess: true, trash: true })
    }
    await payload.delete({ collection: 'platformStaff', id: operatorId, overrideAccess: true })
    await cleanupTrackedUsers(payload, { patientIds: createdPatientIds, staffIds: createdStaffIds })
    await payload.delete({
      collection: 'doctors',
      overrideAccess: true,
      trash: true,
      where: { clinic: { equals: clinicId } },
    })
    await payload.delete({ collection: 'clinics', id: clinicId, overrideAccess: true, trash: true })
  })

  it('cuts over legacy closed inquiries once without conversation backfill or activity churn', async () => {
    await expect(cutoverLegacyInquiryCommunication(operatorReq, { limit: 50 })).resolves.toEqual({ migrated: 1 })
    await expect(cutoverLegacyInquiryCommunication(operatorReq, { limit: 50 })).resolves.toEqual({ migrated: 0 })

    const inquiry = await payload.findByID({
      collection: 'patientClinicInquiries',
      depth: 0,
      id: inquiryId,
      overrideAccess: true,
    })
    expect(inquiry).toMatchObject({
      activitySequence: 0,
      externalSequence: 0,
      handlingStatus: 'submitted',
      lastActivityAt: '2024-01-15T12:00:00.000Z',
      lifecycle: 'closed',
      retentionPolicyVersion: '2026-08-24',
      retentionReviewBasisAt: '2024-01-15T12:00:00.000Z',
      retentionState: 'available',
      revision: 0,
      status: 'closed',
    })

    const [conversations, events] = await Promise.all([
      payload.find({
        collection: 'inquiryConversations',
        depth: 0,
        overrideAccess: true,
        where: { inquiry: { equals: inquiryId } },
      }),
      payload.find({
        collection: 'inquiryAuditEvents',
        depth: 0,
        overrideAccess: true,
        where: { and: [{ inquiry: { equals: inquiryId } }, { eventType: { equals: 'legacy-closed-migrated' } }] },
      }),
    ])
    expect(conversations.docs).toHaveLength(0)
    expect(events.docs).toHaveLength(1)
    expect(events.docs[0]).toMatchObject({
      affectsActivity: false,
      actorId: 'system',
      actorKind: 'system',
      sequence: 0,
    })
  })

  it('keeps the original review deadline while a scoped hold suppresses and then releases review due', async () => {
    const dueAt = '2025-01-15T12:00:00.000Z'
    const laterDueAt = '2025-01-16T12:00:00.000Z'
    const laterInquiry = await payload.create({
      collection: 'patientClinicInquiries',
      context: { inquiryCommunicationCommand: true },
      data: {
        clinic: clinicId,
        consent: { accepted: true, acceptedAt: '2024-01-16T12:00:00.000Z', text: 'Synthetic consent.' },
        createdAt: '2024-01-16T12:00:00.000Z',
        creationActorKey: `guest:${slugPrefix}:later`,
        creationRequestHash: `${slugPrefix}:later`,
        email: `${slugPrefix}-later-legacy@example.com`,
        fullName: 'Synthetic Later Legacy Patient',
        message: 'Synthetic later legacy inquiry.',
        phoneNumber: '+493000000098',
        status: 'submitted',
      },
      depth: 0,
      overrideAccess: true,
    })
    createdInquiryIds.push(laterInquiry.id)
    await cutoverLegacyInquiryCommunication(operatorReq, { limit: 50 })
    await payload.update({
      collection: 'patientClinicInquiries',
      context: { inquiryRetentionCommand: true },
      data: { retentionReviewDueAt: dueAt },
      depth: 0,
      id: inquiryId,
      overrideAccess: true,
    } as never)
    await payload.update({
      collection: 'patientClinicInquiries',
      context: { inquiryRetentionCommand: true },
      data: { retentionReviewDueAt: laterDueAt },
      depth: 0,
      id: laterInquiry.id,
      overrideAccess: true,
    } as never)

    const placed = await placeInquiryLegalHold(operatorReq, {
      reasonCategory: 'regulatory-review',
      responsibleFunction: 'data-protection',
      reviewAt: '2027-01-01T00:00:00.000Z',
      targetId: String(inquiryId),
      targetType: 'inquiry',
    })
    const held = await readInquiryRetentionReviewQueue(operatorReq, {
      limit: 1,
      now: '2026-08-24T12:00:00.000Z',
    })
    expect(held.items).not.toContainEqual(expect.objectContaining({ id: String(inquiryId) }))
    expect(held.items).toContainEqual(expect.objectContaining({ id: String(laterInquiry.id), reviewDueAt: laterDueAt }))

    await releaseInquiryLegalHold(operatorReq, { holdId: placed.holdId })
    const released = await readInquiryRetentionReviewQueue(operatorReq, {
      limit: 1,
      now: '2026-08-24T12:00:00.000Z',
    })
    expect(released.items).toContainEqual({
      id: String(inquiryId),
      policyVersion: '2026-08-24',
      reviewDueAt: dueAt,
      targetType: 'inquiry',
    })
    expect(released.nextCursor).toEqual(expect.any(String))
    const nextPage = await readInquiryRetentionReviewQueue(operatorReq, {
      cursor: released.nextCursor,
      limit: 1,
      now: '2026-08-24T12:00:00.000Z',
    })
    expect(nextPage.items).toContainEqual(
      expect.objectContaining({ id: String(laterInquiry.id), reviewDueAt: laterDueAt }),
    )
    expect(nextPage.items).not.toContainEqual(expect.objectContaining({ id: String(inquiryId) }))
    await expect(
      readInquiryRetentionReviewQueue(operatorReq, {
        cursor: Buffer.from('not-json', 'utf8').toString('base64url'),
        limit: 1,
        now: '2026-08-24T12:00:00.000Z',
      }),
    ).rejects.toMatchObject({ kind: 'invalid-input' })

    const parallelOperatorReq = await createLocalReq({}, payload)
    parallelOperatorReq.user = operatorReq.user
    const parallelHolds = await Promise.allSettled([
      placeInquiryLegalHold(operatorReq, {
        reasonCategory: 'litigation',
        responsibleFunction: 'legal',
        reviewAt: '2027-02-01T00:00:00.000Z',
        targetId: String(inquiryId),
        targetType: 'inquiry',
      }),
      placeInquiryLegalHold(parallelOperatorReq, {
        reasonCategory: 'litigation',
        responsibleFunction: 'legal',
        reviewAt: '2027-02-01T00:00:00.000Z',
        targetId: String(inquiryId),
        targetType: 'inquiry',
      }),
    ])
    expect(parallelHolds.filter(({ status }) => status === 'fulfilled')).toHaveLength(1)
    expect(parallelHolds.filter(({ status }) => status === 'rejected')).toHaveLength(1)
    const holdLocks = await payload.find({
      collection: 'inquiryCommandLocks',
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    expect(holdLocks.totalDocs).toBe(0)
    const activeHolds = await payload.find({
      collection: 'inquiryLegalHolds',
      depth: 0,
      overrideAccess: true,
      where: {
        and: [{ targetId: { equals: String(inquiryId) } }, { status: { equals: 'active' } }],
      },
    })
    expect(activeHolds.docs).toHaveLength(1)
    await releaseInquiryLegalHold(operatorReq, { holdId: String(activeHolds.docs[0]?.id) })
    const replacement = await placeInquiryLegalHold(operatorReq, {
      reasonCategory: 'regulatory-review',
      responsibleFunction: 'data-protection',
      reviewAt: '2027-03-01T00:00:00.000Z',
      targetId: String(inquiryId),
      targetType: 'inquiry',
    })
    await releaseInquiryLegalHold(operatorReq, { holdId: replacement.holdId })
  })

  it('selects the newest effective active policy version deterministically', async () => {
    const policy = await payload.create({
      collection: 'inquiryRetentionPolicies',
      context: { inquiryRetentionCommand: true },
      data: {
        communicationReviewMonths: 10,
        effectiveFrom: '2026-08-25T00:00:00.000Z',
        moderationReviewMonths: 20,
        policyKey: 'inquiry-communication',
        status: 'active',
        version: `${slugPrefix}-new-policy`,
      },
      depth: 0,
      overrideAccess: true,
    })
    await expect(
      resolveActiveInquiryRetentionPolicy(operatorReq, new Date('2026-08-26T00:00:00.000Z')),
    ).resolves.toEqual({
      communicationReviewMonths: 10,
      moderationReviewMonths: 20,
      version: `${slugPrefix}-new-policy`,
    })
    await payload.delete({
      collection: 'inquiryRetentionPolicies',
      id: policy.id,
      overrideAccess: true,
    })
  })

  it('rolls back a closed cutover when its required audit event cannot be written and repairs on retry', async () => {
    const repairInquiry = await payload.create({
      collection: 'patientClinicInquiries',
      context: { inquiryCommunicationCommand: true },
      data: {
        clinic: clinicId,
        consent: { accepted: true, acceptedAt: '2024-01-17T12:00:00.000Z', text: 'Synthetic consent.' },
        createdAt: '2024-01-17T12:00:00.000Z',
        creationActorKey: `guest:${slugPrefix}:repair`,
        creationRequestHash: `${slugPrefix}:repair`,
        email: `${slugPrefix}-repair-legacy@example.com`,
        fullName: 'Synthetic Repair Legacy Patient',
        message: 'Synthetic repair legacy inquiry.',
        phoneNumber: '+493000000097',
        status: 'closed',
      },
      depth: 0,
      overrideAccess: true,
    })
    createdInquiryIds.push(repairInquiry.id)

    const originalCreate = payload.create.bind(payload)
    let failAuditOnce = true
    const createSpy = vi.spyOn(payload, 'create').mockImplementation(async (args) => {
      if (failAuditOnce && args.collection === 'inquiryAuditEvents') {
        failAuditOnce = false
        throw new Error('Synthetic cutover audit failure.')
      }
      return originalCreate(args as never)
    })
    await expect(cutoverLegacyInquiryCommunication(operatorReq, { limit: 50 })).rejects.toThrow(
      'Synthetic cutover audit failure.',
    )
    createSpy.mockRestore()

    const rolledBack = await payload.findByID({
      collection: 'patientClinicInquiries',
      depth: 0,
      id: repairInquiry.id,
      overrideAccess: true,
    })
    expect(rolledBack.handlingStatus).toBeNull()

    await expect(cutoverLegacyInquiryCommunication(operatorReq, { limit: 50 })).resolves.toMatchObject({
      migrated: expect.any(Number),
    })
    const events = await payload.find({
      collection: 'inquiryAuditEvents',
      depth: 0,
      overrideAccess: true,
      where: {
        and: [{ inquiry: { equals: repairInquiry.id } }, { eventType: { equals: 'legacy-closed-migrated' } }],
      },
    })
    expect(events.docs).toHaveLength(1)
  })

  it('hard deletes one message without retaining content and keeps it deleted after a stale restore', async () => {
    const availableStaff = await createClinicTestUser(payload, {
      createdStaffIds,
      emailPrefix: `${slugPrefix}-hard-delete-staff`,
      firstName: 'Synthetic',
      lastName: 'Clinician',
    })
    const clinicActor = await asClinicScopedPayloadUser(payload, availableStaff, clinicId)
    const clinicReq = await createLocalReq({}, payload)
    clinicReq.user = clinicActor
    const patient = await createPatientTestUser(payload, {
      createdPatientIds,
      emailPrefix: `${slugPrefix}-hard-delete-patient`,
      firstName: 'Synthetic',
      lastName: 'Patient',
    })
    const patientReq = await createLocalReq({}, payload)
    patientReq.user = asPayloadPatientUser(patient)
    const created = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(doctorId),
      idempotencyKey: `${slugPrefix}-hard-delete-create`,
      message: 'Synthetic inquiry for a hard-delete test.',
      phoneNumber: '+493000000066',
    })
    createdInquiryIds.push(created.inquiry.id)
    const afterCreation = await payload.findByID({
      collection: 'patientClinicInquiries',
      depth: 0,
      id: created.inquiry.id,
      overrideAccess: true,
    })
    expect(afterCreation).toMatchObject({
      retentionPolicyVersion: '2026-08-24',
      retentionReviewBasisAt: expect.any(String),
      retentionReviewDueAt: expect.any(String),
    })
    expect(afterCreation.retentionReviewDueAt).toBe(
      communicationReviewDueAt(String(afterCreation.retentionReviewBasisAt), 12),
    )
    const sent = await sendPatientInquiryMessage(patientReq, {
      expectedRevision: created.inquiry.revision,
      idempotencyKey: `${slugPrefix}-hard-delete-message`,
      inquiryId: created.inquiry.id,
      text: 'Synthetic message content that must not survive deletion.',
    })
    const afterExternalMessage = await payload.findByID({
      collection: 'patientClinicInquiries',
      depth: 0,
      id: created.inquiry.id,
      overrideAccess: true,
    })
    expect(afterExternalMessage.retentionReviewBasisAt).toBe(afterExternalMessage.lastExternalActivityAt)
    expect(afterExternalMessage.retentionReviewDueAt).toBe(
      communicationReviewDueAt(String(afterExternalMessage.lastExternalActivityAt), 12),
    )
    const message = sent.inquiry.timeline.find(
      (item) =>
        item.kind === 'external-message' && item.text === 'Synthetic message content that must not survive deletion.',
    )
    if (!message) throw new Error('Expected the synthetic message selected for hard deletion.')
    const queueBeforeDelete = await readClinicInquiryQueue(clinicReq, {
      lifecycle: 'all',
      limit: 50,
      unreadOnly: false,
    })
    expect(queueBeforeDelete.items).toContainEqual(
      expect.objectContaining({
        id: String(created.inquiry.id),
        preview: 'Synthetic message content that must not survive deletion.',
      }),
    )

    const hold = await placeInquiryLegalHold(operatorReq, {
      reasonCategory: 'legal-request',
      responsibleFunction: 'legal',
      reviewAt: '2027-01-01T00:00:00.000Z',
      targetId: String(created.inquiry.id),
      targetType: 'inquiry',
    })
    await expect(
      hardDeleteInquiryContent(operatorReq, {
        inquiryId: created.inquiry.id,
        reasonCategory: 'authorized-erasure',
        targetId: message.id.replace(/^message:/u, ''),
        targetType: 'message',
      }),
    ).rejects.toMatchObject({ kind: 'invalid-state' } satisfies Partial<InquiryRetentionServiceError>)
    await releaseInquiryLegalHold(operatorReq, { holdId: hold.holdId })

    await expect(
      hardDeleteInquiryContent(operatorReq, {
        inquiryId: created.inquiry.id,
        reasonCategory: 'authorized-erasure',
        targetId: message.id.replace(/^message:/u, ''),
        targetType: 'message',
      }),
    ).resolves.toEqual({ deleted: true, replayed: false })
    const afterHardDelete = await payload.findByID({
      collection: 'patientClinicInquiries',
      depth: 0,
      id: created.inquiry.id,
      overrideAccess: true,
    })
    expect(afterHardDelete).toMatchObject({
      retentionReviewBasisAt: afterExternalMessage.retentionReviewBasisAt,
      retentionReviewDueAt: afterExternalMessage.retentionReviewDueAt,
    })
    const queueAfterDelete = await readClinicInquiryQueue(clinicReq, {
      knownChangeCursor: queueBeforeDelete.changeCursor,
      lifecycle: 'all',
      limit: 50,
      unreadOnly: false,
    })
    expect(queueAfterDelete).toMatchObject({ unchanged: false })
    expect(queueAfterDelete.items).toContainEqual(
      expect.objectContaining({ id: String(created.inquiry.id), preview: 'Message deleted' }),
    )
    await expect(
      hardDeleteInquiryContent(operatorReq, {
        inquiryId: created.inquiry.id,
        reasonCategory: 'authorized-erasure',
        targetId: message.id.replace(/^message:/u, ''),
        targetType: 'message',
      }),
    ).resolves.toEqual({ deleted: true, replayed: true })

    await addClinicInquiryNote(clinicReq, {
      idempotencyKey: `${slugPrefix}-retention-note`,
      inquiryId: created.inquiry.id,
      text: 'Synthetic internal note that must not move the retention deadline.',
    })
    await updateClinicInquiryState(clinicReq, {
      action: 'close',
      expectedRevision: sent.inquiry.revision,
      inquiryId: created.inquiry.id,
      reason: 'Synthetic retention close.',
    })
    await updateClinicInquiryState(clinicReq, {
      action: 'reopen',
      expectedRevision: sent.inquiry.revision + 1,
      inquiryId: created.inquiry.id,
    })
    const afterInternalActivity = await payload.findByID({
      collection: 'patientClinicInquiries',
      depth: 0,
      id: created.inquiry.id,
      overrideAccess: true,
    })
    expect(afterInternalActivity).toMatchObject({
      retentionReviewBasisAt: afterExternalMessage.retentionReviewBasisAt,
      retentionReviewDueAt: afterExternalMessage.retentionReviewDueAt,
    })

    const rawMessage = await payload.findByID({
      collection: 'inquiryMessages',
      depth: 0,
      id: message.id.replace(/^message:/u, ''),
      overrideAccess: true,
    })
    expect(rawMessage).toMatchObject({ contentState: 'hard-deleted', text: null })

    const deleted = await readPatientInquiryDetail(patientReq, { inquiryId: created.inquiry.id })
    expect(deleted.timeline).toContainEqual(
      expect.objectContaining({ contentState: 'hard-deleted', createdAt: message.createdAt, id: message.id }),
    )
    expect(JSON.stringify(deleted)).not.toContain('Synthetic message content that must not survive deletion.')

    const proofs = await payload.find({
      collection: 'inquiryDeletionProofs',
      depth: 0,
      overrideAccess: true,
      where: {
        and: [{ inquiryId: { equals: String(created.inquiry.id) } }, { operation: { equals: 'hard-deleted' } }],
      },
    })
    expect(proofs.docs).toHaveLength(1)
    expect(proofs.docs[0]).toMatchObject({
      deletedObjectCount: 1,
      operation: 'hard-deleted',
      tombstoneKey: expect.stringMatching(/^[a-f0-9]{64}$/u),
    })
    expect(JSON.stringify(proofs.docs[0])).not.toContain('Synthetic message content that must not survive deletion.')

    const parallelMessageResult = await sendPatientInquiryMessage(patientReq, {
      expectedRevision: Number(afterInternalActivity.revision),
      idempotencyKey: `${slugPrefix}-parallel-hard-delete-message`,
      inquiryId: created.inquiry.id,
      text: 'Synthetic content for parallel deletion replay.',
    })
    const parallelMessage = parallelMessageResult.inquiry.timeline.find(
      (item) => item.kind === 'external-message' && item.text === 'Synthetic content for parallel deletion replay.',
    )
    if (!parallelMessage) throw new Error('Expected the synthetic parallel deletion target.')
    const secondOperatorReq = await createLocalReq({}, payload)
    secondOperatorReq.user = operatorReq.user
    const parallelInput = {
      inquiryId: created.inquiry.id,
      reasonCategory: 'authorized-erasure' as const,
      targetId: parallelMessage.id.replace(/^message:/u, ''),
      targetType: 'message' as const,
    }
    const parallelResults = await Promise.all([
      hardDeleteInquiryContent(operatorReq, parallelInput),
      hardDeleteInquiryContent(secondOperatorReq, parallelInput),
    ])
    expect(parallelResults).toContainEqual({ deleted: true, replayed: false })
    expect(parallelResults).toContainEqual({ deleted: true, replayed: true })
    const deletionLocks = await payload.find({
      collection: 'inquiryCommandLocks',
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    expect(deletionLocks.totalDocs).toBe(0)

    await (
      payload.db as unknown as {
        pool: { query: (query: string, values: unknown[]) => Promise<unknown> }
      }
    ).pool.query('UPDATE inquiry_messages SET content_state = $1, text = $2 WHERE id = $3', [
      'available',
      'Synthetic message content that must not survive deletion.',
      Number(message.id.replace(/^message:/u, '')),
    ])
    const afterRestore = await readPatientInquiryDetail(patientReq, { inquiryId: created.inquiry.id })
    expect(afterRestore.timeline).toContainEqual(
      expect.objectContaining({ contentState: 'hard-deleted', createdAt: message.createdAt, id: message.id }),
    )
    expect(JSON.stringify(afterRestore)).not.toContain('Synthetic message content that must not survive deletion.')
    await payload.update({
      collection: 'clinicStaff',
      data: { status: 'offboarded' },
      depth: 0,
      id: availableStaff.id,
      overrideAccess: true,
    })
  })

  it('anonymizes direct patient identity while preserving allowed communication history', async () => {
    const staff = await createClinicTestUser(payload, {
      createdStaffIds,
      emailPrefix: `${slugPrefix}-anonymize-staff`,
      firstName: 'Synthetic',
      lastName: 'Clinician',
    })
    const clinicReq = await createLocalReq({}, payload)
    clinicReq.user = await asClinicScopedPayloadUser(payload, staff, clinicId)
    const patient = await createPatientTestUser(payload, {
      createdPatientIds,
      emailPrefix: `${slugPrefix}-anonymize-patient`,
      firstName: 'Synthetic',
      lastName: 'Identity',
    })
    const patientReq = await createLocalReq({}, payload)
    patientReq.user = asPayloadPatientUser(patient)
    const created = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(doctorId),
      idempotencyKey: `${slugPrefix}-anonymize-create`,
      message: 'Synthetic original request retained after identity deletion.',
      phoneNumber: '+493000000088',
    })
    createdInquiryIds.push(created.inquiry.id)
    const patientMessage = await sendPatientInquiryMessage(patientReq, {
      expectedRevision: created.inquiry.revision,
      idempotencyKey: `${slugPrefix}-anonymize-message`,
      inquiryId: created.inquiry.id,
      text: 'Synthetic retained conversation content.',
    })
    const clinicMessage = await sendClinicInquiryMessage(clinicReq, {
      expectedRevision: patientMessage.inquiry.revision,
      idempotencyKey: `${slugPrefix}-anonymize-clinic-message`,
      inquiryId: created.inquiry.id,
      text: 'Synthetic retained clinic content under moderation.',
    })
    const reportedMessage = clinicMessage.inquiry.timeline.find(
      (item) => item.kind === 'external-message' && item.actor.kind === 'clinic',
    )
    if (!reportedMessage) throw new Error('Expected a synthetic clinic message for the moderation case.')
    const report = await createInquiryModerationReport(patientReq, {
      category: 'privacy-concern',
      idempotencyKey: `${slugPrefix}-anonymize-report`,
      inquiryId: created.inquiry.id,
      targetId: reportedMessage.id,
      targetType: 'message',
    })
    await addClinicInquiryNote(clinicReq, {
      idempotencyKey: `${slugPrefix}-anonymize-note`,
      inquiryId: created.inquiry.id,
      text: 'Synthetic retained internal note.',
    })

    await expect(
      anonymizeInquiryPackage(operatorReq, {
        inquiryId: created.inquiry.id,
        reasonCategory: 'authorized-erasure',
      }),
    ).resolves.toEqual({ anonymized: true, replayed: false })

    await expect(
      decideInquiryModerationCase(operatorReq, {
        caseId: report.reportId,
        category: 'privacy-concern',
        outcome: 'no-action',
        reason: 'Synthetic final decision after identity anonymization.',
      }),
    ).resolves.toEqual({ decided: true })

    const root = await payload.findByID({
      collection: 'patientClinicInquiries',
      depth: 0,
      id: created.inquiry.id,
      overrideAccess: true,
    })
    expect(root).toMatchObject({
      creationActorKey: null,
      email: null,
      fullName: null,
      patient: null,
      phoneNumber: null,
      retentionState: 'anonymized',
    })
    const conversations = await payload.find({
      collection: 'inquiryConversations',
      depth: 0,
      overrideAccess: true,
      where: { inquiry: { equals: created.inquiry.id } },
    })
    expect(conversations.docs).toHaveLength(1)
    expect(conversations.docs[0]).toMatchObject({ actorKey: null, patient: null })
    const messages = await payload.find({
      collection: 'inquiryMessages',
      depth: 0,
      overrideAccess: true,
      where: { inquiry: { equals: created.inquiry.id } },
    })
    expect(messages.docs).toContainEqual(
      expect.objectContaining({ actorKey: null, authorPatient: null, patient: null }),
    )
    const moderationCase = await payload.findByID({
      collection: 'inquiryModerationCases',
      depth: 0,
      id: report.reportId,
      overrideAccess: true,
    })
    expect(moderationCase).toMatchObject({
      patient: null,
      reporterKey: null,
      reporterPatient: null,
      status: 'resolved',
    })

    await expect(readPatientInquiryDetail(patientReq, { inquiryId: created.inquiry.id })).rejects.toMatchObject({
      kind: 'not-found',
    })
    const clinicDetail = (await readClinicInquiryDetail(clinicReq, { inquiryId: created.inquiry.id })).inquiry
    expect(clinicDetail).toMatchObject({
      binding: { canReply: false, kind: 'deleted-patient' },
      contact: { mode: 'unavailable' },
      patientName: 'Deleted patient',
    })
    expect(JSON.stringify(clinicDetail)).toContain('Synthetic retained conversation content.')
    expect(JSON.stringify(clinicDetail)).toContain('Synthetic retained internal note.')
    expect(JSON.stringify(clinicDetail)).not.toContain(`${slugPrefix}-identity@example.com`)

    const previousClinicContext = { ...(clinicReq.context ?? {}) }
    clinicReq.context = {
      ...previousClinicContext,
      inquiryContractMutationPolicy: 'exclude-identity-deleted',
    }
    try {
      await expect(
        addClinicInquiryNote(clinicReq, {
          idempotencyKey: `${slugPrefix}-v1-anonymized-note`,
          inquiryId: created.inquiry.id,
          text: 'This v1 note must never be stored.',
        }),
      ).rejects.toMatchObject({ kind: 'not-found' })
      await expect(
        sendClinicInquiryMessage(clinicReq, {
          expectedRevision: clinicDetail.revision,
          idempotencyKey: `${slugPrefix}-v1-anonymized-message`,
          inquiryId: created.inquiry.id,
          text: 'This v1 message must never be stored.',
        }),
      ).rejects.toMatchObject({ kind: 'not-found' })
    } finally {
      clinicReq.context = previousClinicContext
    }
    const blockedV1Notes = await payload.find({
      collection: 'inquiryInternalNotes',
      depth: 0,
      overrideAccess: true,
      where: { idempotencyKey: { equals: `${slugPrefix}-v1-anonymized-note` } },
    })
    expect(blockedV1Notes.totalDocs).toBe(0)
    const blockedV1Messages = await payload.find({
      collection: 'inquiryMessages',
      depth: 0,
      overrideAccess: true,
      where: { idempotencyKey: { equals: `${slugPrefix}-v1-anonymized-message` } },
    })
    expect(blockedV1Messages.totalDocs).toBe(0)

    await (
      payload.db as unknown as { pool: { query: (query: string, values: unknown[]) => Promise<unknown> } }
    ).pool.query(
      `UPDATE patient_clinic_inquiries
       SET patient_id = $1, full_name = $2, email = $3, phone_number = $4,
           retention_state = 'available', deletion_tombstone_key = NULL
       WHERE id = $5`,
      [
        patient.id,
        'Restored Synthetic Identity',
        'restored-identity@example.com',
        '+493000000087',
        Number(created.inquiry.id),
      ],
    )
    await expect(readPatientInquiryDetail(patientReq, { inquiryId: created.inquiry.id })).rejects.toMatchObject({
      kind: 'not-found',
    })
    const afterRestore = (await readClinicInquiryDetail(clinicReq, { inquiryId: created.inquiry.id })).inquiry
    expect(afterRestore).toMatchObject({ patientName: 'Deleted patient', contact: { mode: 'unavailable' } })
    expect(JSON.stringify(afterRestore)).not.toContain('restored-identity@example.com')

    await expect(
      anonymizeInquiryPackage(operatorReq, {
        inquiryId: created.inquiry.id,
        reasonCategory: 'authorized-erasure',
      }),
    ).resolves.toEqual({ anonymized: true, replayed: true })
    const repairedRoot = await payload.findByID({
      collection: 'patientClinicInquiries',
      depth: 0,
      id: created.inquiry.id,
      overrideAccess: true,
    })
    expect(repairedRoot).toMatchObject({ email: null, patient: null, retentionState: 'anonymized' })
    await payload.update({
      collection: 'clinicStaff',
      data: { status: 'offboarded' },
      depth: 0,
      id: staff.id,
      overrideAccess: true,
    })
  })

  it('hard deletes the whole communication package without retaining content', async () => {
    const staff = await createClinicTestUser(payload, {
      createdStaffIds,
      emailPrefix: `${slugPrefix}-package-delete-staff`,
      firstName: 'Synthetic',
      lastName: 'Clinician',
    })
    const clinicReq = await createLocalReq({}, payload)
    clinicReq.user = await asClinicScopedPayloadUser(payload, staff, clinicId)
    const patient = await createPatientTestUser(payload, {
      createdPatientIds,
      emailPrefix: `${slugPrefix}-package-delete-patient`,
      firstName: 'Synthetic',
      lastName: 'Package',
    })
    const patientReq = await createLocalReq({}, payload)
    patientReq.user = asPayloadPatientUser(patient)
    const created = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(doctorId),
      idempotencyKey: `${slugPrefix}-package-create`,
      message: 'Synthetic original request that must be deleted.',
      phoneNumber: '+493000000089',
    })
    createdInquiryIds.push(created.inquiry.id)
    const patientMessage = await sendPatientInquiryMessage(patientReq, {
      expectedRevision: created.inquiry.revision,
      idempotencyKey: `${slugPrefix}-package-message`,
      inquiryId: created.inquiry.id,
      text: 'Synthetic message that must be deleted.',
    })
    const draftStorage = {
      createReadAccess: vi.fn(async () => ({
        expiresAt: '2026-08-25T10:00:00.000Z',
        method: 'GET' as const,
        url: 'https://storage.invalid/read',
      })),
      createUpload: vi.fn(async () => ({ headers: {}, method: 'PUT' as const, url: 'https://storage.invalid/upload' })),
      deleteObjects: vi.fn(async () => undefined),
      sealDraft: vi.fn(async ({ readyObjectKey }: { readyObjectKey: string }) => ({
        mimeType: 'application/pdf' as const,
        readyObjectKey,
        sizeBytes: 12,
      })),
      verifySealed: vi.fn(async () => undefined),
    }
    const attachmentDraft = await createAttachmentDraft(
      patientReq,
      {
        fileName: 'synthetic-package.pdf',
        inquiryId: created.inquiry.id,
        mimeType: 'application/pdf',
        sizeBytes: 12,
      },
      draftStorage,
    )
    await finalizeAttachmentDraft(
      patientReq,
      { draftId: attachmentDraft.draftId, inquiryId: created.inquiry.id },
      draftStorage,
    )
    await sendPatientInquiryMessage(
      patientReq,
      {
        attachmentDraftId: attachmentDraft.draftId,
        expectedRevision: patientMessage.inquiry.revision,
        idempotencyKey: `${slugPrefix}-package-attachment-message`,
        inquiryId: created.inquiry.id,
      },
      draftStorage,
    )
    await addClinicInquiryNote(clinicReq, {
      idempotencyKey: `${slugPrefix}-package-note`,
      inquiryId: created.inquiry.id,
      text: 'Synthetic note that must be deleted.',
    })
    const parallelOperatorReq = await createLocalReq({}, payload)
    parallelOperatorReq.user = operatorReq.user
    let markDeletionStarted: (() => void) | undefined
    let releaseDeletion: (() => void) | undefined
    const deletionStarted = new Promise<void>((resolve) => {
      markDeletionStarted = resolve
    })
    const deletionReleased = new Promise<void>((resolve) => {
      releaseDeletion = resolve
    })
    let deletionPaused = false
    const storage = {
      deleteObjects: vi.fn(async () => {
        if (deletionPaused) return
        deletionPaused = true
        markDeletionStarted?.()
        await deletionReleased
      }),
    }

    const packageHold = await placeInquiryLegalHold(operatorReq, {
      reasonCategory: 'legal-request',
      responsibleFunction: 'legal',
      reviewAt: '2027-01-01T00:00:00.000Z',
      targetId: String(created.inquiry.id),
      targetType: 'inquiry',
    })
    await expect(
      hardDeleteInquiryPackage(
        operatorReq,
        { inquiryId: created.inquiry.id, reasonCategory: 'authorized-erasure' },
        storage,
      ),
    ).rejects.toMatchObject({ kind: 'invalid-state' })
    await releaseInquiryLegalHold(operatorReq, { holdId: packageHold.holdId })

    const packageDeletion = hardDeleteInquiryPackage(
      operatorReq,
      { inquiryId: created.inquiry.id, reasonCategory: 'authorized-erasure' },
      storage,
    )
    await deletionStarted
    try {
      await expect(
        placeInquiryLegalHold(parallelOperatorReq, {
          reasonCategory: 'legal-request',
          responsibleFunction: 'legal',
          reviewAt: '2027-01-01T00:00:00.000Z',
          targetId: String(created.inquiry.id),
          targetType: 'inquiry',
        }),
      ).rejects.toMatchObject({ kind: 'invalid-state' })
      await expect(
        addClinicInquiryNote(clinicReq, {
          idempotencyKey: `${slugPrefix}-mid-delete-note`,
          inquiryId: created.inquiry.id,
          text: 'This concurrent note must never be stored.',
        }),
      ).rejects.toMatchObject({ kind: 'invalid-state' })
      await expect(
        createAttachmentDraft(
          patientReq,
          {
            fileName: 'concurrent-package.pdf',
            inquiryId: created.inquiry.id,
            mimeType: 'application/pdf',
            sizeBytes: 12,
          },
          draftStorage,
        ),
      ).rejects.toMatchObject({ kind: 'not-found' })
    } finally {
      releaseDeletion?.()
    }
    await expect(packageDeletion).resolves.toEqual({ deleted: true, replayed: false })
    expect(deletionPaused).toBe(true)
    expect(operatorReq.context?.inquiryIdentityScrub).toBeUndefined()
    expect(draftStorage.createUpload).toHaveBeenCalledTimes(1)

    const [concurrentNotes, concurrentAttachments] = await Promise.all([
      payload.find({
        collection: 'inquiryInternalNotes',
        depth: 0,
        overrideAccess: true,
        where: { idempotencyKey: { equals: `${slugPrefix}-mid-delete-note` } },
      }),
      payload.find({
        collection: 'inquiryAttachments',
        depth: 0,
        overrideAccess: true,
        where: { fileName: { equals: 'concurrent-package.pdf' } },
      }),
    ])
    expect(concurrentNotes.totalDocs).toBe(0)
    expect(concurrentAttachments.totalDocs).toBe(0)

    const clinicDetail = (await readClinicInquiryDetail(clinicReq, { inquiryId: created.inquiry.id })).inquiry
    expect(clinicDetail).toMatchObject({
      binding: { canReply: false, kind: 'deleted-patient' },
      contact: { mode: 'unavailable' },
      interest: { label: 'Deleted inquiry' },
      originalRequest: { contentState: 'hard-deleted' },
      patientName: 'Deleted patient',
    })
    expect(clinicDetail.interest).toEqual({ label: 'Deleted inquiry' })
    expect(clinicDetail.originalRequest).toEqual({ contentState: 'hard-deleted' })
    expect(JSON.stringify(clinicDetail)).not.toContain('Synthetic original request that must be deleted.')
    expect(JSON.stringify(clinicDetail)).not.toContain('Synthetic message that must be deleted.')
    expect(JSON.stringify(clinicDetail)).not.toContain('Synthetic note that must be deleted.')
    await expect(
      addClinicInquiryNote(clinicReq, {
        idempotencyKey: `${slugPrefix}-post-delete-note`,
        inquiryId: created.inquiry.id,
        text: 'This note must never be stored.',
      }),
    ).rejects.toMatchObject({ kind: 'invalid-state' })
    await expect(
      createInquiryModerationReport(clinicReq, {
        category: 'privacy-concern',
        idempotencyKey: `${slugPrefix}-post-delete-report`,
        inquiryId: created.inquiry.id,
        targetId: 'deleted-message',
        targetType: 'message',
      }),
    ).rejects.toMatchObject({ kind: 'invalid-state' })

    const proof = await payload.find({
      collection: 'inquiryDeletionProofs',
      depth: 0,
      overrideAccess: true,
      where: {
        and: [{ inquiryId: { equals: String(created.inquiry.id) } }, { operation: { equals: 'hard-deleted' } }],
      },
    })
    expect(proof.docs).toContainEqual(
      expect.objectContaining({
        deletedObjectCount: expect.any(Number),
        tombstoneKey: expect.stringMatching(/^[a-f0-9]{64}$/u),
      }),
    )
    expect(JSON.stringify(proof.docs)).not.toContain('Synthetic message that must be deleted.')

    await (
      payload.db as unknown as { pool: { query: (query: string, values: unknown[]) => Promise<unknown> } }
    ).pool.query(
      `UPDATE patient_clinic_inquiries
       SET patient_id = $1, full_name = $2, email = $3, phone_number = $4, message = $5,
           retention_state = 'available', deletion_tombstone_key = NULL
       WHERE id = $6`,
      [
        patient.id,
        'Restored Package Identity',
        'restored-package@example.com',
        '+493000000086',
        'Restored package content must stay unavailable.',
        Number(created.inquiry.id),
      ],
    )
    await (
      payload.db as unknown as { pool: { query: (query: string, values: unknown[]) => Promise<unknown> } }
    ).pool.query(`UPDATE inquiry_internal_notes SET text = $1, content_state = 'available' WHERE inquiry_id = $2`, [
      'Restored note content must stay unavailable.',
      Number(created.inquiry.id),
    ])
    const restoredPackage = (await readClinicInquiryDetail(clinicReq, { inquiryId: created.inquiry.id })).inquiry
    expect(restoredPackage).toMatchObject({
      originalRequest: { contentState: 'hard-deleted' },
      patientName: 'Deleted patient',
    })
    expect(JSON.stringify(restoredPackage)).not.toContain('Restored package content must stay unavailable.')
    expect(JSON.stringify(restoredPackage)).not.toContain('Restored note content must stay unavailable.')
    await expect(
      hardDeleteInquiryPackage(
        operatorReq,
        { inquiryId: created.inquiry.id, reasonCategory: 'authorized-erasure' },
        storage,
      ),
    ).resolves.toEqual({ deleted: true, replayed: true })
    const repairedPackage = await payload.findByID({
      collection: 'patientClinicInquiries',
      depth: 0,
      id: created.inquiry.id,
      overrideAccess: true,
    })
    expect(repairedPackage).toMatchObject({ message: null, patient: null, retentionState: 'hard-deleted' })
    await payload.update({
      collection: 'clinicStaff',
      data: { status: 'offboarded' },
      depth: 0,
      id: staff.id,
      overrideAccess: true,
    })
  })

  it('ends clinic write access after offboarding while preserving patient read-only history', async () => {
    const patient = await createPatientTestUser(payload, {
      createdPatientIds,
      emailPrefix: `${slugPrefix}-offboarding-patient`,
      firstName: 'Synthetic',
      lastName: 'Patient',
    })
    const staff = await createClinicTestUser(payload, {
      createdStaffIds,
      emailPrefix: `${slugPrefix}-offboarding-staff`,
      firstName: 'Synthetic',
      lastName: 'Clinician',
    })
    await payload.update({
      collection: 'clinicStaff',
      data: { clinic: clinicId, status: 'approved' },
      depth: 0,
      id: staff.id,
      overrideAccess: true,
    })

    const patientReq = await createLocalReq({}, payload)
    patientReq.user = asPayloadPatientUser(patient)
    const clinicReq = await createLocalReq({}, payload)
    clinicReq.user = await asClinicScopedPayloadUser(payload, staff, clinicId)
    const created = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(doctorId),
      idempotencyKey: `${slugPrefix}-offboarding-create`,
      message: 'Synthetic inquiry retained through clinic offboarding.',
      phoneNumber: '+493000000077',
    })
    createdInquiryIds.push(created.inquiry.id)

    expect(created.inquiry.actions.canReply).toBe(true)
    await payload.update({
      collection: 'clinicStaff',
      data: { status: 'offboarded' },
      depth: 0,
      id: staff.id,
      overrideAccess: true,
    })

    await expect(readClinicInquiryDetail(clinicReq, { inquiryId: created.inquiry.id })).rejects.toMatchObject({
      kind: 'access-denied',
    })

    const retained = await readPatientInquiryDetail(patientReq, { inquiryId: created.inquiry.id })
    expect(retained.actions.canView).toBe(true)
    expect(retained.actions.canReply).toBe(false)
    expect(retained.clinic.messagingAvailable).toBe(false)
    expect(retained.originalRequest.message).toBe('Synthetic inquiry retained through clinic offboarding.')
    await expect(
      sendPatientInquiryMessage(patientReq, {
        expectedRevision: retained.revision,
        idempotencyKey: `${slugPrefix}-offboarding-send`,
        inquiryId: retained.id,
        text: 'This message must not be accepted after offboarding.',
      }),
    ).rejects.toMatchObject({ kind: 'invalid-state' })
  })
})

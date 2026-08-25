import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'

import config from '@payload-config'
import {
  addClinicInquiryNote,
  createAttachmentDraft,
  createVerifiedPatientInquiry,
  finalizeAttachmentDraft,
  InquiryCommunicationServiceError,
  readAttachmentAccess,
  readClinicInquiryDetail,
  readClinicInquiryQueue,
  readLegacyClinicInquiryDetail,
  readLegacyClinicInquiryQueue,
  readPatientInquiryQueue,
  readPatientInquiryDetail,
  sendClinicInquiryMessage,
  sendPatientInquiryMessage,
  sweepExpiredAttachmentDrafts,
  updateClinicInquiryReadPosition,
  updateClinicInquiryState,
  updatePatientInquiryReadPosition,
} from '@/features/inquiryCommunication/service'
import type { InquiryAttachmentStorageGateway } from '@/features/inquiryCommunication/storage'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { testSlug } from '../fixtures/testSlug'
import {
  asClinicScopedPayloadUser,
  asPayloadPatientUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPatientTestUser,
} from '../fixtures/testUsers'

vi.mock('@payloadcms/storage-s3', () => ({
  s3Storage: () => (incomingConfig: unknown) => incomingConfig,
}))

describe('inquiry communication lifecycle', () => {
  let payload: Payload
  let clinicId: number
  let clinicName: string
  let doctorId: number
  let foreignClinicId: number
  let foreignDoctorId: number
  let patientReq: PayloadRequest
  let foreignPatientReq: PayloadRequest
  let clinicReqA: PayloadRequest
  let clinicReqB: PayloadRequest
  let foreignClinicReq: PayloadRequest
  const createdPatientIds: Array<number | string> = []
  const createdStaffIds: Array<number | string> = []
  const createdInquiryIds: Array<number | string> = []
  const slugPrefix = testSlug('inquiryCommunication.lifecycle.test.ts')
  let inquiryCounter = 0

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cities = await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })
    const city = cities.docs[0]
    if (!city) throw new Error('Expected baseline city')

    const fixture = await createClinicFixture(payload, city.id, { slugPrefix })
    clinicId = fixture.clinic.id
    clinicName = fixture.clinic.name
    doctorId = fixture.doctor.id

    const foreignClinicFixture = await createClinicFixture(payload, city.id, {
      clinicIndex: 1,
      doctorIndex: 1,
      slugPrefix: `${slugPrefix}-foreign-clinic`,
    })
    foreignClinicId = foreignClinicFixture.clinic.id
    foreignDoctorId = foreignClinicFixture.doctor.id
    await payload.update({
      collection: 'clinics',
      data: { status: 'approved' },
      depth: 0,
      id: foreignClinicId,
      overrideAccess: true,
    })

    const patient = await createPatientTestUser(payload, {
      createdPatientIds,
      emailPrefix: `${slugPrefix}-patient`,
      firstName: 'Ada',
      lastName: 'Patient',
    })
    const foreignPatient = await createPatientTestUser(payload, {
      createdPatientIds,
      emailPrefix: `${slugPrefix}-foreign`,
      firstName: 'Foreign',
      lastName: 'Patient',
    })

    patientReq = await createLocalReq({}, payload)
    patientReq.user = asPayloadPatientUser(patient)
    foreignPatientReq = await createLocalReq({}, payload)
    foreignPatientReq.user = asPayloadPatientUser(foreignPatient)

    const clinicStaffA = await createClinicTestUser(payload, {
      createdStaffIds,
      emailPrefix: `${slugPrefix}-clinic-a`,
      firstName: 'Alice',
      lastName: 'Clinic',
    })
    const clinicStaffB = await createClinicTestUser(payload, {
      createdStaffIds,
      emailPrefix: `${slugPrefix}-clinic-b`,
      firstName: 'Bob',
      lastName: 'Clinic',
    })
    clinicReqA = await createLocalReq({}, payload)
    clinicReqA.user = await asClinicScopedPayloadUser(payload, clinicStaffA, clinicId)
    clinicReqB = await createLocalReq({}, payload)
    clinicReqB.user = await asClinicScopedPayloadUser(payload, clinicStaffB, clinicId)
    const foreignClinicStaff = await createClinicTestUser(payload, {
      createdStaffIds,
      emailPrefix: `${slugPrefix}-foreign-clinic`,
      firstName: 'Foreign',
      lastName: 'Clinic',
    })
    foreignClinicReq = await createLocalReq({}, payload)
    foreignClinicReq.user = await asClinicScopedPayloadUser(payload, foreignClinicStaff, foreignClinicId)
  }, 60_000)

  afterAll(async () => {
    for (const collection of [
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
        where: { inquiry: { in: createdInquiryIds } },
      })
    }
    for (const id of createdInquiryIds) {
      await payload.delete({ collection: 'patientClinicInquiries', id, overrideAccess: true })
    }
    await cleanupTrackedUsers(payload, { patientIds: createdPatientIds, staffIds: createdStaffIds })
    await payload.delete({ collection: 'doctors', overrideAccess: true, where: { clinic: { equals: clinicId } } })
    await payload.delete({ collection: 'doctors', id: foreignDoctorId, overrideAccess: true })
    await payload.delete({ collection: 'clinics', id: clinicId, overrideAccess: true })
    await payload.delete({ collection: 'clinics', id: foreignClinicId, overrideAccess: true })
  })

  const createInquiry = async (suffix: string) => {
    inquiryCounter += 1
    const result = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(doctorId),
      idempotencyKey: `${slugPrefix}-${suffix}-${inquiryCounter}-create`,
      message: `Synthetic inquiry ${suffix}.`,
      phoneNumber: '+493000000001',
      treatmentTimeline: 'within_two_weeks',
    })
    createdInquiryIds.push(result.inquiry.id)
    return result.inquiry
  }

  const storageGateway = (): InquiryAttachmentStorageGateway => ({
    createReadAccess: vi.fn(async () => ({
      expiresAt: '2026-08-24T10:01:00.000Z',
      method: 'GET' as const,
      url: 'https://storage.invalid/synthetic-signed-access',
    })),
    createUpload: vi.fn(async ({ mimeType }) => ({
      headers: { 'content-type': mimeType },
      method: 'PUT' as const,
      url: 'https://storage.invalid/synthetic-signed-upload',
    })),
    deleteObjects: vi.fn(async () => undefined),
    sealDraft: vi.fn(async ({ declaredMimeType, declaredSizeBytes, readyObjectKey }) => ({
      mimeType: declaredMimeType,
      readyObjectKey,
      sizeBytes: declaredSizeBytes,
    })),
    verifySealed: vi.fn(async () => undefined),
  })

  it('creates one patient-bound conversation and replays the actor-bound inquiry request', async () => {
    const input = {
      clinicId: String(clinicId),
      consent: true as const,
      doctorId: String(doctorId),
      idempotencyKey: `${slugPrefix}-create-0001`,
      message: 'Please contact me about a synthetic treatment inquiry.',
      phoneNumber: '+493000000001',
      treatmentTimeline: 'within_two_weeks',
    }

    const created = await createVerifiedPatientInquiry(patientReq, input)
    createdInquiryIds.push(created.inquiry.id)

    expect(created.replayed).toBe(false)
    expect(created.inquiry).toMatchObject({
      binding: {
        canReply: true,
        kind: 'patient',
        patient: { displayName: 'Ada Patient' },
      },
      clinic: { displayName: clinicName, id: String(clinicId) },
      handlingStatus: 'submitted',
      lifecycle: 'open',
      revision: 0,
    })

    const replay = await createVerifiedPatientInquiry(patientReq, input)
    expect(replay).toMatchObject({ replayed: true, inquiry: { id: created.inquiry.id } })

    const conversations = await payload.find({
      collection: 'inquiryConversations' as never,
      depth: 0,
      limit: 10,
      overrideAccess: true,
      where: { inquiry: { equals: created.inquiry.id } },
    })
    expect(conversations.docs).toHaveLength(1)

    await expect(readPatientInquiryDetail(foreignPatientReq, { inquiryId: created.inquiry.id })).rejects.toMatchObject({
      kind: 'not-found',
    } satisfies Partial<InquiryCommunicationServiceError>)
  })

  it('keeps legacy inquiries read-only until cutover without inventing unread state or partial writes', async () => {
    const legacy = await payload.create({
      collection: 'patientClinicInquiries',
      context: { inquiryCommunicationCommand: true },
      data: {
        clinic: clinicId,
        consent: {
          accepted: true,
          acceptedAt: '2026-08-24T10:00:00.000Z',
          text: 'Synthetic legacy consent.',
        },
        doctor: doctorId,
        email: `${slugPrefix}-legacy@example.com`,
        fullName: 'Synthetic Legacy Patient',
        message: 'Synthetic legacy inquiry awaiting cutover.',
        phoneNumber: '+493000000099',
        status: 'closed',
      },
      depth: 0,
      overrideAccess: true,
    })
    createdInquiryIds.push(legacy.id)

    const detail = await readClinicInquiryDetail(clinicReqA, { inquiryId: String(legacy.id) })
    expect(detail.inquiry).toMatchObject({
      actions: {
        canAddInternalNote: false,
        canChangeHandlingStatus: false,
        canChangeLifecycle: false,
        canMarkRead: false,
        canMarkUnread: false,
        canReply: false,
        canRevealContact: false,
        canView: true,
      },
      handlingStatus: 'submitted',
      lifecycle: 'closed',
      unread: { count: 0, isUnread: false },
    })
    const legacyClosedDetail = await readLegacyClinicInquiryDetail(clinicReqA, {
      inquiryId: String(legacy.id),
    })
    expect(legacyClosedDetail).toMatchObject({
      email: '',
      phoneNumber: '',
      status: 'closed',
    })
    const legacyClosedQueue = await readLegacyClinicInquiryQueue(clinicReqA)
    expect(legacyClosedQueue.docs.find(({ id }) => id === String(legacy.id))).toMatchObject({
      email: '',
      phoneNumber: '',
      status: 'closed',
    })
    const unreadQueue = await readClinicInquiryQueue(clinicReqA, {
      lifecycle: 'all',
      limit: 50,
      unreadOnly: true,
    })
    expect(unreadQueue.items.map(({ id }) => id)).not.toContain(String(legacy.id))

    await expect(
      addClinicInquiryNote(clinicReqA, {
        idempotencyKey: `${slugPrefix}-legacy-note`,
        inquiryId: String(legacy.id),
        text: 'Synthetic note must not be written.',
      }),
    ).rejects.toMatchObject({ kind: 'invalid-state', current: { actions: { canAddInternalNote: false } } })
    await expect(
      updateClinicInquiryState(clinicReqA, {
        action: 'reopen',
        expectedRevision: 0,
        inquiryId: String(legacy.id),
      }),
    ).rejects.toMatchObject({ kind: 'invalid-state', current: { actions: { canChangeLifecycle: false } } })
    await expect(
      updateClinicInquiryReadPosition(clinicReqA, { inquiryId: String(legacy.id), mode: 'read' }),
    ).rejects.toMatchObject({ kind: 'invalid-state', current: { unread: { count: 0, isUnread: false } } })
    const legacyStorage = storageGateway()
    await expect(
      createAttachmentDraft(
        clinicReqA,
        {
          fileName: 'legacy.pdf',
          inquiryId: String(legacy.id),
          mimeType: 'application/pdf',
          sizeBytes: 4,
        },
        legacyStorage,
      ),
    ).rejects.toMatchObject({ kind: 'invalid-state', current: { actions: { canReply: false } } })
    expect(legacyStorage.createUpload).not.toHaveBeenCalled()

    for (const collection of [
      'inquiryAttachments',
      'inquiryAuditEvents',
      'inquiryInternalNotes',
      'inquiryReadPositions',
    ] as const) {
      const records = await payload.find({
        collection: collection as never,
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: { inquiry: { equals: legacy.id } },
      })
      expect(records.docs, collection).toHaveLength(0)
    }
    await expect(
      payload.findByID({
        collection: 'patientClinicInquiries',
        depth: 0,
        id: legacy.id,
        overrideAccess: true,
      }),
    ).resolves.toMatchObject({
      activitySequence: null,
      clinicNotificationSequence: null,
      handlingStatus: null,
      lifecycle: null,
      revision: null,
      status: 'closed',
    })
  })

  it('masks spam contact details consistently in the legacy queue and detail bridge', async () => {
    const spam = await payload.create({
      collection: 'patientClinicInquiries',
      context: { inquiryCommunicationCommand: true },
      data: {
        clinic: clinicId,
        consent: {
          accepted: true,
          acceptedAt: '2026-08-24T10:00:00.000Z',
          text: 'Synthetic legacy consent.',
        },
        doctor: doctorId,
        email: `${slugPrefix}-spam@example.com`,
        fullName: 'Synthetic Spam Patient',
        message: 'Synthetic legacy spam inquiry.',
        phoneNumber: '+493000000098',
        status: 'spam',
      },
      depth: 0,
      overrideAccess: true,
    })
    createdInquiryIds.push(spam.id)

    const [detail, queue] = await Promise.all([
      readLegacyClinicInquiryDetail(clinicReqA, { inquiryId: String(spam.id) }),
      readLegacyClinicInquiryQueue(clinicReqA),
    ])
    const queueItem = queue.docs.find(({ id }) => id === String(spam.id))

    expect(detail).toMatchObject({
      email: `${slugPrefix.charAt(0)}•••@example.com`,
      phoneNumber: '••••••0098',
      status: 'spam',
    })
    expect(queueItem).toMatchObject({
      email: detail.email,
      phoneNumber: detail.phoneNumber,
      status: 'spam',
    })
    expect(JSON.stringify({ detail, queueItem })).not.toContain(`${slugPrefix}-spam@example.com`)
    expect(JSON.stringify({ detail, queueItem })).not.toContain('+493000000098')
  })

  it('keeps queue, detail, commands, read positions, and attachments isolated by clinic', async () => {
    const inquiry = await createInquiry('cross-clinic')

    const foreignQueue = await readClinicInquiryQueue(foreignClinicReq, {
      lifecycle: 'all',
      limit: 50,
      unreadOnly: false,
    })
    expect(foreignQueue.items.map(({ id }) => id)).not.toContain(inquiry.id)
    await expect(readClinicInquiryDetail(foreignClinicReq, { inquiryId: inquiry.id })).rejects.toMatchObject({
      kind: 'not-found',
    })
    await expect(
      updateClinicInquiryState(foreignClinicReq, {
        action: 'close',
        expectedRevision: inquiry.revision,
        inquiryId: inquiry.id,
      }),
    ).rejects.toMatchObject({ kind: 'not-found' })
    await expect(
      updateClinicInquiryReadPosition(foreignClinicReq, { inquiryId: inquiry.id, mode: 'read' }),
    ).rejects.toMatchObject({ kind: 'not-found' })

    const foreignWriteStorage = storageGateway()
    await expect(
      createAttachmentDraft(
        foreignClinicReq,
        {
          fileName: 'foreign-write.pdf',
          inquiryId: inquiry.id,
          mimeType: 'application/pdf',
          sizeBytes: 4,
        },
        foreignWriteStorage,
      ),
    ).rejects.toMatchObject({ kind: 'not-found' })
    expect(foreignWriteStorage.createUpload).not.toHaveBeenCalled()

    const ownerStorage = storageGateway()
    const draft = await createAttachmentDraft(
      clinicReqA,
      {
        fileName: 'cross-clinic.pdf',
        inquiryId: inquiry.id,
        mimeType: 'application/pdf',
        sizeBytes: 4,
      },
      ownerStorage,
    )
    await finalizeAttachmentDraft(clinicReqA, { draftId: draft.draftId, inquiryId: inquiry.id }, ownerStorage)
    const sent = await sendClinicInquiryMessage(
      clinicReqA,
      {
        attachmentDraftId: draft.draftId,
        expectedRevision: inquiry.revision,
        idempotencyKey: `${slugPrefix}-cross-clinic-attachment-send`,
        inquiryId: inquiry.id,
      },
      ownerStorage,
    )
    const attachmentActivity = sent.inquiry.timeline.find(
      (activity) => activity.kind === 'external-message' && activity.attachment?.fileName === 'cross-clinic.pdf',
    )
    const attachmentId = attachmentActivity?.kind === 'external-message' ? attachmentActivity.attachment?.id : undefined
    expect(attachmentId).toEqual(expect.any(String))

    const foreignReadStorage = storageGateway()
    await expect(
      readAttachmentAccess(
        foreignClinicReq,
        { attachmentId: String(attachmentId), mode: 'download' },
        foreignReadStorage,
      ),
    ).rejects.toMatchObject({ kind: 'not-found' })
    expect(foreignReadStorage.createReadAccess).not.toHaveBeenCalled()
  })

  it('replays idempotent notes before revision checks and returns actor-safe conflict state', async () => {
    const inquiry = await createInquiry('idempotency')
    const noteInput = {
      idempotencyKey: `${slugPrefix}-note-idempotency`,
      inquiryId: inquiry.id,
      text: '  Preserve this synthetic note\nwith its spacing.  ',
    }

    const note = await addClinicInquiryNote(clinicReqA, noteInput)
    expect(note).toMatchObject({ inquiry: { revision: 0 }, replayed: false })
    expect(note.inquiry.timeline.at(-1)).toMatchObject({ kind: 'internal-note', text: noteInput.text })

    const state = await updateClinicInquiryState(clinicReqA, {
      action: 'set-handling-status',
      expectedRevision: 0,
      handlingStatus: 'in_review',
      inquiryId: inquiry.id,
    })
    expect(state.inquiry.revision).toBe(1)

    const replay = await addClinicInquiryNote(clinicReqA, noteInput)
    expect(replay).toMatchObject({ inquiry: { revision: 1 }, replayed: true })

    await expect(
      addClinicInquiryNote(clinicReqA, { ...noteInput, text: 'Different semantic input.' }),
    ).rejects.toMatchObject({
      current: { id: inquiry.id, revision: 1 },
      kind: 'conflict',
    })

    try {
      await sendPatientInquiryMessage(patientReq, {
        expectedRevision: 0,
        idempotencyKey: `${slugPrefix}-patient-stale-message`,
        inquiryId: inquiry.id,
        text: 'A stale synthetic patient message.',
      })
      throw new Error('Expected stale patient message to conflict')
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(InquiryCommunicationServiceError)
      const conflict = error as InquiryCommunicationServiceError
      expect(conflict).toMatchObject({ kind: 'conflict', current: { revision: 1 } })
      expect(conflict.current?.timeline).toEqual([])
    }

    await expect(
      readClinicInquiryQueue(clinicReqA, {
        handlingStatus: undefined,
        lifecycle: 'all',
        limit: 25,
        query: noteInput.text.trim(),
        unreadOnly: false,
      }),
    ).resolves.toMatchObject({ items: [expect.objectContaining({ id: inquiry.id })] })
    for (const forbiddenQuery of [`${slugPrefix}-patient@example.com`, '+493000000001', 'handling-status-changed']) {
      const result = await readClinicInquiryQueue(clinicReqA, {
        lifecycle: 'all',
        limit: 25,
        query: forbiddenQuery,
        unreadOnly: false,
      })
      expect(result.items.map(({ id }) => id)).not.toContain(inquiry.id)
    }
  })

  it('keeps personal clinic unread independent from state events and clears the team through the spam floor', async () => {
    const inquiry = await createInquiry('clinic-unread')
    const initialPatient = await readPatientInquiryDetail(patientReq, { inquiryId: inquiry.id })
    const initialA = await readClinicInquiryDetail(clinicReqA, { inquiryId: inquiry.id })
    const initialB = await readClinicInquiryDetail(clinicReqB, { inquiryId: inquiry.id })
    expect(initialA.inquiry.contact.mode).toBe('full')
    expect(initialA.inquiry.unread).toMatchObject({ count: 1, isUnread: true })
    expect(initialB.inquiry.unread).toMatchObject({ count: 1, isUnread: true })

    const readA = await updateClinicInquiryReadPosition(clinicReqA, {
      inquiryId: inquiry.id,
      mode: 'read',
    })
    expect(readA.inquiry.actions).toMatchObject({ canMarkRead: false, canMarkUnread: true })
    const unreadA = await updateClinicInquiryReadPosition(clinicReqA, {
      inquiryId: inquiry.id,
      mode: 'unread',
    })
    expect(unreadA.inquiry.unread).toMatchObject({ count: 1, isUnread: true })
    await updateClinicInquiryReadPosition(clinicReqA, { inquiryId: inquiry.id, mode: 'read' })

    await updateClinicInquiryState(clinicReqA, {
      action: 'set-handling-status',
      expectedRevision: 0,
      handlingStatus: 'in_review',
      inquiryId: inquiry.id,
    })
    await updateClinicInquiryState(clinicReqA, {
      action: 'close',
      expectedRevision: 1,
      inquiryId: inquiry.id,
      reason: 'Synthetic close reason.',
    })
    expect((await readClinicInquiryDetail(clinicReqA, { inquiryId: inquiry.id })).inquiry.unread).toMatchObject({
      count: 0,
      isUnread: false,
    })
    expect((await readClinicInquiryDetail(clinicReqB, { inquiryId: inquiry.id })).inquiry.unread.isUnread).toBe(true)

    const spam = await updateClinicInquiryState(clinicReqA, {
      action: 'mark-spam',
      expectedRevision: 2,
      inquiryId: inquiry.id,
      reason: 'Synthetic spam evidence.',
    })
    expect(spam.inquiry.contact.mode).toBe('masked')
    expect(spam.inquiry.unread).toMatchObject({ count: 0, isUnread: false })
    expect((await readClinicInquiryDetail(clinicReqB, { inquiryId: inquiry.id })).inquiry.unread).toMatchObject({
      count: 0,
      isUnread: false,
    })

    const note = await addClinicInquiryNote(clinicReqA, {
      idempotencyKey: `${slugPrefix}-after-spam-note`,
      inquiryId: inquiry.id,
      text: 'Synthetic team-only note after spam.',
    })
    expect(note.inquiry.unread.isUnread).toBe(false)
    expect((await readClinicInquiryDetail(clinicReqB, { inquiryId: inquiry.id })).inquiry.unread).toMatchObject({
      count: 1,
      isUnread: true,
    })
    const patientAfterInternalWork = await readPatientInquiryDetail(patientReq, { inquiryId: inquiry.id })
    expect(patientAfterInternalWork).toMatchObject({
      handlingStatus: 'in_review',
      lastActivityAt: initialPatient.lastActivityAt,
      lifecycle: 'closed',
      revision: 3,
      timeline: [],
    })
    expect(JSON.stringify(patientAfterInternalWork)).not.toContain('spam')
    expect(JSON.stringify(await readPatientInquiryQueue(patientReq))).not.toContain('spam')
  })

  it('returns the actor-safe current detail for invalid state and serialization conflicts', async () => {
    const closedInquiry = await createInquiry('invalid-state-current')
    await updateClinicInquiryState(clinicReqA, {
      action: 'close',
      expectedRevision: 0,
      inquiryId: closedInquiry.id,
    })
    await expect(
      updateClinicInquiryState(clinicReqA, {
        action: 'close',
        expectedRevision: 1,
        inquiryId: closedInquiry.id,
      }),
    ).rejects.toMatchObject({
      current: {
        actions: { canRevealContact: false },
        clinic: { displayName: clinicName, id: String(clinicId) },
        contact: { mode: 'collapsed' },
        lifecycle: 'closed',
        revision: 1,
      },
      kind: 'invalid-state',
    })

    const concurrentInquiry = await createInquiry('serialization-current')
    const serializationFailure = Object.assign(new Error('Synthetic serialization failure'), { code: '40001' })
    const commit = vi.spyOn(payload.db, 'commitTransaction').mockRejectedValue(serializationFailure)
    try {
      await expect(
        updateClinicInquiryState(clinicReqA, {
          action: 'set-handling-status',
          expectedRevision: 0,
          handlingStatus: 'in_review',
          inquiryId: concurrentInquiry.id,
        }),
      ).rejects.toMatchObject({
        current: { handlingStatus: 'submitted', id: concurrentInquiry.id, revision: 0 },
        kind: 'conflict',
      })
    } finally {
      commit.mockRestore()
    }
    await expect(readClinicInquiryDetail(clinicReqA, { inquiryId: concurrentInquiry.id })).resolves.toMatchObject({
      inquiry: { handlingStatus: 'submitted', revision: 0 },
    })
  })

  it('lets an internal note and close complete across a real serializable race', async () => {
    const inquiry = await createInquiry('parallel-note-close')
    const [note, close] = await Promise.all([
      addClinicInquiryNote(clinicReqA, {
        idempotencyKey: `${slugPrefix}-parallel-note`,
        inquiryId: inquiry.id,
        text: 'Synthetic note concurrent with close.',
      }),
      updateClinicInquiryState(clinicReqB, {
        action: 'close',
        expectedRevision: 0,
        inquiryId: inquiry.id,
      }),
    ])
    expect(note.replayed).toBe(false)
    expect(close.inquiry).toMatchObject({ lifecycle: 'closed', revision: 1 })
    const clinic = await readClinicInquiryDetail(clinicReqA, { inquiryId: inquiry.id })
    expect(clinic.inquiry).toMatchObject({ lifecycle: 'closed', revision: 1 })
    expect(clinic.inquiry.timeline).toContainEqual(
      expect.objectContaining({ kind: 'internal-note', text: 'Synthetic note concurrent with close.' }),
    )
    await expect(readPatientInquiryDetail(patientReq, { inquiryId: inquiry.id })).resolves.toMatchObject({
      lifecycle: 'closed',
      revision: 1,
      timeline: [],
    })
  })

  it('filters the patient queue server-side and keeps global counts before paging', async () => {
    const openInquiry = await createInquiry('patient-queue-open')
    const closedInquiry = await createInquiry('patient-queue-closed')
    await updateClinicInquiryState(clinicReqA, {
      action: 'close',
      expectedRevision: 0,
      inquiryId: closedInquiry.id,
    })

    const all = await readPatientInquiryQueue(patientReq, { lifecycle: 'all', limit: 50 })
    const firstPage = await readPatientInquiryQueue(patientReq, { lifecycle: 'all', limit: 1 })
    const open = await readPatientInquiryQueue(patientReq, { lifecycle: 'open', limit: 50 })
    const closed = await readPatientInquiryQueue(patientReq, { lifecycle: 'closed', limit: 50 })
    expect(firstPage).toMatchObject({ counts: all.counts, items: [expect.any(Object)] })
    expect(open.items.every((item) => item.lifecycle === 'open')).toBe(true)
    expect(closed.items.every((item) => item.lifecycle === 'closed')).toBe(true)
    expect(open.items.map(({ id }) => id)).toContain(openInquiry.id)
    expect(closed.items.map(({ id }) => id)).toContain(closedInquiry.id)
    expect(all.counts).toEqual({
      all: all.items.length,
      closed: closed.items.length,
      open: open.items.length,
    })

    await updateClinicInquiryState(clinicReqA, {
      action: 'mark-spam',
      expectedRevision: 1,
      inquiryId: closedInquiry.id,
      reason: 'Synthetic queue count spam evidence.',
    })
    const afterSpam = await readPatientInquiryQueue(patientReq, { lifecycle: 'closed', limit: 50 })
    expect(afterSpam.counts).toEqual(all.counts)
    expect(afterSpam.items).toContainEqual(
      expect.objectContaining({ handlingStatus: 'submitted', id: closedInquiry.id, lifecycle: 'closed' }),
    )
    expect(JSON.stringify(afterSpam)).not.toContain('spam')
  })

  it('returns the personal clinic unread total before filters and paging', async () => {
    const baseline = await readClinicInquiryQueue(clinicReqA, {
      lifecycle: 'all',
      limit: 50,
      unreadOnly: false,
    })
    const first = await createInquiry('unread-total-one')
    const second = await createInquiry('unread-total-two')
    await updateClinicInquiryReadPosition(clinicReqA, { inquiryId: first.id, mode: 'read' })

    const filtered = await readClinicInquiryQueue(clinicReqA, {
      lifecycle: 'all',
      limit: 1,
      query: 'Synthetic inquiry unread-total-two.',
      unreadOnly: false,
    })
    expect(filtered).toMatchObject({
      items: [expect.objectContaining({ id: second.id })],
      unchanged: false,
      unreadCount: baseline.unreadCount + 1,
    })

    const findSpy = vi.spyOn(clinicReqA.payload, 'find')
    await expect(
      readClinicInquiryQueue(clinicReqA, {
        knownChangeCursor: filtered.changeCursor,
        lifecycle: 'all',
        limit: 1,
        query: 'Synthetic inquiry unread-total-two.',
        unreadOnly: false,
      }),
    ).resolves.toEqual({
      changeCursor: filtered.changeCursor,
      items: [],
      unchanged: true,
      unreadCount: filtered.unreadCount,
    })
    const expensiveProjectionCollections = new Set([
      'inquiryAttachments',
      'inquiryAuditEvents',
      'inquiryInternalNotes',
      'inquiryMessages',
    ])
    expect(
      findSpy.mock.calls.some(([options]) =>
        expensiveProjectionCollections.has(String((options as { collection?: unknown }).collection)),
      ),
    ).toBe(false)
    findSpy.mockRestore()

    await expect(
      readClinicInquiryQueue(clinicReqA, {
        knownChangeCursor: filtered.changeCursor,
        lifecycle: 'all',
        limit: 2,
        query: 'Synthetic inquiry unread-total-two.',
        unreadOnly: false,
      }),
    ).resolves.toMatchObject({ unchanged: false })
    const firstPage = await readClinicInquiryQueue(clinicReqA, {
      lifecycle: 'all',
      limit: 1,
      unreadOnly: false,
    })
    expect(firstPage.nextCursor).toEqual(expect.any(String))
    await expect(
      readClinicInquiryQueue(clinicReqA, {
        cursor: firstPage.nextCursor,
        knownChangeCursor: firstPage.changeCursor,
        lifecycle: 'all',
        limit: 1,
        unreadOnly: false,
      }),
    ).resolves.toMatchObject({ unchanged: false })

    await updateClinicInquiryReadPosition(clinicReqA, { inquiryId: second.id, mode: 'read' })
    const changed = await readClinicInquiryQueue(clinicReqA, {
      knownChangeCursor: filtered.changeCursor,
      lifecycle: 'all',
      limit: 1,
      query: 'Synthetic inquiry unread-total-two.',
      unreadOnly: false,
    })
    expect(changed).toMatchObject({ unchanged: false, unreadCount: baseline.unreadCount })
    expect(changed.changeCursor).not.toBe(filtered.changeCursor)
    await expect(
      readClinicInquiryQueue(clinicReqA, {
        lifecycle: 'closed',
        limit: 1,
        query: 'does-not-match-any-inquiry',
        unreadOnly: true,
      }),
    ).resolves.toMatchObject({ items: [], unreadCount: baseline.unreadCount })
  })

  it('uses opaque projection markers for detail refreshes without hiding same-revision notes', async () => {
    const inquiry = await createInquiry('detail-change-cursor')
    const initial = await readClinicInquiryDetail(clinicReqA, { inquiryId: inquiry.id })

    await expect(
      readClinicInquiryDetail(clinicReqA, {
        inquiryId: inquiry.id,
        knownChangeCursor: initial.changeCursor,
        knownRevision: initial.inquiry.revision,
      }),
    ).resolves.toMatchObject({
      changeCursor: initial.changeCursor,
      inquiry: { id: inquiry.id, revision: initial.inquiry.revision },
      unchanged: true,
    })

    await addClinicInquiryNote(clinicReqA, {
      idempotencyKey: `${slugPrefix}-detail-change-cursor-note`,
      inquiryId: inquiry.id,
      text: 'Synthetic detail marker note.',
    })
    const changed = await readClinicInquiryDetail(clinicReqA, {
      inquiryId: inquiry.id,
      knownChangeCursor: initial.changeCursor,
      knownRevision: initial.inquiry.revision,
    })

    expect(changed).toMatchObject({
      inquiry: {
        revision: initial.inquiry.revision,
        timeline: [expect.objectContaining({ kind: 'internal-note', text: 'Synthetic detail marker note.' })],
      },
      unchanged: false,
    })
    expect(changed.changeCursor).not.toBe(initial.changeCursor)
  })

  it('changes the clinic queue marker when projected clinic or interest names change', async () => {
    const inquiry = await createInquiry('queue-display-marker')
    const initial = await readClinicInquiryQueue(clinicReqA, {
      lifecycle: 'all',
      limit: 25,
      query: 'Synthetic inquiry queue-display-marker.',
      unreadOnly: false,
    })
    const doctor = await payload.findByID({ collection: 'doctors', depth: 0, id: doctorId, overrideAccess: true })
    const renamedClinic = `${clinicName}-renamed`
    await payload.update({
      collection: 'clinics',
      data: { name: renamedClinic },
      depth: 0,
      id: clinicId,
      overrideAccess: true,
    })
    const clinicChanged = await readClinicInquiryQueue(clinicReqA, {
      knownChangeCursor: initial.changeCursor,
      lifecycle: 'all',
      limit: 25,
      query: 'Synthetic inquiry queue-display-marker.',
      unreadOnly: false,
    })
    expect(clinicChanged).toMatchObject({
      items: [
        expect.objectContaining({
          clinic: expect.objectContaining({ displayName: renamedClinic }),
          id: inquiry.id,
        }),
      ],
      unchanged: false,
    })
    expect(clinicChanged.changeCursor).not.toBe(initial.changeCursor)

    const renamedDoctor = 'Dr. Synthetic Marker Change'
    await payload.update({
      collection: 'doctors',
      data: { firstName: 'Synthetic', lastName: 'Marker Change' },
      depth: 0,
      id: doctorId,
      overrideAccess: true,
    })
    const interestChanged = await readClinicInquiryQueue(clinicReqA, {
      knownChangeCursor: clinicChanged.changeCursor,
      lifecycle: 'all',
      limit: 25,
      query: 'Synthetic inquiry queue-display-marker.',
      unreadOnly: false,
    })
    expect(interestChanged).toMatchObject({
      items: [
        expect.objectContaining({
          id: inquiry.id,
          interest: expect.objectContaining({ label: `Consultation with ${renamedDoctor}` }),
        }),
      ],
      unchanged: false,
    })
    expect(interestChanged.changeCursor).not.toBe(clinicChanged.changeCursor)

    await payload.update({
      collection: 'doctors',
      data: { firstName: doctor.firstName, lastName: doctor.lastName, title: doctor.title },
      depth: 0,
      id: doctorId,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'clinics',
      data: { name: clinicName },
      depth: 0,
      id: clinicId,
      overrideAccess: true,
    })
  })

  it('notifies patients only for clinic messages and requires a visibly loaded activity to advance read state', async () => {
    const inquiry = await createInquiry('patient-unread')
    await updateClinicInquiryReadPosition(clinicReqA, { inquiryId: inquiry.id, mode: 'read' })
    await updateClinicInquiryReadPosition(clinicReqB, { inquiryId: inquiry.id, mode: 'read' })

    const first = await sendClinicInquiryMessage(clinicReqA, {
      expectedRevision: 0,
      idempotencyKey: `${slugPrefix}-clinic-reply-one`,
      inquiryId: inquiry.id,
      text: 'First synthetic clinic reply.',
    })
    const firstActivityId = first.inquiry.timeline.find(
      (activity) => activity.kind === 'external-message' && activity.text === 'First synthetic clinic reply.',
    )?.id
    if (!firstActivityId) throw new Error('Expected first clinic message activity')
    await sendClinicInquiryMessage(clinicReqA, {
      expectedRevision: 1,
      idempotencyKey: `${slugPrefix}-clinic-reply-two`,
      inquiryId: inquiry.id,
      text: 'Second synthetic clinic reply.',
    })

    expect((await readClinicInquiryDetail(clinicReqB, { inquiryId: inquiry.id })).inquiry.unread.isUnread).toBe(false)
    const patientDetail = await readPatientInquiryDetail(patientReq, { inquiryId: inquiry.id })
    expect(patientDetail.unread).toMatchObject({ count: 2, isUnread: true })

    await expect(
      updatePatientInquiryReadPosition(patientReq, { inquiryId: inquiry.id, mode: 'read' }),
    ).rejects.toMatchObject({ kind: 'invalid-input' } satisfies Partial<InquiryCommunicationServiceError>)
    const throughFirst = await updatePatientInquiryReadPosition(patientReq, {
      activityId: firstActivityId,
      inquiryId: inquiry.id,
      mode: 'read',
    })
    expect(throughFirst.inquiry.unread).toMatchObject({ count: 1, isUnread: true })
  })

  it('re-verifies a sealed attachment immediately before atomic message binding', async () => {
    const inquiry = await createInquiry('attachment-bind')
    const storage = storageGateway()
    const draft = await createAttachmentDraft(
      patientReq,
      {
        fileName: 'synthetic-document.pdf',
        inquiryId: inquiry.id,
        mimeType: 'application/pdf',
        sizeBytes: 128,
      },
      storage,
    )
    expect(draft.upload.headers).toEqual({ 'content-type': 'application/pdf' })
    const finalized = await finalizeAttachmentDraft(
      patientReq,
      { draftId: draft.draftId, inquiryId: inquiry.id },
      storage,
    )

    const verify = storage.verifySealed as ReturnType<typeof vi.fn>
    verify.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('The sealed attachment content changed.'))
    await expect(
      sendPatientInquiryMessage(
        patientReq,
        {
          attachmentDraftId: finalized.attachment.id,
          expectedRevision: 0,
          idempotencyKey: `${slugPrefix}-attachment-message`,
          inquiryId: inquiry.id,
        },
        storage,
      ),
    ).rejects.toMatchObject({ kind: 'invalid-state' } satisfies Partial<InquiryCommunicationServiceError>)

    expect(
      (
        await payload.find({
          collection: 'inquiryMessages' as never,
          depth: 0,
          overrideAccess: true,
          where: { inquiry: { equals: inquiry.id } },
        })
      ).docs,
    ).toHaveLength(0)
    expect(
      await payload.findByID({
        collection: 'inquiryAttachments' as never,
        depth: 0,
        id: finalized.attachment.id,
        overrideAccess: true,
      }),
    ).toMatchObject({ state: 'verified' })

    verify.mockReset().mockResolvedValue(undefined)
    const sent = await sendPatientInquiryMessage(
      patientReq,
      {
        attachmentDraftId: finalized.attachment.id,
        expectedRevision: 0,
        idempotencyKey: `${slugPrefix}-attachment-message`,
        inquiryId: inquiry.id,
      },
      storage,
    )
    expect(verify).toHaveBeenCalledTimes(2)
    expect(sent.inquiry.timeline.at(-1)).toMatchObject({
      attachment: { fileName: 'synthetic-document.pdf' },
      kind: 'external-message',
    })
    expect(
      await payload.findByID({
        collection: 'inquiryAttachments' as never,
        depth: 0,
        id: finalized.attachment.id,
        overrideAccess: true,
      }),
    ).toMatchObject({ state: 'bound' })
  })

  it('binds one attachment to exactly one message across parallel sends', async () => {
    const inquiry = await createInquiry('parallel-attachment-bind')
    const storage = storageGateway()
    const draft = await createAttachmentDraft(
      patientReq,
      {
        fileName: 'single-use.pdf',
        inquiryId: inquiry.id,
        mimeType: 'application/pdf',
        sizeBytes: 128,
      },
      storage,
    )
    const finalized = await finalizeAttachmentDraft(
      patientReq,
      { draftId: draft.draftId, inquiryId: inquiry.id },
      storage,
    )
    const competingReq = await createLocalReq({}, payload)
    competingReq.user = patientReq.user
    let releasePreflights: () => void = () => undefined
    const bothPreflights = new Promise<void>((resolve) => {
      releasePreflights = resolve
    })
    let verificationCalls = 0
    ;(storage.verifySealed as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      verificationCalls += 1
      if (verificationCalls === 2) releasePreflights()
      await bothPreflights
    })

    const results = await Promise.allSettled([
      sendPatientInquiryMessage(
        patientReq,
        {
          attachmentDraftId: finalized.attachment.id,
          expectedRevision: 0,
          idempotencyKey: `${slugPrefix}-parallel-attachment-a`,
          inquiryId: inquiry.id,
        },
        storage,
      ),
      sendPatientInquiryMessage(
        competingReq,
        {
          attachmentDraftId: finalized.attachment.id,
          expectedRevision: 0,
          idempotencyKey: `${slugPrefix}-parallel-attachment-b`,
          inquiryId: inquiry.id,
        },
        storage,
      ),
    ])
    expect(results.map(({ status }) => status).sort()).toEqual(['fulfilled', 'rejected'])
    const rejected = results.find((result) => result.status === 'rejected')
    expect(rejected).toMatchObject({
      reason: { current: { id: inquiry.id, revision: 1 }, kind: 'conflict' },
      status: 'rejected',
    })
    const messages = await payload.find({
      collection: 'inquiryMessages' as never,
      depth: 0,
      overrideAccess: true,
      where: { inquiry: { equals: inquiry.id } },
    })
    expect(messages.docs).toHaveLength(1)
    await expect(
      payload.findByID({
        collection: 'inquiryAttachments' as never,
        depth: 0,
        id: finalized.attachment.id,
        overrideAccess: true,
      }),
    ).resolves.toMatchObject({
      boundMessage: (messages.docs[0] as unknown as { id?: number | string } | undefined)?.id,
      state: 'bound',
    })
  })

  it('rejects a stale reply after close with the safe current projection and no implicit reopen', async () => {
    const inquiry = await createInquiry('close-race')
    await updateClinicInquiryState(clinicReqB, {
      action: 'close',
      expectedRevision: 0,
      inquiryId: inquiry.id,
      reason: 'Synthetic parallel close.',
    })

    try {
      await sendClinicInquiryMessage(clinicReqA, {
        expectedRevision: 0,
        idempotencyKey: `${slugPrefix}-reply-after-close`,
        inquiryId: inquiry.id,
        text: 'This stale reply must not be stored.',
      })
      throw new Error('Expected the stale reply to fail')
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(InquiryCommunicationServiceError)
      expect(error).toMatchObject({
        current: { lifecycle: 'closed', revision: 1 },
        kind: 'invalid-state',
      })
    }

    expect(
      (
        await payload.find({
          collection: 'inquiryMessages' as never,
          depth: 0,
          overrideAccess: true,
          where: { inquiry: { equals: inquiry.id } },
        })
      ).docs,
    ).toHaveLength(0)
    const closed = (await readClinicInquiryDetail(clinicReqA, { inquiryId: inquiry.id })).inquiry
    expect(closed).toMatchObject({
      actions: { canRevealContact: false },
      contact: { mode: 'collapsed' },
      lifecycle: 'closed',
    })
    expect(JSON.stringify(closed.contact)).not.toContain(`${slugPrefix}-patient@example.com`)
    expect(JSON.stringify(closed.contact)).not.toContain('+493000000001')
    const note = await addClinicInquiryNote(clinicReqA, {
      idempotencyKey: `${slugPrefix}-note-after-close`,
      inquiryId: inquiry.id,
      text: 'A clinic-only note remains valid after close.',
    })
    expect(note.inquiry).toMatchObject({ lifecycle: 'closed', revision: 1 })
    const patient = await readPatientInquiryDetail(patientReq, { inquiryId: inquiry.id })
    expect(patient).toMatchObject({ lifecycle: 'closed', revision: 1, timeline: [] })
  })

  it('keeps cursor ordering stable for equal patient-visible activity timestamps', async () => {
    const first = await createInquiry('cursor-one')
    const second = await createInquiry('cursor-two')
    const tiedAt = '2099-08-24T12:00:00.000Z'
    for (const inquiryId of [first.id, second.id]) {
      await payload.update({
        collection: 'patientClinicInquiries',
        context: { inquiryCommunicationCommand: true },
        data: { lastActivityAt: tiedAt, lastExternalActivityAt: tiedAt },
        depth: 0,
        id: inquiryId,
        overrideAccess: true,
      })
    }

    const pageOne = await readPatientInquiryQueue(patientReq, { limit: 1 })
    if (!pageOne.nextCursor) throw new Error('Expected a second patient queue page')
    const pageTwo = await readPatientInquiryQueue(patientReq, { cursor: pageOne.nextCursor, limit: 1 })
    expect(new Set([...pageOne.items, ...pageTwo.items].map(({ id }) => id))).toEqual(new Set([first.id, second.id]))
  })

  it('keeps both object keys recoverable when finalize persistence and ready cleanup fail', async () => {
    const inquiry = await createInquiry('finalize-recovery')
    const storage = storageGateway()
    const draft = await createAttachmentDraft(
      patientReq,
      {
        fileName: 'retryable.png',
        inquiryId: inquiry.id,
        mimeType: 'image/png',
        sizeBytes: 64,
      },
      storage,
    )
    const failedCleanup = storage.deleteObjects as ReturnType<typeof vi.fn>
    failedCleanup.mockRejectedValueOnce(new Error('Synthetic ready cleanup outage')).mockResolvedValue(undefined)
    const originalUpdate = payload.update.bind(payload)
    const updateImplementation = async (args: unknown) => {
      const record = args as unknown as { collection?: string; data?: { state?: string } }
      if (record.collection === 'inquiryAttachments' && record.data?.state === 'verified') {
        throw new Error('Synthetic persistence failure')
      }
      return originalUpdate(args as never)
    }
    const updateSpy = vi.spyOn(payload, 'update').mockImplementation(updateImplementation as never)
    try {
      await expect(
        finalizeAttachmentDraft(patientReq, { draftId: draft.draftId, inquiryId: inquiry.id }, storage),
      ).rejects.toThrow(/synthetic persistence failure/i)
    } finally {
      updateSpy.mockRestore()
    }

    const seal = storage.sealDraft as ReturnType<typeof vi.fn>
    const readyObjectKey = seal.mock.calls[0]?.[0]?.readyObjectKey as string
    expect(storage.deleteObjects).toHaveBeenCalledWith([readyObjectKey])
    const recoverableDraft = await payload.findByID({
      collection: 'inquiryAttachments' as never,
      depth: 0,
      id: draft.draftId,
      overrideAccess: true,
    })
    expect(recoverableDraft).toMatchObject({ readyObjectKey, state: 'draft' })

    const now = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 25 * 60 * 60 * 1_000)
    try {
      await expect(sweepExpiredAttachmentDrafts(patientReq, storage)).resolves.toEqual({ cleaned: 1, examined: 1 })
    } finally {
      clock.mockRestore()
    }
    expect(storage.deleteObjects).toHaveBeenCalledWith([expect.stringContaining('/draft/'), readyObjectKey])
    expect(
      await payload.findByID({
        collection: 'inquiryAttachments' as never,
        depth: 0,
        id: draft.draftId,
        overrideAccess: true,
      }),
    ).toMatchObject({ cleanupCompletedAt: expect.any(String), state: 'discarded' })
  })

  it('retries failed finalized-draft cleanup after binding without touching the ready object', async () => {
    const inquiry = await createInquiry('finalized-draft-cleanup')
    const storage = storageGateway()
    const deleteObjects = storage.deleteObjects as ReturnType<typeof vi.fn>
    deleteObjects.mockRejectedValueOnce(new Error('Synthetic draft cleanup outage')).mockResolvedValue(undefined)
    const draft = await createAttachmentDraft(
      patientReq,
      {
        fileName: 'bound-recovery.png',
        inquiryId: inquiry.id,
        mimeType: 'image/png',
        sizeBytes: 64,
      },
      storage,
    )
    const finalized = await finalizeAttachmentDraft(
      patientReq,
      { draftId: draft.draftId, inquiryId: inquiry.id },
      storage,
    )
    const beforeBinding = (await payload.findByID({
      collection: 'inquiryAttachments' as never,
      depth: 0,
      id: draft.draftId,
      overrideAccess: true,
    })) as unknown as {
      draftCleanupCompletedAt?: null | string
      draftObjectKey?: null | string
      readyObjectKey?: null | string
      state?: string
    }
    expect(beforeBinding).toMatchObject({ draftCleanupCompletedAt: null, state: 'verified' })
    const draftObjectKey = String(beforeBinding.draftObjectKey)
    const readyObjectKey = String(beforeBinding.readyObjectKey)

    await sendPatientInquiryMessage(
      patientReq,
      {
        attachmentDraftId: finalized.attachment.id,
        expectedRevision: 0,
        idempotencyKey: `${slugPrefix}-bound-recovery-message`,
        inquiryId: inquiry.id,
      },
      storage,
    )
    deleteObjects.mockClear()
    const now = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 25 * 60 * 60 * 1_000)
    try {
      await expect(sweepExpiredAttachmentDrafts(patientReq, storage)).resolves.toEqual({ cleaned: 1, examined: 1 })
    } finally {
      clock.mockRestore()
    }

    expect(deleteObjects).toHaveBeenCalledTimes(1)
    expect(deleteObjects).toHaveBeenCalledWith([draftObjectKey])
    expect(deleteObjects).not.toHaveBeenCalledWith(expect.arrayContaining([readyObjectKey]))
    await expect(
      payload.findByID({
        collection: 'inquiryAttachments' as never,
        depth: 0,
        id: draft.draftId,
        overrideAccess: true,
      }),
    ).resolves.toMatchObject({
      cleanupCompletedAt: null,
      draftCleanupCompletedAt: expect.any(String),
      readyObjectKey,
      state: 'bound',
    })
    await expect(
      readAttachmentAccess(patientReq, { attachmentId: draft.draftId, mode: 'preview' }, storage),
    ).resolves.toMatchObject({ method: 'GET' })
  })

  it('sweeps only unbound objects older than 24 hours and retries failed storage cleanup', async () => {
    const inquiry = await createInquiry('cleanup-sweep')
    const patientId = patientReq.user?.id as number
    const old = new Date(Date.now() - 25 * 60 * 60 * 1_000).toISOString()
    const recent = new Date(Date.now() - (24 * 60 - 1) * 60 * 1_000).toISOString()
    const createCandidate = async (
      suffix: string,
      state: 'discarded' | 'draft' | 'verified',
      objectCreatedAt: string,
    ) =>
      payload.create({
        collection: 'inquiryAttachments' as never,
        data: {
          actorKey: `patients:${String(patientId)}`,
          clinic: clinicId,
          declaredMimeType: 'image/png',
          declaredSizeBytes: 64,
          draftObjectKey: `synthetic/draft/${suffix}`,
          expiresAt: '2026-08-25T10:00:00.000Z',
          fileName: `${suffix}.png`,
          inquiry: Number(inquiry.id),
          objectCreatedAt,
          ownerKind: 'patient',
          ownerPatient: patientId,
          patient: patientId,
          ...(state === 'verified'
            ? {
                readyObjectKey: `synthetic/ready/${suffix}`,
                verifiedMimeType: 'image/png',
                verifiedSizeBytes: 64,
              }
            : {}),
          state,
        },
        depth: 0,
        overrideAccess: true,
      } as never)

    const oldDraft = await createCandidate('old-draft', 'draft', old)
    const oldVerified = await createCandidate('old-verified', 'verified', old)
    const oldDiscarded = await createCandidate('old-discarded', 'discarded', old)
    const recentDraft = await createCandidate('recent-draft', 'draft', recent)
    const boundCandidate = await createCandidate('old-bound', 'verified', old)
    await sendPatientInquiryMessage(
      patientReq,
      {
        attachmentDraftId: String(boundCandidate.id),
        expectedRevision: 0,
        idempotencyKey: `${slugPrefix}-old-bound-message`,
        inquiryId: inquiry.id,
      },
      storageGateway(),
    )
    const storage = storageGateway()

    await expect(sweepExpiredAttachmentDrafts(patientReq, storage)).resolves.toEqual({ cleaned: 4, examined: 4 })
    for (const id of [oldDraft.id, oldVerified.id, oldDiscarded.id]) {
      await expect(
        payload.findByID({ collection: 'inquiryAttachments' as never, depth: 0, id, overrideAccess: true }),
      ).resolves.toMatchObject({ cleanupCompletedAt: expect.any(String), state: 'discarded' })
    }
    await expect(
      payload.findByID({
        collection: 'inquiryAttachments' as never,
        depth: 0,
        id: recentDraft.id,
        overrideAccess: true,
      }),
    ).resolves.toMatchObject({ cleanupCompletedAt: null, state: 'draft' })
    await expect(
      payload.findByID({
        collection: 'inquiryAttachments' as never,
        depth: 0,
        id: boundCandidate.id,
        overrideAccess: true,
      }),
    ).resolves.toMatchObject({
      cleanupCompletedAt: null,
      draftCleanupCompletedAt: expect.any(String),
      state: 'bound',
    })
    expect(storage.deleteObjects).toHaveBeenCalledWith(['synthetic/draft/old-bound'])
    expect(storage.deleteObjects).not.toHaveBeenCalledWith(expect.arrayContaining(['synthetic/ready/old-bound']))
    await expect(sweepExpiredAttachmentDrafts(patientReq, storage)).resolves.toEqual({ cleaned: 0, examined: 0 })

    const retryCandidate = await createCandidate('retry-draft', 'draft', old)
    const retryStorage = storageGateway()
    ;(retryStorage.deleteObjects as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('Synthetic storage outage'))
      .mockResolvedValue(undefined)
    await expect(sweepExpiredAttachmentDrafts(patientReq, retryStorage)).resolves.toEqual({ cleaned: 0, examined: 1 })
    await expect(
      payload.findByID({
        collection: 'inquiryAttachments' as never,
        depth: 0,
        id: retryCandidate.id,
        overrideAccess: true,
      }),
    ).resolves.toMatchObject({ cleanupCompletedAt: null, state: 'discarded' })
    await expect(sweepExpiredAttachmentDrafts(patientReq, retryStorage)).resolves.toEqual({ cleaned: 1, examined: 1 })
  })

  it('keeps a guest inquiry without a conversation', async () => {
    const now = '2026-08-24T10:00:00.000Z'
    const inquiry = await payload.create({
      collection: 'patientClinicInquiries',
      context: { inquiryCommunicationCommand: true },
      data: {
        activitySequence: 1,
        clinic: clinicId,
        clinicNotificationSequence: 1,
        clinicUnreadEpoch: 0,
        clinicUnreadFloor: 0,
        consent: {
          accepted: true,
          acceptedAt: '2026-08-24T10:00:00.000Z',
          text: 'Synthetic consent.',
        },
        doctor: doctorId,
        email: `${slugPrefix}-guest@example.com`,
        fullName: 'Synthetic Guest',
        handlingStatus: 'submitted',
        lastActivityAt: now,
        lifecycle: 'open',
        message: 'Guest inquiry without account binding.',
        phoneNumber: '+493000000002',
        revision: 0,
        status: 'submitted',
        externalSequence: 0,
      } as never,
      depth: 0,
      overrideAccess: true,
    })
    createdInquiryIds.push(inquiry.id)

    const conversations = await payload.find({
      collection: 'inquiryConversations' as never,
      depth: 0,
      limit: 10,
      overrideAccess: true,
      where: { inquiry: { equals: inquiry.id } },
    })

    expect(conversations.docs).toHaveLength(0)
  })
})

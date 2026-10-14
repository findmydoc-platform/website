import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import {
  createVerifiedPatientInquiry,
  sendPatientInquiryMessage,
  sendClinicInquiryMessage,
  addClinicInquiryNote,
  createAttachmentDraft,
  finalizeAttachmentDraft,
  submitGuestClinicInquiry,
} from '@/features/inquiryCommunication/service'
import {
  activateClinicNotificationsForTest,
  readClinicNotifications,
  markClinicNotificationsRead,
} from '@/features/clinicNotifications/service'
import type { InquiryAttachmentStorageGateway } from '@/features/inquiryCommunication/storage'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import {
  asClinicScopedPayloadUser,
  asPayloadPatientUser,
  createClinicTestUser,
  createPatientTestUser,
} from '../fixtures/testUsers'
import { testSlug } from '../fixtures/testSlug'
vi.mock('@payloadcms/storage-s3', () => ({ s3Storage: () => (incomingConfig: unknown) => incomingConfig }))
describe('complete personal patient message notifications', () => {
  let payload: Payload
  let clinicId: number
  let doctorId: number
  let patientReq: PayloadRequest
  let staffReq: PayloadRequest
  let otherReq: PayloadRequest
  let counter = 0
  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const cities = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const fixture = await createClinicFixture(payload, cities.docs[0]!.id, {
      slugPrefix: testSlug('clinicNotifications.patientMessages.test.ts'),
    })
    clinicId = fixture.clinic.id
    doctorId = fixture.doctor.id
    const patient = await createPatientTestUser(payload, {
      emailPrefix: 'notification-message-patient',
      firstName: 'Synthetic',
      lastName: 'Patient',
    })
    patientReq = await createLocalReq({}, payload)
    patientReq.user = asPayloadPatientUser(patient)
    const staff = await createClinicTestUser(payload, { emailPrefix: 'notification-message-staff' })
    staffReq = await createLocalReq({}, payload)
    staffReq.user = await asClinicScopedPayloadUser(payload, staff, clinicId)
    const other = await createClinicTestUser(payload, { emailPrefix: 'notification-message-other' })
    otherReq = await createLocalReq({}, payload)
    otherReq.user = await asClinicScopedPayloadUser(payload, other, clinicId)
    await activateClinicNotificationsForTest(patientReq)
  }, 60000)
  afterAll(async () => {
    await payload?.db.destroy?.()
  })
  const create = async () =>
    createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicId),
      doctorId: String(doctorId),
      consent: true,
      message: 'Private initial inquiry text',
      phoneNumber: '+493000003203',
      treatmentTimeline: 'within_two_weeks',
      idempotencyKey: `message-inquiry-${++counter}`,
    })
  const send = async (inquiryId: string, expectedRevision: number, key: string) =>
    sendPatientInquiryMessage(patientReq, {
      inquiryId,
      expectedRevision,
      idempotencyKey: key,
      text: 'Private message body',
    })
  const page = async (req = staffReq, view: 'unread' | 'all' = 'unread') => {
    const response = await readClinicNotifications(req, { mode: 'page', view })
    if (response.mode !== 'page') throw new Error('Expected notification page')
    return response
  }
  it('captures persisted patient messages once and groups their complete personal membership', async () => {
    const created = await create()
    const first = await send(created.inquiry.id, created.inquiry.revision, 'patient-message-first')
    const second = await send(created.inquiry.id, first.inquiry.revision, 'patient-message-second')
    await send(created.inquiry.id, first.inquiry.revision, 'patient-message-second')
    const feed = await page()
    const group = feed.items.find(
      (item) =>
        item.kind === 'patient_message_group' &&
        item.destination.kind === 'inquiry' &&
        item.destination.inquiryId === created.inquiry.id,
    )
    expect(group?.members).toHaveLength(2)
    expect(group?.display.eventLabel).toBe('2 new messages')
    const messages = (
      await payload.find({
        collection: 'inquiryMessages',
        where: { inquiry: { equals: created.inquiry.id } },
        sort: ['createdAt', 'id'],
        overrideAccess: true,
      })
    ).docs
    expect(group?.members.map((member) => member.sourceOccurrence.id)).toEqual(
      messages.map((message) => String(message.id)),
    )
    expect(group?.members.map((member) => member.occurredAt)).toEqual(messages.map((message) => message.createdAt))
    expect(group?.destination).toEqual({
      kind: 'inquiry',
      inquiryId: created.inquiry.id,
      anchor: { kind: 'message', id: `message:${messages[0]!.id}` },
    })
    expect(feed).toMatchObject({ unreadCount: 2 })
    expect(JSON.stringify(feed)).not.toContain('Private message body')
    expect(JSON.stringify(feed)).not.toContain('Private initial inquiry text')
    expect(second.inquiry.revision).toBeGreaterThan(first.inquiry.revision)
  })
  it('marks the fixed complete group atomically while a later arrival and another reader stay unread', async () => {
    const created = await create()
    const first = await send(created.inquiry.id, created.inquiry.revision, 'fixed-group-first')
    const second = await send(created.inquiry.id, first.inquiry.revision, 'fixed-group-second')
    const fixed = (await page()).items.find(
      (item) =>
        item.destination.kind === 'inquiry' &&
        item.destination.inquiryId === created.inquiry.id &&
        item.kind === 'patient_message_group',
    )!
    await send(created.inquiry.id, second.inquiry.revision, 'fixed-group-later')
    const before = (await page()).items.find((item) => item.presentationId === fixed.presentationId)!
    expect(before.members).toHaveLength(3)
    await markClinicNotificationsRead(staffReq, {
      notificationIds: fixed.members.map((member) => member.notificationId),
    })
    const unread = (await page()).items.find((item) => item.presentationId === fixed.presentationId)!
    expect(unread.members).toHaveLength(1)
    expect(unread.members[0]!.notificationId).not.toEqual(fixed.members[0]!.notificationId)
    const all = (await page(staffReq, 'all')).items.filter(
      (item) => item.destination.kind === 'inquiry' && item.destination.inquiryId === created.inquiry.id,
    )
    expect(all.filter((item) => item.kind === 'patient_message_group')).toHaveLength(1)
    expect(
      all.filter((item) => item.kind === 'occurrence' && item.members[0]!.eventType === 'patient_message_received'),
    ).toHaveLength(2)
    expect(
      (await page(otherReq)).items.find((item) => item.presentationId === fixed.presentationId)!.members,
    ).toHaveLength(3)
    const receipts = (
      await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true, limit: 100 })
    ).docs
    await markClinicNotificationsRead(staffReq, {
      notificationIds: fixed.members.map((member) => member.notificationId),
    })
    expect(
      (await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true, limit: 100 })).docs,
    ).toEqual(receipts)
  })
  it('rolls back the source message and inquiry revision when notification capture fails', async () => {
    const created = await create()
    const before = await payload.findByID({
      collection: 'patientClinicInquiries',
      id: created.inquiry.id,
      overrideAccess: true,
    })
    const hooks = payload.collections.clinicNotificationOccurrences.config.hooks
    const previous = hooks.beforeChange
    hooks.beforeChange = [
      ...(previous ?? []),
      () => {
        throw new Error('Synthetic occurrence rejection')
      },
    ]
    try {
      await expect(send(created.inquiry.id, created.inquiry.revision, 'failed-source-message')).rejects.toThrow()
    } finally {
      hooks.beforeChange = previous
    }
    expect(
      await payload.findByID({ collection: 'patientClinicInquiries', id: created.inquiry.id, overrideAccess: true }),
    ).toEqual(before)
    expect(
      (
        await payload.find({
          collection: 'inquiryMessages',
          where: { inquiry: { equals: created.inquiry.id } },
          overrideAccess: true,
        })
      ).totalDocs,
    ).toBe(0)
    await send(created.inquiry.id, created.inquiry.revision, 'failed-source-message')
    expect(
      (await page()).items.find(
        (item) =>
          item.kind === 'patient_message_group' &&
          item.destination.kind === 'inquiry' &&
          item.destination.inquiryId === created.inquiry.id,
      )?.members,
    ).toHaveLength(1)
  })
  it('keeps the complete represented group unread when one prepared personal receipt fails', async () => {
    const created = await create()
    const first = await send(created.inquiry.id, created.inquiry.revision, 'rollback-group-first')
    await send(created.inquiry.id, first.inquiry.revision, 'rollback-group-second')
    const fixed = (await page()).items.find(
      (item) =>
        item.kind === 'patient_message_group' &&
        item.destination.kind === 'inquiry' &&
        item.destination.inquiryId === created.inquiry.id,
    )!
    const hooks = payload.collections.clinicNotificationReadReceipts.config.hooks
    const previous = hooks.afterChange
    let writes = 0
    hooks.afterChange = [
      ...(previous ?? []),
      ({ doc }) => {
        if (++writes === 2) throw new Error('Synthetic second receipt failure')
        return doc
      },
    ]
    try {
      await expect(
        markClinicNotificationsRead(staffReq, {
          notificationIds: fixed.members.map((member) => member.notificationId),
        }),
      ).rejects.toMatchObject({ writeOutcome: 'not_committed' })
    } finally {
      hooks.afterChange = previous
    }
    expect((await page()).items.find((item) => item.presentationId === fixed.presentationId)).toEqual(fixed)
  })

  it('captures attachment-only sends but excludes initial texts, clinic messages, notes and standalone uploads', async () => {
    const created = await create()
    const storage: InquiryAttachmentStorageGateway = {
      createReadAccess: vi.fn(async () => ({
        expiresAt: '2030-01-01T00:00:00.000Z',
        method: 'GET' as const,
        url: 'https://storage.invalid/read',
      })),
      createUpload: vi.fn(async ({ mimeType }) => ({
        headers: { 'content-type': mimeType },
        method: 'PUT' as const,
        url: 'https://storage.invalid/upload',
      })),
      deleteObjects: vi.fn(async () => undefined),
      sealDraft: vi.fn(async ({ declaredMimeType, declaredSizeBytes, readyObjectKey }) => ({
        mimeType: declaredMimeType,
        readyObjectKey,
        sizeBytes: declaredSizeBytes,
      })),
      verifySealed: vi.fn(async () => undefined),
    }
    const draft = await createAttachmentDraft(
      patientReq,
      { inquiryId: created.inquiry.id, fileName: 'private-document.pdf', mimeType: 'application/pdf', sizeBytes: 128 },
      storage,
    )
    const finalized = await finalizeAttachmentDraft(
      patientReq,
      { inquiryId: created.inquiry.id, draftId: draft.draftId },
      storage,
    )
    expect(
      (await page()).items.filter(
        (item) => item.destination.kind === 'inquiry' && item.destination.inquiryId === created.inquiry.id,
      ),
    ).toHaveLength(1)
    const sent = await sendPatientInquiryMessage(
      patientReq,
      {
        inquiryId: created.inquiry.id,
        expectedRevision: created.inquiry.revision,
        attachmentDraftId: finalized.attachment.id,
        idempotencyKey: 'attachment-only-notification',
      },
      storage,
    )
    await sendClinicInquiryMessage(staffReq, {
      inquiryId: created.inquiry.id,
      expectedRevision: sent.inquiry.revision,
      text: 'Private clinic reply',
      idempotencyKey: 'clinic-excluded-notification',
    })
    await addClinicInquiryNote(staffReq, {
      inquiryId: created.inquiry.id,
      text: 'Private internal note',
      idempotencyKey: 'note-excluded-notification',
    })
    const entries = (await page()).items.filter(
      (item) => item.destination.kind === 'inquiry' && item.destination.inquiryId === created.inquiry.id,
    )
    expect(entries).toHaveLength(2)
    expect(entries.find((item) => item.kind === 'patient_message_group')!.members).toHaveLength(1)
    expect(JSON.stringify(entries)).not.toContain('private-document.pdf')
    const guestReq = await createLocalReq({}, payload)
    const guest = await submitGuestClinicInquiry(guestReq, {
      clinicId,
      doctorId,
      consent: true,
      fullName: 'Synthetic Guest',
      email: 'guest-message-exclusion@example.com',
      phoneNumber: '+493000003204',
      message: 'Private guest initial text',
    })
    expect(
      (await page()).items
        .filter((item) => item.destination.kind === 'inquiry' && item.destination.inquiryId === guest.id)
        .map((item) => item.members[0]!.eventType),
    ).toEqual(['inquiry_created'])
  })
  it('expires individual members before grouping and changes the bell only when the last unread member expires', async () => {
    try {
      vi.setSystemTime(new Date('2030-01-01T10:00:00.000Z'))
      const created = await create()
      const first = await send(created.inquiry.id, created.inquiry.revision, 'expiry-group-first')
      vi.setSystemTime(new Date('2030-01-01T10:05:00.000Z'))
      await send(created.inquiry.id, first.inquiry.revision, 'expiry-group-second')
      const feed = await page()
      const group = feed.items.find((item) => item.kind === 'patient_message_group')!
      const createdOccurrence = feed.items.find((item) => item.members[0]!.eventType === 'inquiry_created')!
      await markClinicNotificationsRead(staffReq, {
        notificationIds: createdOccurrence.members.map((member) => member.notificationId),
      })
      expect(await readClinicNotifications(staffReq, { mode: 'summary' })).toMatchObject({
        unreadCount: 1,
        nextUnreadCountChangeAt: group.members[1]!.expiresAt,
      })
      vi.setSystemTime(new Date(group.members[0]!.expiresAt))
      expect(
        (await page()).items
          .find((item) => item.presentationId === group.presentationId)!
          .members.map((member) => member.notificationId),
      ).toEqual([group.members[1]!.notificationId])
      expect(await readClinicNotifications(staffReq, { mode: 'summary' })).toMatchObject({
        unreadCount: 1,
        nextUnreadCountChangeAt: group.members[1]!.expiresAt,
      })
      await markClinicNotificationsRead(staffReq, { notificationIds: [group.members[0]!.notificationId] })
      expect((await page()).items.find((item) => item.presentationId === group.presentationId)!.members).toHaveLength(1)
      vi.setSystemTime(new Date(group.members[1]!.expiresAt))
      expect(await readClinicNotifications(staffReq, { mode: 'summary' })).toMatchObject({
        unreadCount: 0,
        nextUnreadCountChangeAt: null,
      })
      expect((await page(staffReq, 'all')).items).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it('recovers an uncertain committed source response by actor-bound replay without changing identity or timestamps', async () => {
    const created = await create()
    const originalCommit = payload.db.commitTransaction.bind(payload.db)
    const commit = vi.spyOn(payload.db, 'commitTransaction').mockImplementationOnce(async (transactionId) => {
      await originalCommit(transactionId)
      throw new Error('Synthetic lost commit confirmation')
    })
    try {
      await expect(send(created.inquiry.id, created.inquiry.revision, 'uncertain-source-message')).rejects.toThrow()
    } finally {
      commit.mockRestore()
    }
    const before = (await page()).items.find(
      (item) =>
        item.kind === 'patient_message_group' &&
        item.destination.kind === 'inquiry' &&
        item.destination.inquiryId === created.inquiry.id,
    )!
    expect(before.members).toHaveLength(1)
    expect((await send(created.inquiry.id, created.inquiry.revision, 'uncertain-source-message')).replayed).toBe(true)
    expect((await page()).items.find((item) => item.presentationId === before.presentationId)).toEqual(before)
  })
  it('serializes concurrent same-message replays and retains one authoritative occurrence', async () => {
    const created = await create()
    const competing = await createLocalReq({}, payload)
    competing.user = patientReq.user
    const input = {
      inquiryId: created.inquiry.id,
      expectedRevision: created.inquiry.revision,
      idempotencyKey: 'concurrent-identical-patient-message',
      text: 'Private concurrent patient message',
    }
    const outcomes = await Promise.allSettled([
      sendPatientInquiryMessage(patientReq, input),
      sendPatientInquiryMessage(competing, input),
    ])
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).not.toHaveLength(0)
    const group = (await page()).items.find(
      (item) =>
        item.kind === 'patient_message_group' &&
        item.destination.kind === 'inquiry' &&
        item.destination.inquiryId === created.inquiry.id,
    )!
    expect(group.members).toHaveLength(1)
    expect(
      (
        await payload.find({
          collection: 'inquiryMessages',
          where: { inquiry: { equals: created.inquiry.id } },
          overrideAccess: true,
        })
      ).totalDocs,
    ).toBe(1)
    const fixed = structuredClone(group)
    await sendPatientInquiryMessage(competing, input)
    expect((await page()).items.find((item) => item.presentationId === group.presentationId)).toEqual(fixed)
  })

  it('reauthorizes personal groups after staff offboarding without modifying another reader or stored receipts', async () => {
    const created = await create()
    await send(created.inquiry.id, created.inquiry.revision, 'offboard-patient-group')
    const group = (await page(otherReq)).items.find(
      (item) =>
        item.kind === 'patient_message_group' &&
        item.destination.kind === 'inquiry' &&
        item.destination.inquiryId === created.inquiry.id,
    )!
    const receipts = (
      await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true, limit: 100 })
    ).docs
    await payload.update({
      collection: 'clinicStaff',
      id: otherReq.user!.id,
      context: { skipClinicStaffAuthSync: true },
      data: { status: 'offboarded' },
      overrideAccess: true,
    })
    await expect(readClinicNotifications(otherReq, { mode: 'summary' })).rejects.toMatchObject({
      code: 'CLINIC_ACCESS_DENIED',
    })
    await expect(page(otherReq)).rejects.toMatchObject({ code: 'CLINIC_ACCESS_DENIED' })
    await expect(
      markClinicNotificationsRead(otherReq, { notificationIds: group.members.map((member) => member.notificationId) }),
    ).rejects.toMatchObject({ code: 'CLINIC_ACCESS_DENIED', writeOutcome: 'not_committed' })
    expect(
      (await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true, limit: 100 })).docs,
    ).toEqual(receipts)
    expect((await page()).items.find((item) => item.presentationId === group.presentationId)!.members).toHaveLength(1)
  })
  it('keeps an older patient group complete and accepts its move before a live continuation cursor', async () => {
    const created = await create()
    const first = await send(created.inquiry.id, created.inquiry.revision, 'pagination-group-first')
    const second = await send(created.inquiry.id, first.inquiry.revision, 'pagination-group-second')
    const groupId = (await page()).items.find(
      (item) =>
        item.kind === 'patient_message_group' &&
        item.destination.kind === 'inquiry' &&
        item.destination.inquiryId === created.inquiry.id,
    )?.presentationId
    expect(groupId).toEqual(expect.any(String))
    const guestReq = await createLocalReq({}, payload)
    for (let index = 0; index < 26; index++)
      await submitGuestClinicInquiry(guestReq, {
        clinicId,
        doctorId,
        consent: true,
        fullName: `Pagination Guest ${index}`,
        email: `pagination-group-guest-${index}@example.com`,
        phoneNumber: '+493000003204',
        message: 'Private pagination boundary input',
      })
    const firstPage = await page()
    expect(firstPage.nextCursor).toEqual(expect.any(String))
    expect(firstPage.items.some((item) => item.presentationId === groupId)).toBe(false)
    const afterCursor = async () => {
      const items: typeof firstPage.items = []
      let cursor = firstPage.nextCursor
      let pageCount = 0
      while (cursor) {
        const continuation = await readClinicNotifications(staffReq, { mode: 'page', view: 'unread', cursor })
        if (continuation.mode !== 'page') throw new Error('Expected continuation page')
        items.push(...continuation.items)
        cursor = continuation.nextCursor
        expect(++pageCount).toBeLessThan(20)
      }
      return items
    }
    const older = await afterCursor()
    const olderGroup = older.find((item) => item.presentationId === groupId)
    expect(olderGroup?.kind).toBe('patient_message_group')
    expect(olderGroup?.members).toHaveLength(2)
    expect(older.some((item) => item.presentationId === groupId && item.members.length === 1)).toBe(false)
    await send(created.inquiry.id, second.inquiry.revision, 'pagination-group-newest')
    expect((await afterCursor()).some((item) => item.presentationId === groupId)).toBe(false)
    expect((await page()).items.find((item) => item.presentationId === groupId)?.members).toHaveLength(3)
  }, 120000)
  it('retains complete membership beyond one hundred stored rows and fails an oversized group without truncating it', async () => {
    const created = await create()
    await send(created.inquiry.id, created.inquiry.revision, 'large-group-real-source')
    const original = (
      await payload.find({
        collection: 'clinicNotificationOccurrences',
        overrideAccess: true,
        depth: 0,
        where: {
          and: [
            { sourceRecordId: { equals: created.inquiry.id } },
            { eventType: { equals: 'patient_message_received' } },
          ],
        },
      })
    ).docs[0]!
    const transactionId = await payload.db.beginTransaction({ isolationLevel: 'serializable' })
    const req = await createLocalReq(
      { context: { clinicNotificationCommand: true }, req: { transactionID: Promise.resolve(transactionId!) } },
      payload,
    )
    try {
      for (let index = 0; index < 110; index++)
        await payload.create({
          collection: 'clinicNotificationOccurrences',
          overrideAccess: true,
          depth: 0,
          req,
          data: {
            clinic: clinicId,
            clinicScopeId: String(clinicId),
            schemaVersion: 1,
            eventType: 'patient_message_received',
            sourceRecordKind: 'inquiry',
            sourceRecordId: created.inquiry.id,
            sourceOccurrenceKind: 'patient_message',
            sourceOccurrenceId: `synthetic-boundary-${index}`,
            notificationId: `synthetic-membership-${index}`,
            occurredAt: original.occurredAt,
            expiresAt: original.expiresAt,
          },
        })
      await payload.db.commitTransaction(transactionId!)
    } catch (error) {
      await payload.db.rollbackTransaction(transactionId!)
      throw error
    }
    expect(
      (await page()).items.find(
        (item) =>
          item.destination.kind === 'inquiry' &&
          item.destination.inquiryId === created.inquiry.id &&
          item.kind === 'patient_message_group',
      )!.members,
    ).toHaveLength(111)
    const hooks = payload.collections.clinicNotificationOccurrences.config.hooks
    const previous = hooks.afterRead
    let arrived = false
    hooks.afterRead = [
      ...(previous ?? []),
      async ({ doc, req }) => {
        if (
          !arrived &&
          req.user?.id === staffReq.user!.id &&
          doc.sourceRecordId === created.inquiry.id &&
          doc.eventType === 'patient_message_received'
        ) {
          arrived = true
          const detail = await send(created.inquiry.id, 1, 'arrives-during-complete-group-read')
          expect(detail.replayed).toBe(false)
        }
        return doc
      },
    ]
    try {
      const refreshed = await page()
      const group = refreshed.items.find(
        (item) =>
          item.kind === 'patient_message_group' &&
          item.destination.kind === 'inquiry' &&
          item.destination.inquiryId === created.inquiry.id,
      )!
      expect(arrived).toBe(true)
      expect(group.members).toHaveLength(111)
      expect(new Set(group.members.map((member) => member.notificationId)).size).toBe(111)
      expect((await page()).items.find((item) => item.presentationId === group.presentationId)!.members).toHaveLength(
        112,
      )
      await markClinicNotificationsRead(staffReq, {
        notificationIds: group.members.map((member) => member.notificationId),
      })
      const remaining = (await page()).items.find((item) => item.presentationId === group.presentationId)!
      expect(remaining.members).toHaveLength(1)
      expect(group.members.map((member) => member.notificationId)).not.toContain(remaining.members[0]!.notificationId)
      expect(
        (
          await payload.find({
            collection: 'clinicNotificationReadReceipts',
            where: { clinicStaff: { equals: staffReq.user!.id } },
            overrideAccess: true,
            limit: 1,
          })
        ).totalDocs,
      ).toBeGreaterThan(100)
    } finally {
      hooks.afterRead = previous
    }
    const summaryBefore = await readClinicNotifications(staffReq, { mode: 'summary' })
    if (summaryBefore.mode !== 'summary') throw new Error('Expected complete summary')
    const oversizedId = await payload.db.beginTransaction({ isolationLevel: 'serializable' })
    const oversizedReq = await createLocalReq(
      { context: { clinicNotificationCommand: true }, req: { transactionID: Promise.resolve(oversizedId!) } },
      payload,
    )
    try {
      for (let index = 0; index < 800; index++)
        await payload.create({
          collection: 'clinicNotificationOccurrences',
          overrideAccess: true,
          depth: 0,
          req: oversizedReq,
          data: {
            clinic: clinicId,
            clinicScopeId: String(clinicId),
            schemaVersion: 1,
            eventType: 'patient_message_received',
            sourceRecordKind: 'inquiry',
            sourceRecordId: created.inquiry.id,
            sourceOccurrenceKind: 'patient_message',
            sourceOccurrenceId: `boundary-source-${index}`.padEnd(200, 's'),
            notificationId: `boundary-notification-${index}`.padEnd(200, 'n'),
            occurredAt: original.occurredAt,
            expiresAt: original.expiresAt,
          },
        })
      await payload.db.commitTransaction(oversizedId!)
    } catch (error) {
      await payload.db.rollbackTransaction(oversizedId!)
      throw error
    }
    expect(await readClinicNotifications(staffReq, { mode: 'summary' })).toMatchObject({
      unreadCount: summaryBefore.unreadCount,
      nextUnreadCountChangeAt: summaryBefore.nextUnreadCountChangeAt,
    })
    for (const view of ['unread', 'all'] as const)
      await expect(readClinicNotifications(staffReq, { mode: 'page', view })).rejects.toMatchObject({
        code: 'PAYLOAD_TOO_LARGE',
      })
    const guestReq = await createLocalReq({}, payload)
    for (let index = 0; index < 26; index++)
      await submitGuestClinicInquiry(guestReq, {
        clinicId,
        doctorId,
        consent: true,
        fullName: `Oversized Group Boundary ${index}`,
        email: `oversized-group-boundary-${index}@example.com`,
        phoneNumber: '+493000003204',
        message: 'Private pagination boundary input',
      })
    for (const view of ['unread', 'all'] as const) {
      const initial = await readClinicNotifications(staffReq, { mode: 'page', view })
      if (initial.mode !== 'page') throw new Error('Expected first page before oversized group')
      expect(initial.nextCursor).toEqual(expect.any(String))
      expect(Buffer.byteLength(JSON.stringify(initial))).toBeLessThanOrEqual(524288)
      let cursor = initial.nextCursor
      let oversizedReached = false
      for (let pageCount = 0; cursor && pageCount < 20; pageCount++) {
        try {
          const continuation = await readClinicNotifications(staffReq, { mode: 'page', view, cursor })
          if (continuation.mode !== 'page') throw new Error('Expected continuation page')
          expect(Buffer.byteLength(JSON.stringify(continuation))).toBeLessThanOrEqual(524288)
          cursor = continuation.nextCursor
        } catch (error) {
          expect(error).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' })
          oversizedReached = true
          break
        }
      }
      expect(oversizedReached).toBe(true)
    }
  }, 120000)
})

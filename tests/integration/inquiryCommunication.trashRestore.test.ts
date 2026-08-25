import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'

import config from '@payload-config'
import {
  addClinicInquiryNote,
  createVerifiedPatientInquiry,
  readClinicInquiryDetail,
  sendClinicInquiryMessage,
} from '@/features/inquiryCommunication/service'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import {
  asClinicScopedPayloadUser,
  asPayloadPatientUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPatientTestUser,
} from '../fixtures/testUsers'

type TrashCollection = 'inquiryConversations' | 'inquiryInternalNotes' | 'inquiryMessages'

describe('inquiry communication native trash and restore', () => {
  let payload: Payload
  let clinicId: number
  let clinicReq: PayloadRequest
  let inquiryId: string
  let conversationId: number | string
  let messageId: number | string
  let noteId: number | string
  const createdInquiryIds: Array<number | string> = []
  const createdPatientIds: Array<number | string> = []
  const createdStaffIds: Array<number | string> = []
  const slugPrefix = testSlug('inquiryCommunication.trashRestore.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const city = (await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })).docs[0]
    if (!city) throw new Error('Expected a baseline city for the trash and restore test.')

    const fixture = await createClinicFixture(payload, city.id, { slugPrefix })
    clinicId = fixture.clinic.id
    await payload.update({
      collection: 'clinics',
      data: { status: 'approved' },
      depth: 0,
      id: clinicId,
      overrideAccess: true,
    })

    const patient = await createPatientTestUser(payload, {
      createdPatientIds,
      emailPrefix: `${slugPrefix}-patient`,
      firstName: 'Trash',
      lastName: 'Patient',
    })
    const patientReq = await createLocalReq({}, payload)
    patientReq.user = asPayloadPatientUser(patient)

    const clinicStaff = await createClinicTestUser(payload, {
      createdStaffIds,
      emailPrefix: `${slugPrefix}-staff`,
      firstName: 'Trash',
      lastName: 'Clinician',
    })
    clinicReq = await createLocalReq({}, payload)
    clinicReq.user = await asClinicScopedPayloadUser(payload, clinicStaff, clinicId)

    const created = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(fixture.doctor.id),
      idempotencyKey: `${slugPrefix}-create`,
      message: 'Synthetic inquiry for native trash and restore evidence.',
      phoneNumber: '+493000000033',
      treatmentTimeline: 'within_two_weeks',
    })
    inquiryId = created.inquiry.id
    createdInquiryIds.push(inquiryId)

    await sendClinicInquiryMessage(clinicReq, {
      expectedRevision: created.inquiry.revision,
      idempotencyKey: `${slugPrefix}-message`,
      inquiryId,
      text: 'Synthetic message restored through native Payload trash.',
    })
    await addClinicInquiryNote(clinicReq, {
      idempotencyKey: `${slugPrefix}-note`,
      inquiryId,
      text: 'Synthetic note restored through native Payload trash.',
    })

    const [conversations, messages, notes] = await Promise.all([
      payload.find({
        collection: 'inquiryConversations' as never,
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: { inquiry: { equals: inquiryId } },
      }),
      payload.find({
        collection: 'inquiryMessages' as never,
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: { inquiry: { equals: inquiryId } },
      }),
      payload.find({
        collection: 'inquiryInternalNotes' as never,
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: { inquiry: { equals: inquiryId } },
      }),
    ])
    const conversation = conversations.docs[0] as { id?: number | string } | undefined
    const message = messages.docs[0] as { id?: number | string } | undefined
    const note = notes.docs[0] as { id?: number | string } | undefined
    if (!conversation?.id || !message?.id || !note?.id) {
      throw new Error('Expected the complete synthetic conversation before testing trash behavior.')
    }
    conversationId = conversation.id
    messageId = message.id
    noteId = note.id
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
        trash: true,
        where: { inquiry: { in: createdInquiryIds } },
      })
    }
    for (const id of createdInquiryIds) {
      await payload.delete({ collection: 'patientClinicInquiries', id, overrideAccess: true, trash: true })
    }
    await cleanupTrackedUsers(payload, { patientIds: createdPatientIds, staffIds: createdStaffIds })
    await payload.delete({
      collection: 'doctors',
      overrideAccess: true,
      trash: true,
      where: { clinic: { equals: clinicId } },
    })
    await payload.delete({ collection: 'clinics', id: clinicId, overrideAccess: true, trash: true })
  })

  it('hides trashed domain records and restores the same records to normal reads', async () => {
    const records: Array<{ collection: TrashCollection; id: number | string }> = [
      { collection: 'inquiryMessages', id: messageId },
      { collection: 'inquiryInternalNotes', id: noteId },
      { collection: 'inquiryConversations', id: conversationId },
    ]
    const beforeTrash = await readClinicInquiryDetail(clinicReq, { inquiryId })
    expect(beforeTrash.inquiry.binding).toMatchObject({
      conversationId: String(conversationId),
      kind: 'patient',
    })
    expect(beforeTrash.inquiry.timeline.map((item) => item.id)).toEqual(
      expect.arrayContaining([`message:${String(messageId)}`, `note:${String(noteId)}`]),
    )

    const trashedAt = new Date().toISOString()
    for (const record of records) {
      await payload.update({
        collection: record.collection as never,
        data: { deletedAt: trashedAt },
        depth: 0,
        id: record.id,
        overrideAccess: true,
      } as never)
    }

    const whileTrashed = await readClinicInquiryDetail(clinicReq, { inquiryId })
    expect(whileTrashed.inquiry.binding).toEqual({ canReply: false, kind: 'guest' })
    expect(whileTrashed.inquiry.timeline.map((item) => item.id)).not.toContain(`message:${String(messageId)}`)
    expect(whileTrashed.inquiry.timeline.map((item) => item.id)).not.toContain(`note:${String(noteId)}`)

    for (const record of records) {
      const normal = await payload.find({
        collection: record.collection as never,
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: { id: { equals: record.id } },
      })
      expect(normal.docs).toHaveLength(0)
      const trashed = (await payload.findByID({
        collection: record.collection as never,
        depth: 0,
        id: record.id,
        overrideAccess: true,
        trash: true,
      } as never)) as unknown as { deletedAt?: null | string; id: number | string }
      expect(trashed).toMatchObject({ id: record.id })
      expect(trashed.deletedAt).toEqual(expect.any(String))
    }

    for (const record of [...records].reverse()) {
      const restored = (await payload.update({
        collection: record.collection as never,
        data: { deletedAt: null },
        depth: 0,
        id: record.id,
        overrideAccess: true,
        trash: true,
      } as never)) as unknown as { deletedAt?: null | string; id: number | string }
      expect(restored).toMatchObject({ deletedAt: null, id: record.id })
    }

    const restoredDetail = await readClinicInquiryDetail(clinicReq, { inquiryId })
    expect(restoredDetail.inquiry.binding).toMatchObject({
      conversationId: String(conversationId),
      kind: 'patient',
    })
    expect(restoredDetail.inquiry.timeline.map((item) => item.id)).toEqual(
      expect.arrayContaining([`message:${String(messageId)}`, `note:${String(noteId)}`]),
    )
  })
})

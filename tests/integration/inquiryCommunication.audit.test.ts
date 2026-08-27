import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'

import config from '@payload-config'
import {
  addClinicInquiryNote,
  createVerifiedPatientInquiry,
  sendClinicInquiryMessage,
  updateClinicInquiryState,
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

type StoredAuditEvent = {
  actorId: string
  actorKind: string
  clinicNotificationSequence: number
  eventType: string
  fromValue?: null | string
  id: number | string
  reason?: null | string
  sequence: number
  targetId?: null | string
  targetType?: null | string
  toValue?: null | string
}

describe('inquiry communication audit persistence', () => {
  let payload: Payload
  let clinicId: number
  let patientReq: PayloadRequest
  let clinicReq: PayloadRequest
  let patientId: number | string
  let clinicStaffId: number | string
  let inquiryId: string
  let messageId: string
  let noteId: string
  const createdInquiryIds: Array<number | string> = []
  const createdPatientIds: Array<number | string> = []
  const createdStaffIds: Array<number | string> = []
  const slugPrefix = testSlug('inquiryCommunication.audit.test.ts')
  const originalMessage = 'Synthetic external message that must never enter an audit event.'
  const internalNote = 'Synthetic private note that must never enter an audit event.'
  const patientEmail = `${slugPrefix}-private@example.com`
  const patientPhone = '+493000000022'
  const closeReason = 'Synthetic patient requested closure.'

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const city = (await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })).docs[0]
    if (!city) throw new Error('Expected a baseline city for the audit persistence test.')

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
      firstName: 'Audit',
      lastName: 'Patient',
    })
    patientId = patient.id
    patientReq = await createLocalReq({}, payload)
    patientReq.user = asPayloadPatientUser(patient)

    const clinicStaff = await createClinicTestUser(payload, {
      createdStaffIds,
      emailPrefix: `${slugPrefix}-staff`,
      firstName: 'Audit',
      lastName: 'Clinician',
    })
    clinicStaffId = clinicStaff.id
    clinicReq = await createLocalReq({}, payload)
    clinicReq.user = await asClinicScopedPayloadUser(payload, clinicStaff, clinicId)

    const created = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(fixture.doctor.id),
      idempotencyKey: `${slugPrefix}-create`,
      message: 'Synthetic original inquiry content that must never enter an audit event.',
      phoneNumber: patientPhone,
      treatmentTimeline: 'within_two_weeks',
    })
    inquiryId = created.inquiry.id
    createdInquiryIds.push(inquiryId)

    const messaged = await sendClinicInquiryMessage(clinicReq, {
      expectedRevision: created.inquiry.revision,
      idempotencyKey: `${slugPrefix}-message`,
      inquiryId,
      text: originalMessage,
    })
    const messages = await payload.find({
      collection: 'inquiryMessages' as never,
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { inquiry: { equals: inquiryId } },
    })
    const message = messages.docs[0] as { id?: number | string } | undefined
    if (!message?.id) throw new Error('Expected the synthetic external message to persist.')
    messageId = String(message.id)

    await addClinicInquiryNote(clinicReq, {
      idempotencyKey: `${slugPrefix}-note`,
      inquiryId,
      text: internalNote,
    })
    const notes = await payload.find({
      collection: 'inquiryInternalNotes' as never,
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { inquiry: { equals: inquiryId } },
    })
    const note = notes.docs[0] as { id?: number | string } | undefined
    if (!note?.id) throw new Error('Expected the synthetic internal note to persist.')
    noteId = String(note.id)

    await updateClinicInquiryState(clinicReq, {
      action: 'close',
      expectedRevision: messaged.inquiry.revision,
      inquiryId,
      reason: closeReason,
    })
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

  it('persists exact content-free actors, targets, reasons, and sequences for the lifecycle', async () => {
    const result = await payload.find({
      collection: 'inquiryAuditEvents' as never,
      depth: 0,
      limit: 20,
      overrideAccess: true,
      pagination: false,
      showHiddenFields: true,
      sort: 'sequence',
      where: { inquiry: { equals: inquiryId } },
    } as never)
    const events = result.docs as unknown as StoredAuditEvent[]
    const eventByType = new Map(events.map((event) => [event.eventType, event]))

    expect(events).toHaveLength(5)
    expect(eventByType.get('inquiry-created')).toMatchObject({
      actorId: String(patientId),
      actorKind: 'patient',
      clinicNotificationSequence: 1,
      sequence: 1,
      targetId: inquiryId,
      targetType: 'inquiry',
    })
    expect(eventByType.get('handling-status-changed')).toMatchObject({
      actorId: String(clinicStaffId),
      actorKind: 'clinic',
      clinicNotificationSequence: 1,
      fromValue: 'submitted',
      sequence: 2,
      targetId: inquiryId,
      targetType: 'inquiry',
      toValue: 'contacted',
    })
    expect(eventByType.get('message-sent')).toMatchObject({
      actorId: String(clinicStaffId),
      actorKind: 'clinic',
      clinicNotificationSequence: 1,
      sequence: 2,
      targetId: messageId,
      targetType: 'message',
    })
    expect(eventByType.get('internal-note-added')).toMatchObject({
      actorId: String(clinicStaffId),
      actorKind: 'clinic',
      clinicNotificationSequence: 2,
      sequence: 3,
      targetId: noteId,
      targetType: 'note',
    })
    expect(eventByType.get('closed')).toMatchObject({
      actorId: String(clinicStaffId),
      actorKind: 'clinic',
      clinicNotificationSequence: 2,
      fromValue: 'open',
      reason: closeReason,
      sequence: 4,
      targetId: inquiryId,
      targetType: 'inquiry',
      toValue: 'closed',
    })

    const serializedAudit = JSON.stringify(events)
    for (const privateContent of [originalMessage, internalNote, patientEmail, patientPhone]) {
      expect(serializedAudit).not.toContain(privateContent)
    }
  })

  it('rejects an update attempt against an immutable persisted audit event', async () => {
    const result = await payload.find({
      collection: 'inquiryAuditEvents' as never,
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      showHiddenFields: true,
      where: { and: [{ inquiry: { equals: inquiryId } }, { eventType: { equals: 'message-sent' } }] },
    } as never)
    const event = result.docs[0] as { id?: number | string } | undefined
    if (!event?.id) throw new Error('Expected a persisted message audit event.')

    await expect(
      payload.update({
        collection: 'inquiryAuditEvents' as never,
        data: { reason: 'Synthetic tampering attempt.' },
        depth: 0,
        id: event.id,
        overrideAccess: true,
      } as never),
    ).rejects.toThrow(/reason cannot be changed after creation/i)
  })
})

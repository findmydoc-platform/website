import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import { createVerifiedPatientInquiry, sendClinicInquiryMessage } from '@/features/inquiryCommunication/service'
import { createInquiryModerationReport, decideInquiryModerationCase } from '@/features/inquiryModeration/service'
import { activateClinicNotificationsForTest, readClinicNotifications } from '@/features/clinicNotifications/service'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import {
  asClinicScopedPayloadUser,
  asPayloadPatientUser,
  createClinicTestUser,
  createPatientTestUser,
  createPlatformTestUser,
} from '../fixtures/testUsers'
vi.mock('@payloadcms/storage-s3', () => ({ s3Storage: () => (incomingConfig: unknown) => incomingConfig }))
describe('clinic inquiry moderation notifications', () => {
  let payload: Payload
  let patientReq: PayloadRequest
  let clinicReq: PayloadRequest
  let moderatorReq: PayloadRequest
  let clinicId: number
  let doctorId: number
  const createdInquiryIds: Array<number | string> = []
  const createdPatientIds: Array<number | string> = []
  const createdStaffIds: Array<number | string> = []
  const slugPrefix = testSlug('clinicNotifications.moderation.test.ts')

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
    const clinicStaff = await createClinicTestUser(payload, {
      createdStaffIds,
      emailPrefix: `${slugPrefix}-clinic`,
      firstName: 'Synthetic',
      lastName: 'Clinic',
    })

    patientReq = await createLocalReq({}, payload)
    patientReq.user = asPayloadPatientUser(patient)
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

    await activateClinicNotificationsForTest(moderatorReq)
  }, 60_000)

  afterAll(async () => {
    await payload?.db.destroy?.()
  })

  async function clinicContentCase(key: string) {
    const created = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(doctorId),
      idempotencyKey: `${slugPrefix}-${key}-inquiry`,
      message: 'Synthetic inquiry',
      phoneNumber: '+493000000001',
    })
    createdInquiryIds.push(created.inquiry.id)
    const sent = await sendClinicInquiryMessage(clinicReq, {
      expectedRevision: created.inquiry.revision,
      idempotencyKey: `${slugPrefix}-${key}-reply`,
      inquiryId: created.inquiry.id,
      text: 'Protected clinic reply',
    })
    const message = sent.inquiry.timeline.find(
      (item) => item.kind === 'external-message' && item.actor.kind === 'clinic',
    )!
    const report = await createInquiryModerationReport(patientReq, {
      category: 'privacy-concern',
      idempotencyKey: `${slugPrefix}-${key}-report`,
      inquiryId: created.inquiry.id,
      targetId: message.id,
      targetType: 'message',
    })
    return { inquiryId: created.inquiry.id, caseId: report.reportId }
  }

  it('captures one source-owned content restriction without exposing private moderation reasons', async () => {
    const source = await clinicContentCase('restriction')
    const hooks = payload.collections.inquiryModerationCases.config.hooks
    const previous = hooks.afterChange
    vi.setSystemTime(new Date('2026-10-15T10:00:00.000Z'))
    hooks.afterChange = [
      ...(previous ?? []),
      ({ doc }) => {
        vi.setSystemTime(new Date('2026-10-15T11:00:00.000Z'))
        return doc
      },
    ]
    try {
      await decideInquiryModerationCase(moderatorReq, {
        caseId: source.caseId,
        category: 'privacy-concern',
        outcome: 'content-restricted',
        reason: 'Private moderation reason',
      })
    } finally {
      hooks.afterChange = previous
      vi.useRealTimers()
    }

    const page = await readClinicNotifications(clinicReq, { mode: 'page', view: 'unread' })
    if (page.mode !== 'page') throw new Error('Expected notification page')
    const restriction = page.items.filter((item) => item.members[0]!.eventType === 'inquiry_restricted')
    expect(restriction).toHaveLength(1)
    expect(restriction[0]!.members[0]).toMatchObject({
      occurredAt: '2026-10-15T10:00:00.000Z',
      expiresAt: '2027-01-13T10:00:00.000Z',
    })
    expect(restriction[0]!.destination).toEqual({ kind: 'inquiry', inquiryId: source.inquiryId })
    expect(JSON.stringify(page)).not.toContain('Private moderation reason')
  })
})

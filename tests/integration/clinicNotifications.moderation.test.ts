import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import {
  createVerifiedPatientInquiry,
  sendClinicInquiryMessage,
  createAttachmentDraft,
  finalizeAttachmentDraft,
} from '@/features/inquiryCommunication/service'
import type { InquiryAttachmentStorageGateway } from '@/features/inquiryCommunication/storage'
import {
  createInquiryModerationReport,
  decideInquiryModerationCase,
  submitInquiryModerationAppeal,
  decideInquiryModerationAppeal,
  reconcileExpiredInquiryModerationMeasures,
  expandInquiryModerationAccess,
} from '@/features/inquiryModeration/service'
import {
  activateClinicNotificationsForTest,
  readClinicNotifications,
  markClinicNotificationsRead,
} from '@/features/clinicNotifications/service'
import activationRegistry from '@/features/transactionalEmail/activationRegistry.json'
import * as posthog from '@/posthog/api'
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
  let moderatorReq: PayloadRequest
  let clinicId: number
  let doctorId: number
  const createdInquiryIds: Array<number | string> = []
  const createdPatientIds: Array<number | string> = []
  const createdStaffIds: Array<number | string> = []
  const slugPrefix = testSlug('clinicNotifications.moderation.test.ts')
  const declaredActivationRecords = activationRegistry.records

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const city = (await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })).docs[0]
    if (!city) throw new Error('Expected baseline city')
    const fixture = await createClinicFixture(payload, city.id, { slugPrefix })
    clinicId = fixture.clinic.id
    doctorId = fixture.doctor.id

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
  beforeEach(() => {
    vi.spyOn(posthog, 'sendPostHogException').mockResolvedValue(undefined)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    activationRegistry.records = declaredActivationRecords
  })

  async function clinicContentCase(key: string) {
    const patient = await createPatientTestUser(payload, {
      createdPatientIds,
      emailPrefix: `${slugPrefix}-${key}-patient`,
      firstName: 'Synthetic',
      lastName: 'Patient',
    })
    const clinicStaff = await createClinicTestUser(payload, {
      createdStaffIds,
      emailPrefix: `${slugPrefix}-${key}-clinic`,
      firstName: 'Synthetic',
      lastName: 'Clinic',
    })
    const patientReq = await createLocalReq({}, payload)
    patientReq.user = asPayloadPatientUser(patient)
    const clinicReq = await createLocalReq({}, payload)
    clinicReq.user = await asClinicScopedPayloadUser(payload, clinicStaff, clinicId)
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
    return {
      inquiryId: created.inquiry.id,
      caseId: report.reportId,
      revision: sent.inquiry.revision,
      patientReq,
      clinicReq,
    }
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

    const page = await readClinicNotifications(source.clinicReq, { mode: 'page', view: 'unread' })
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
  it('retains separate lifted appeal and restored measure, visible only to the permitted appeal actor', async () => {
    const source = await clinicContentCase('overturned')
    await decideInquiryModerationCase(moderatorReq, {
      caseId: source.caseId,
      category: 'privacy-concern',
      outcome: 'content-restricted',
      reason: 'Internal restriction reason',
    })
    await submitInquiryModerationAppeal(source.clinicReq, { caseId: source.caseId, text: 'Private appeal text' })
    await decideInquiryModerationAppeal(moderatorReq, {
      caseId: source.caseId,
      outcome: 'overturned',
      reason: 'Private final reason',
    })
    const final = await readClinicNotifications(source.clinicReq, { mode: 'page', view: 'all' })
    if (final.mode !== 'page') throw new Error('Expected notification page')
    const related = final.items.filter(
      (item) => item.destination.kind === 'inquiry' && item.destination.inquiryId === source.inquiryId,
    )
    expect(related.map((item) => item.members[0]!.eventType).sort()).toEqual([
      'inquiry_appeal_decided',
      'inquiry_created',
      'inquiry_restored',
      'inquiry_restricted',
    ])
    expect(related.find((item) => item.members[0]!.eventType === 'inquiry_appeal_decided')!.display.outcome).toBe(
      'lifted',
    )
    expect(
      related.find((item) => item.members[0]!.eventType === 'inquiry_restored')!.members[0]!.sourceOccurrence,
    ).toEqual(
      related.find((item) => item.members[0]!.eventType === 'inquiry_appeal_decided')!.members[0]!.sourceOccurrence,
    )
    expect(JSON.stringify(final)).not.toMatch(/Private (appeal text|final reason)|Internal restriction reason/u)
    const peer = await createClinicTestUser(payload, { createdStaffIds, emailPrefix: `${slugPrefix}-peer` })
    const peerReq = await createLocalReq({}, payload)
    peerReq.user = await asClinicScopedPayloadUser(payload, peer, clinicId)
    const other = await readClinicNotifications(peerReq, { mode: 'page', view: 'all' })
    if (other.mode !== 'page') throw new Error('Expected peer page')
    expect(
      other.items
        .filter((item) => item.destination.kind === 'inquiry' && item.destination.inquiryId === source.inquiryId)
        .map((item) => item.members[0]!.eventType)
        .sort(),
    ).toEqual(['inquiry_created', 'inquiry_restored', 'inquiry_restricted'])
    const outcomeMember = related.find((item) => item.members[0]!.eventType === 'inquiry_appeal_decided')!.members[0]!
    const sourceBefore = await payload.findByID({
      collection: 'patientClinicInquiries',
      id: Number(source.inquiryId),
      depth: 0,
      overrideAccess: true,
    })
    await markClinicNotificationsRead(peerReq, { notificationIds: [outcomeMember.notificationId] })
    const ownUnread = await readClinicNotifications(source.clinicReq, { mode: 'page', view: 'unread' })
    if (ownUnread.mode !== 'page') throw new Error('Expected own unread page')
    expect(
      ownUnread.items
        .flatMap((item) => item.members)
        .find((member) => member.notificationId === outcomeMember.notificationId)?.readAt,
    ).toBeNull()
    await markClinicNotificationsRead(source.clinicReq, { notificationIds: [outcomeMember.notificationId] })
    const marked = await readClinicNotifications(source.clinicReq, { mode: 'page', view: 'all' })
    if (marked.mode !== 'page') throw new Error('Expected marked page')
    const firstReadAt = marked.items
      .flatMap((item) => item.members)
      .find((member) => member.notificationId === outcomeMember.notificationId)!.readAt
    expect(firstReadAt).toEqual(expect.any(String))
    await markClinicNotificationsRead(source.clinicReq, { notificationIds: [outcomeMember.notificationId] })
    const repeated = await readClinicNotifications(source.clinicReq, { mode: 'page', view: 'all' })
    if (repeated.mode !== 'page') throw new Error('Expected repeated page')
    expect(
      repeated.items
        .flatMap((item) => item.members)
        .find((member) => member.notificationId === outcomeMember.notificationId)!.readAt,
    ).toBe(firstReadAt)
    const sourceAfter = await payload.findByID({
      collection: 'patientClinicInquiries',
      id: Number(source.inquiryId),
      depth: 0,
      overrideAccess: true,
    })
    expect(sourceAfter).toEqual(sourceBefore)
  })
  it('captures existing timed reconciliation exactly once at the effective deadline while keeping a pending appeal', async () => {
    const source = await clinicContentCase('timed')
    const deadline = new Date(Date.now() + 60_000).toISOString()
    await decideInquiryModerationCase(moderatorReq, {
      caseId: source.caseId,
      category: 'privacy-concern',
      outcome: 'content-restricted',
      effectiveUntil: deadline,
      reason: 'Private timed reason',
    })
    await submitInquiryModerationAppeal(source.clinicReq, { caseId: source.caseId, text: 'Private pending appeal' })
    const late = new Date(Date.parse(deadline) + 3_600_000)
    expect(
      await reconcileExpiredInquiryModerationMeasures(moderatorReq, { inquiryId: source.inquiryId, now: late }),
    ).toEqual({ reconciled: 1 })
    expect(
      await reconcileExpiredInquiryModerationMeasures(moderatorReq, { inquiryId: source.inquiryId, now: late }),
    ).toEqual({ reconciled: 0 })
    const moderationCase = await payload.findByID({
      collection: 'inquiryModerationCases',
      id: Number(source.caseId),
      depth: 0,
      overrideAccess: true,
    })
    expect(moderationCase).toMatchObject({ measureEndedAt: deadline, status: 'appealed', appealOutcome: 'pending' })
    const page = await readClinicNotifications(source.clinicReq, { mode: 'page', view: 'all' })
    if (page.mode !== 'page') throw new Error('Expected notification page')
    const restored = page.items.filter(
      (item) =>
        item.destination.kind === 'inquiry' &&
        item.destination.inquiryId === source.inquiryId &&
        item.members[0]!.eventType === 'inquiry_restored',
    )
    expect(restored).toHaveLength(1)
    expect(restored[0]!.members[0]).toMatchObject({
      occurredAt: deadline,
      expiresAt: new Date(Date.parse(deadline) + 90 * 24 * 60 * 60 * 1000).toISOString(),
    })
    const immutable = await payload.findByID({
      collection: 'inquiryModerationEvents',
      id: Number(restored[0]!.members[0]!.sourceOccurrence.id),
      depth: 0,
      overrideAccess: true,
    })
    expect(immutable).toMatchObject({ eventType: 'measure-ended', moderationCase: Number(source.caseId) })
    await decideInquiryModerationAppeal(moderatorReq, {
      caseId: source.caseId,
      outcome: 'upheld',
      reason: 'Private upheld reason',
    })
    const final = await readClinicNotifications(source.clinicReq, { mode: 'page', view: 'all' })
    if (final.mode !== 'page') throw new Error('Expected final page')
    const related = final.items.filter(
      (item) => item.destination.kind === 'inquiry' && item.destination.inquiryId === source.inquiryId,
    )
    expect(related.filter((item) => item.members[0]!.eventType === 'inquiry_restored')).toHaveLength(1)
    expect(related.find((item) => item.members[0]!.eventType === 'inquiry_appeal_decided')!.display.outcome).toBe(
      'confirmed',
    )
  })
  it('rolls the source decision back on capture failure and emits only a closed technical diagnostic', async () => {
    const source = await clinicContentCase('capture-failure')
    const hooks = payload.collections.clinicNotificationOccurrences.config.hooks
    const previous = hooks.beforeChange
    const logs = vi.spyOn(payload.logger, 'error').mockImplementation(() => undefined)
    hooks.beforeChange = [
      ...(previous ?? []),
      () => {
        throw new Error('Private source fault content')
      },
    ]
    try {
      await expect(
        decideInquiryModerationCase(moderatorReq, {
          caseId: source.caseId,
          category: 'privacy-concern',
          outcome: 'content-restricted',
          reason: 'Private source reason',
        }),
      ).rejects.toThrow()
    } finally {
      hooks.beforeChange = previous
    }
    const original = await payload.findByID({
      collection: 'inquiryModerationCases',
      id: Number(source.caseId),
      depth: 0,
      overrideAccess: true,
    })
    expect(original.status).toBe('open')
    const events = await payload.find({
      collection: 'inquiryModerationEvents',
      depth: 0,
      pagination: false,
      overrideAccess: true,
      where: {
        and: [{ moderationCase: { equals: Number(source.caseId) } }, { eventType: { equals: 'decision-recorded' } }],
      },
    })
    expect(events.docs).toHaveLength(0)
    const page = await readClinicNotifications(source.clinicReq, { mode: 'page', view: 'all' })
    if (page.mode !== 'page') throw new Error('Expected notification page')
    expect(
      page.items.some(
        (item) =>
          item.destination.kind === 'inquiry' &&
          item.destination.inquiryId === source.inquiryId &&
          item.members[0]!.eventType === 'inquiry_restricted',
      ),
    ).toBe(false)
    const diagnostic = logs.mock.calls.find(
      ([fields]) =>
        typeof fields === 'object' && fields !== null && 'operation' in fields && fields.operation === 'source_capture',
    )?.[0]
    expect(diagnostic).toMatchObject({
      event: 'clinic_dashboard.notifications',
      operation: 'source_capture',
      result: 'failure',
      errorCode: 'SERVICE_UNAVAILABLE',
      attemptCount: 1,
      transactionOutcome: 'not_committed',
    })
    expect(JSON.stringify(diagnostic)).not.toMatch(/Private|caseId|inquiryId|reason|clinicId/u)
  })
  it.each([
    ['conversation-restricted', 'clinic'],
    ['identity-messaging-suspended', 'clinic'],
    ['conversation-restricted', 'patient'],
    ['identity-messaging-suspended', 'patient'],
  ] as const)(
    'captures %s but exposes the final outcome only when the affected %s actor is the clinic reader',
    async (outcome, kind) => {
      const source = await clinicContentCase(`${outcome}-${kind}`)
      const affected = kind === 'clinic' ? source.clinicReq : source.patientReq
      await decideInquiryModerationCase(moderatorReq, {
        caseId: source.caseId,
        category: 'privacy-concern',
        outcome,
        affectedActor: { kind, id: String(affected.user!.id) },
        reason: 'Private participant reason',
      })
      await submitInquiryModerationAppeal(affected, { caseId: source.caseId, text: 'Private participant appeal' })
      await decideInquiryModerationAppeal(moderatorReq, {
        caseId: source.caseId,
        outcome: 'upheld',
        reason: 'Private confirmed reason',
      })
      const page = await readClinicNotifications(source.clinicReq, { mode: 'page', view: 'all' })
      if (page.mode !== 'page') throw new Error('Expected notification page')
      const related = page.items.filter(
        (item) => item.destination.kind === 'inquiry' && item.destination.inquiryId === source.inquiryId,
      )
      expect(related.map((item) => item.members[0]!.eventType).sort()).toEqual(
        kind === 'clinic'
          ? ['inquiry_appeal_decided', 'inquiry_created', 'inquiry_restricted']
          : ['inquiry_created', 'inquiry_restricted'],
      )
      if (kind === 'clinic')
        expect(related.find((item) => item.members[0]!.eventType === 'inquiry_appeal_decided')!.display.outcome).toBe(
          'confirmed',
        )
      expect(JSON.stringify(related)).not.toMatch(/Private|reason|attachment|messageText/u)
      await expect(
        decideInquiryModerationAppeal(moderatorReq, {
          caseId: source.caseId,
          outcome: 'upheld',
          reason: 'Repeat final decision',
        }),
      ).rejects.toMatchObject({ kind: 'invalid-state' })
    },
  )
  it('excludes submission, moderator access expansion and a no-action resolution', async () => {
    const source = await clinicContentCase('no-action')
    await expandInquiryModerationAccess(moderatorReq, { caseId: source.caseId, reason: 'Private access reason' })
    await decideInquiryModerationCase(moderatorReq, {
      caseId: source.caseId,
      category: 'privacy-concern',
      outcome: 'no-action',
      reason: 'Private no-action reason',
    })
    const page = await readClinicNotifications(source.clinicReq, { mode: 'page', view: 'all' })
    if (page.mode !== 'page') throw new Error('Expected notification page')
    expect(
      page.items
        .filter((item) => item.destination.kind === 'inquiry' && item.destination.inquiryId === source.inquiryId)
        .map((item) => item.members[0]!.eventType),
    ).toEqual(['inquiry_created'])
  })
  it.each([
    ['email-owned', 1],
    ['plain', 1],
    ['email-owned', 3],
    ['plain', 3],
  ] as const)('bounds %s capture-conflict retries after %i rejected attempts', async (owner, failures) => {
    const source = await clinicContentCase(`retry-${owner}-${failures}`)
    if (owner === 'plain') {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('DEPLOYMENT_ENV', 'production')
      vi.stubEnv('VERCEL_ENV', 'production')
      activationRegistry.records = declaredActivationRecords.filter(
        ({ environment, commandType }) => environment !== 'production' || commandType !== 'moderation.report-decided',
      )
    }
    const hooks = payload.collections.clinicNotificationOccurrences.config.hooks
    const previous = hooks.beforeChange
    let attempts = 0
    hooks.beforeChange = [
      ...(previous ?? []),
      ({ data }) => {
        attempts += 1
        if (attempts <= failures) throw Object.assign(new Error('Private serialization detail'), { code: '40001' })
        return data
      },
    ]
    try {
      const command = decideInquiryModerationCase(moderatorReq, {
        caseId: source.caseId,
        category: 'privacy-concern',
        outcome: 'content-restricted',
        reason: 'Private retry reason',
      })
      if (failures === 3) await expect(command).rejects.toMatchObject({ kind: 'conflict' })
      else await expect(command).resolves.toEqual({ decided: true })
    } finally {
      hooks.beforeChange = previous
    }
    expect(attempts).toBe(failures === 3 ? 3 : 2)
    const original = await payload.findByID({
      collection: 'inquiryModerationCases',
      id: Number(source.caseId),
      depth: 0,
      overrideAccess: true,
    })
    expect(original.status).toBe(failures === 3 ? 'open' : 'decided')
    const events = await payload.find({
      collection: 'inquiryModerationEvents',
      depth: 0,
      pagination: false,
      overrideAccess: true,
      where: {
        and: [{ moderationCase: { equals: Number(source.caseId) } }, { eventType: { equals: 'decision-recorded' } }],
      },
    })
    expect(events.docs).toHaveLength(failures === 3 ? 0 : 1)
  })
  it('captures attachment restrictions through the ordinary command without exposing attachment metadata', async () => {
    const source = await clinicContentCase('attachment')
    const storage: InquiryAttachmentStorageGateway = {
      createReadAccess: vi.fn(async () => ({
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
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
      source.clinicReq,
      { fileName: 'Private attachment.pdf', inquiryId: source.inquiryId, mimeType: 'application/pdf', sizeBytes: 4 },
      storage,
    )
    await finalizeAttachmentDraft(source.clinicReq, { draftId: draft.draftId, inquiryId: source.inquiryId }, storage)
    const sent = await sendClinicInquiryMessage(
      source.clinicReq,
      {
        attachmentDraftId: draft.draftId,
        expectedRevision: source.revision,
        idempotencyKey: `${slugPrefix}-attachment-message`,
        inquiryId: source.inquiryId,
      },
      storage,
    )
    const message = sent.inquiry.timeline.find(
      (item) => item.kind === 'external-message' && item.attachment?.fileName === 'Private attachment.pdf',
    )
    if (message?.kind !== 'external-message' || !message.attachment) throw new Error('Expected bound attachment')
    const report = await createInquiryModerationReport(source.patientReq, {
      category: 'privacy-concern',
      idempotencyKey: `${slugPrefix}-attachment-target-report`,
      inquiryId: source.inquiryId,
      targetId: message.attachment.id,
      targetType: 'attachment',
    })
    await decideInquiryModerationCase(moderatorReq, {
      caseId: report.reportId,
      category: 'privacy-concern',
      outcome: 'content-restricted',
      reason: 'Private attachment reason',
    })
    const page = await readClinicNotifications(source.clinicReq, { mode: 'page', view: 'all' })
    if (page.mode !== 'page') throw new Error('Expected notification page')
    const related = page.items.filter(
      (item) => item.destination.kind === 'inquiry' && item.destination.inquiryId === source.inquiryId,
    )
    expect(related.map((item) => item.members[0]!.eventType).sort()).toEqual(['inquiry_created', 'inquiry_restricted'])
    expect(JSON.stringify(related)).not.toMatch(/Private|fileName|mimeType|attachmentId/u)
  })
  it('does not backfill a timed restoration that became effective before capture activation', async () => {
    const control = (
      await payload.find({
        collection: 'clinicNotificationControls',
        overrideAccess: true,
        where: { key: { equals: 'notification-center' } },
      })
    ).docs[0]!
    async function writeControl(data: { active: boolean; activatedAt: string | null }) {
      const transactionID = await payload.db.beginTransaction({ isolationLevel: 'serializable' })
      if (!transactionID) throw new Error('Expected control fixture transaction')
      const req = await createLocalReq(
        { context: { clinicNotificationCommand: true }, req: { transactionID } },
        payload,
      )
      try {
        await payload.update({
          collection: 'clinicNotificationControls',
          id: control.id,
          overrideAccess: true,
          req,
          data,
        })
        await payload.db.commitTransaction(transactionID)
      } catch (error) {
        await payload.db.rollbackTransaction(transactionID)
        throw error
      }
    }
    await writeControl({ active: false, activatedAt: null })
    try {
      const clock = Date.now()
      vi.setSystemTime(new Date(clock - 20 * 60_000))
      const source = await clinicContentCase('preactivation-expiry')
      const deadline = new Date(clock - 10 * 60_000).toISOString()
      await decideInquiryModerationCase(moderatorReq, {
        caseId: source.caseId,
        category: 'privacy-concern',
        outcome: 'content-restricted',
        effectiveUntil: deadline,
        reason: 'Private historical reason',
      })
      vi.useRealTimers()
      await activateClinicNotificationsForTest(moderatorReq)
      expect(await reconcileExpiredInquiryModerationMeasures(moderatorReq, { inquiryId: source.inquiryId })).toEqual({
        reconciled: 1,
      })
      const page = await readClinicNotifications(source.clinicReq, { mode: 'page', view: 'all' })
      if (page.mode !== 'page') throw new Error('Expected notification page')
      expect(
        page.items.filter(
          (item) => item.destination.kind === 'inquiry' && item.destination.inquiryId === source.inquiryId,
        ),
      ).toEqual([])
    } finally {
      vi.useRealTimers()
      await writeControl({ active: control.active, activatedAt: control.activatedAt ?? null })
    }
  })
  it.each(['email-owned', 'plain'] as const)(
    'preserves a committed %s source when its commit response is lost without replaying the command',
    async (owner) => {
      const source = await clinicContentCase(`lost-commit-${owner}`)
      if (owner === 'plain') {
        vi.stubEnv('NODE_ENV', 'production')
        vi.stubEnv('DEPLOYMENT_ENV', 'production')
        vi.stubEnv('VERCEL_ENV', 'production')
        activationRegistry.records = declaredActivationRecords.filter(
          ({ environment, commandType }) => environment !== 'production' || commandType !== 'moderation.report-decided',
        )
      }
      const logs = vi.spyOn(payload.logger, 'error').mockImplementation(() => undefined)
      const originalCommit = payload.db.commitTransaction.bind(payload.db)
      const commit = vi.spyOn(payload.db, 'commitTransaction').mockImplementationOnce(async (transactionID) => {
        await originalCommit(transactionID)
        throw new Error('Private lost commit response')
      })
      await expect(
        decideInquiryModerationCase(moderatorReq, {
          caseId: source.caseId,
          category: 'privacy-concern',
          outcome: 'content-restricted',
          reason: 'Private committed reason',
        }),
      ).rejects.toThrow()
      expect(commit).toHaveBeenCalledTimes(1)
      commit.mockRestore()
      const persisted = await payload.findByID({
        collection: 'inquiryModerationCases',
        id: Number(source.caseId),
        depth: 0,
        overrideAccess: true,
      })
      expect(persisted.status).toBe('decided')
      const events = await payload.find({
        collection: 'inquiryModerationEvents',
        depth: 0,
        pagination: false,
        overrideAccess: true,
        where: {
          and: [{ moderationCase: { equals: Number(source.caseId) } }, { eventType: { equals: 'decision-recorded' } }],
        },
      })
      expect(events.docs).toHaveLength(1)
      const occurrences = await payload.find({
        collection: 'clinicNotificationOccurrences',
        depth: 0,
        pagination: false,
        overrideAccess: true,
        where: {
          and: [{ sourceRecordId: { equals: source.inquiryId } }, { eventType: { equals: 'inquiry_restricted' } }],
        },
      })
      expect(occurrences.docs).toHaveLength(1)
      expect(occurrences.docs[0]!.sourceOccurrenceId).toBe(String(events.docs[0]!.id))
      const diagnostic = logs.mock.calls.find(
        ([fields]) =>
          typeof fields === 'object' &&
          fields !== null &&
          'operation' in fields &&
          fields.operation === 'source_capture',
      )?.[0]
      expect(diagnostic).toMatchObject({ result: 'failure', attemptCount: 1, transactionOutcome: 'unknown' })
      expect(JSON.stringify(diagnostic)).not.toMatch(/Private|caseId|inquiryId|reason|clinicId/u)
      await expect(
        decideInquiryModerationCase(moderatorReq, {
          caseId: source.caseId,
          category: 'privacy-concern',
          outcome: 'content-restricted',
          reason: 'Repeat uncertain decision',
        }),
      ).rejects.toMatchObject({ kind: 'invalid-state' })
      const repeated = await payload.find({
        collection: 'clinicNotificationOccurrences',
        depth: 0,
        pagination: false,
        overrideAccess: true,
        where: { sourceRecordId: { equals: source.inquiryId } },
      })
      expect(repeated.docs.map((item) => item.eventType).sort()).toEqual(['inquiry_created', 'inquiry_restricted'])
    },
  )
  it.each(['upheld', 'overturned'] as const)(
    'uses the original deadline for late %s restoration instead of final-decision processing time',
    async (outcome) => {
      const source = await clinicContentCase(`late-${outcome}`)
      const deadline = new Date(Date.now() + 60_000).toISOString()
      await decideInquiryModerationCase(moderatorReq, {
        caseId: source.caseId,
        category: 'privacy-concern',
        outcome: 'content-restricted',
        effectiveUntil: deadline,
        reason: 'Private original deadline',
      })
      await submitInquiryModerationAppeal(source.clinicReq, { caseId: source.caseId, text: 'Private late appeal' })
      const processedAt = new Date(Date.parse(deadline) + 3_600_000).toISOString()
      vi.setSystemTime(new Date(processedAt))
      await decideInquiryModerationAppeal(moderatorReq, {
        caseId: source.caseId,
        outcome,
        reason: 'Private late final reason',
      })
      const page = await readClinicNotifications(source.clinicReq, { mode: 'page', view: 'all' })
      if (page.mode !== 'page') throw new Error('Expected notification page')
      const related = page.items.filter(
        (item) => item.destination.kind === 'inquiry' && item.destination.inquiryId === source.inquiryId,
      )
      expect(related.find((item) => item.members[0]!.eventType === 'inquiry_restored')!.members[0]!.occurredAt).toBe(
        deadline,
      )
      expect(
        related.find((item) => item.members[0]!.eventType === 'inquiry_appeal_decided')!.members[0]!.occurredAt,
      ).toBe(processedAt)
      expect(related.find((item) => item.members[0]!.eventType === 'inquiry_appeal_decided')!.display.outcome).toBe(
        outcome === 'upheld' ? 'confirmed' : 'lifted',
      )
      expect(await reconcileExpiredInquiryModerationMeasures(moderatorReq, { inquiryId: source.inquiryId })).toEqual({
        reconciled: 0,
      })
    },
  )
  it.each(['inquiryModerationCases', 'clinicNotificationOccurrences'] as const)(
    'does not autocommit audit or activity writes after the native %s transaction disappears',
    async (collection) => {
      const source = await clinicContentCase(`lost-native-session-${collection}`)
      const before = await payload.findByID({
        collection: 'patientClinicInquiries',
        id: Number(source.inquiryId),
        depth: 0,
        overrideAccess: true,
      })
      const hooks = payload.collections[collection].config.hooks
      const previous = hooks.afterChange
      hooks.afterChange = [
        ...(previous ?? []),
        async ({ doc, req }) => {
          if (doc.status === 'decided' || doc.eventType === 'inquiry_restricted')
            await req.payload.db.rollbackTransaction((await req.transactionID)!)
          return doc
        },
      ]
      try {
        await expect(
          decideInquiryModerationCase(moderatorReq, {
            caseId: source.caseId,
            category: 'privacy-concern',
            outcome: 'content-restricted',
            reason: 'Private lost session reason',
          }),
        ).rejects.toThrow()
      } finally {
        hooks.afterChange = previous
      }
      const original = await payload.findByID({
        collection: 'inquiryModerationCases',
        id: Number(source.caseId),
        depth: 0,
        overrideAccess: true,
      })
      expect(original.status).toBe('open')
      const events = await payload.find({
        collection: 'inquiryModerationEvents',
        depth: 0,
        pagination: false,
        overrideAccess: true,
        where: {
          and: [{ moderationCase: { equals: Number(source.caseId) } }, { eventType: { equals: 'decision-recorded' } }],
        },
      })
      expect(events.docs).toHaveLength(0)
      const activities = await payload.find({
        collection: 'inquiryAuditEvents',
        depth: 0,
        pagination: false,
        overrideAccess: true,
        where: {
          and: [{ inquiry: { equals: Number(source.inquiryId) } }, { eventType: { equals: 'moderation-restricted' } }],
        },
      })
      expect(activities.docs).toHaveLength(0)
      const after = await payload.findByID({
        collection: 'patientClinicInquiries',
        id: Number(source.inquiryId),
        depth: 0,
        overrideAccess: true,
      })
      expect(after).toEqual(before)
    },
  )
})

import http from 'node:http'
import https from 'node:https'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createLocalReq,
  getPayload,
  type Payload,
  type PayloadRequest,
  type CollectionBeforeChangeHook,
  type CollectionAfterChangeHook,
} from 'payload'
import config from '@payload-config'
import {
  createVerifiedPatientInquiry,
  sendPatientInquiryMessage,
  updateClinicInquiryState,
} from '@/features/inquiryCommunication/service'
import {
  createInquiryModerationReport,
  decideInquiryModerationCase,
  submitInquiryModerationAppeal,
  decideInquiryModerationAppeal,
} from '@/features/inquiryModeration/service'
import { bindTransactionalEmail } from '@/features/transactionalEmail/payloadIntegration'
import { createTransactionalEmailWorker } from '@/features/transactionalEmail/worker'
import type { DeliveryAdapter, DeliveryLog } from '@/features/transactionalEmail/delivery'
import { runOwnedTransaction } from '@/features/transactionalEmail/transactions'
import { openStorageCapability } from '@/features/transactionalEmail/capability'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTransactionalEmailFixtures } from '../fixtures/cleanupTransactionalEmailFixtures'
import { testSlug } from '../fixtures/testSlug'
import {
  asClinicScopedPayloadUser,
  asPayloadPatientUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPatientTestUser,
  createPlatformTestUser,
} from '../fixtures/testUsers'

vi.mock('@payloadcms/storage-s3', () => ({ s3Storage: () => (incoming: unknown) => incoming }))

describe('authoritative initial moderation decision mail', () => {
  let payload: Payload
  let patientReq: PayloadRequest
  let clinicReq: PayloadRequest
  let otherClinicReq: PayloadRequest
  let moderatorReq: PayloadRequest
  let clinicId: number
  let doctorId: number
  const inquiryIds: string[] = []
  const patientIds: Array<number | string> = []
  const staffIds: Array<number | string> = []
  const references: string[] = []
  const prefix = testSlug('transactionalEmail.moderationDecision.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const city = (await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })).docs[0]
    if (!city) throw new Error('Expected baseline city')
    const fixture = await createClinicFixture(payload, city.id, { slugPrefix: prefix })
    clinicId = fixture.clinic.id
    doctorId = fixture.doctor.id
    const clinic = await createClinicTestUser(payload, { createdStaffIds: staffIds, emailPrefix: `${prefix}-clinic` })
    clinicReq = await createLocalReq({}, payload)
    clinicReq.user = await asClinicScopedPayloadUser(payload, clinic, clinicId)
    const other = await createClinicTestUser(payload, { createdStaffIds: staffIds, emailPrefix: `${prefix}-other` })
    otherClinicReq = await createLocalReq({}, payload)
    otherClinicReq.user = await asClinicScopedPayloadUser(payload, other, clinicId)
    const moderator = await createPlatformTestUser(payload, {
      createdStaffIds: staffIds,
      emailPrefix: `${prefix}-moderator`,
    })
    const authorized = await payload.update({
      collection: 'platformStaff',
      id: moderator.id,
      data: { capabilities: ['conversation-moderation'] },
      context: { trustedPlatformStaffOps: true },
      overrideAccess: true,
    })
    moderatorReq = await createLocalReq({}, payload)
    moderatorReq.user = { ...authorized, collection: 'platformStaff' }
  }, 60_000)

  beforeEach(async () => {
    const patient = await createPatientTestUser(payload, {
      createdPatientIds: patientIds,
      emailPrefix: `${prefix}-patient-${patientIds.length}`,
      firstName: 'ForbiddenPatientName',
    })
    patientReq = await createLocalReq({}, payload)
    patientReq.user = asPayloadPatientUser(patient)
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
    const ownedEvents = await payload.find({
      collection: 'inquiryModerationEvents',
      depth: 0,
      pagination: false,
      overrideAccess: true,
      where: { inquiry: { in: inquiryIds } },
    })
    for (const event of ownedEvents.docs)
      for (const slot of ['reporter', 'affected', 'appellant'])
        references.push(`v1|moderation-event|${event.id}|${slot}`)
    await cleanupTransactionalEmailFixtures(payload, references)
    for (const collection of [
      'inquiryModerationEvents',
      'inquiryModerationCases',
      'inquiryAuditEvents',
      'inquiryReadPositions',
      'inquiryMessages',
      'inquiryConversations',
    ] as const)
      await payload.delete({ collection, overrideAccess: true, where: { inquiry: { in: inquiryIds } } })
    for (const id of inquiryIds)
      await payload.delete({ collection: 'patientClinicInquiries', id, overrideAccess: true })
    await cleanupTrackedUsers(payload, { patientIds, staffIds })
    await payload.delete({ collection: 'doctors', overrideAccess: true, where: { clinic: { equals: clinicId } } })
    await payload.delete({ collection: 'clinics', id: clinicId, overrideAccess: true })
  })

  async function report(
    reporterReq: PayloadRequest = patientReq,
    targetType: 'conversation' | 'message' = 'conversation',
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
    ).docs[0]!
    if (targetType === 'message')
      await sendPatientInquiryMessage(patientReq, {
        inquiryId: created.inquiry.id,
        expectedRevision: created.inquiry.revision,
        idempotencyKey: `${prefix}-patient-message-${inquiryIds.length}`,
        text: 'ForbiddenHealthDetails',
      })
    const message =
      targetType === 'message'
        ? (
            await payload.find({
              collection: 'inquiryMessages',
              depth: 0,
              limit: 1,
              overrideAccess: true,
              where: { and: [{ inquiry: { equals: created.inquiry.id } }, { authorKind: { equals: 'patient' } }] },
            })
          ).docs[0]
        : undefined
    const receipt = await createInquiryModerationReport(reporterReq, {
      inquiryId: created.inquiry.id,
      targetType,
      targetId: String(message?.id ?? conversation.id),
      category: 'privacy-concern',
      description: 'ForbiddenReportDescription',
      idempotencyKey: `${prefix}-report-${inquiryIds.length}`,
    })
    const received = (
      await payload.find({
        collection: 'inquiryModerationEvents',
        depth: 0,
        overrideAccess: true,
        where: {
          and: [{ moderationCase: { equals: receipt.reportId } }, { eventType: { equals: 'report-received' } }],
        },
      })
    ).docs[0]!
    references.push(`v1|moderation-event|${received.id}|reporter`)
    return { inquiryId: created.inquiry.id, caseId: receipt.reportId, receivedEventId: received.id }
  }

  async function decisionEvent(caseId: string) {
    const event = (
      await payload.find({
        collection: 'inquiryModerationEvents',
        depth: 0,
        overrideAccess: true,
        where: { and: [{ moderationCase: { equals: caseId } }, { eventType: { equals: 'decision-recorded' } }] },
      })
    ).docs[0]!
    if (!event) throw new Error('Expected decision event')
    for (const slot of ['reporter', 'affected']) references.push(`v1|moderation-event|${event.id}|${slot}`)
    return event
  }

  const commandFor = (moderationEventId: number, recipientSlot: 'reporter' | 'affected' = 'reporter') => ({
    type: 'moderation.report-decided' as const,
    moderationEventId,
    recipientSlot,
  })

  function recipientEmail(req: PayloadRequest) {
    if (!req.user || !('email' in req.user) || typeof req.user.email !== 'string')
      throw new Error('Expected participant email')
    return req.user.email
  }

  async function operations(
    eventId: number,
    commandType: 'moderation.report-decided' | 'moderation.report-received' = 'moderation.report-decided',
  ) {
    return runOwnedTransaction(await createLocalReq({}, payload), async (_, transactionID) => {
      const capability = openStorageCapability(transactionID)
      try {
        const req = await createLocalReq(
          { context: capability.context, req: { transactionID: Promise.resolve(transactionID) } },
          payload,
        )
        return await payload.find({
          collection: 'transactionalEmailOutbox',
          depth: 0,
          pagination: false,
          overrideAccess: true,
          req,
          where: {
            and: [
              { commandType: { equals: commandType } },
              {
                operationReference: {
                  in: [`v1|moderation-event|${eventId}|reporter`, `v1|moderation-event|${eventId}|affected`],
                },
              },
            ],
          },
        })
      } finally {
        capability.close()
      }
    })
  }

  async function deliver(operationId: string, delivery?: DeliveryAdapter, now?: () => number) {
    const adapter = delivery ?? {
      deliver: vi.fn<DeliveryAdapter['deliver']>(async () => ({ type: 'accepted', messageId: 'fake-decision' })),
    }
    const logs: DeliveryLog[] = []
    await createTransactionalEmailWorker(await createLocalReq({}, payload), {
      delivery: adapter,
      suppression: async () => 'cleared',
      log: (entry) => {
        logs.push(entry)
      },
      now,
    }).run(operationId)
    return { delivery: adapter, logs }
  }

  async function withBeforeHook<Result>(
    collection: 'transactionalEmailOutbox' | 'transactionalEmailEvents',
    hook: CollectionBeforeChangeHook,
    work: () => Promise<Result>,
  ) {
    const hooks = payload.collections[collection].config.hooks
    const original = hooks.beforeChange
    hooks.beforeChange = [...(original ?? []), hook]
    try {
      return await work()
    } finally {
      hooks.beforeChange = original
    }
  }

  async function committedState(inquiryId: string) {
    const inquiry = await payload.findByID({
      collection: 'patientClinicInquiries',
      id: inquiryId,
      depth: 0,
      overrideAccess: true,
    })
    const cases = await payload.find({
      collection: 'inquiryModerationCases',
      depth: 0,
      pagination: false,
      overrideAccess: true,
      where: { inquiry: { equals: inquiryId } },
    })
    const events = await payload.find({
      collection: 'inquiryModerationEvents',
      depth: 0,
      pagination: false,
      overrideAccess: true,
      where: { inquiry: { equals: inquiryId } },
    })
    const audits = await payload.find({
      collection: 'inquiryAuditEvents',
      depth: 0,
      pagination: false,
      overrideAccess: true,
      where: { inquiry: { equals: inquiryId } },
    })
    const mail = await runOwnedTransaction(await createLocalReq({}, payload), async (_, transactionID) => {
      const capability = openStorageCapability(transactionID)
      try {
        const req = await createLocalReq(
          { context: capability.context, req: { transactionID: Promise.resolve(transactionID) } },
          payload,
        )
        const outbox = await payload.find({
          collection: 'transactionalEmailOutbox',
          depth: 0,
          pagination: false,
          overrideAccess: true,
          req,
          where: { commandType: { equals: 'moderation.report-decided' } },
        })
        const mailEvents = outbox.docs.length
          ? await payload.find({
              collection: 'transactionalEmailEvents',
              depth: 0,
              pagination: false,
              overrideAccess: true,
              req,
              where: { outbox: { in: outbox.docs.map((doc) => doc.id) } },
            })
          : { docs: [] }
        return { operations: outbox.docs, mailEvents: mailEvents.docs }
      } finally {
        capability.close()
      }
    })
    return { inquiry, cases: cases.docs, events: events.docs, audits: audits.docs, ...mail }
  }

  it('delivers the authoritative no-action decision to its reporter using the package template and protected Inquiry target', async () => {
    const source = await report()
    await decideInquiryModerationCase(moderatorReq, {
      caseId: source.caseId,
      category: 'spam-fraud-impersonation',
      outcome: 'no-action',
      reason: 'ForbiddenInternalReason',
    })
    const event = await decisionEvent(source.caseId)
    const accepted = await bindTransactionalEmail(moderatorReq).accept(commandFor(event.id))
    const { delivery } = await deliver(accepted.operationId)
    expect(delivery.deliver).toHaveBeenCalledOnce()
    const message = vi.mocked(delivery.deliver).mock.calls[0]![0]
    expect(message.subject).toBe('A moderation decision is available')
    expect(message.recipientAddress).toBe(recipientEmail(patientReq))
    expect(message.text).toContain('No action')
    expect(message.html).toContain(`https://website.example.test/patient/inquiries/${source.inquiryId}`)
    expect(message.text).toContain('Spam, fraud, or impersonation')
    for (const forbidden of [
      'ForbiddenPatientName',
      'ForbiddenHealthDetails',
      'ForbiddenReportDescription',
      'ForbiddenInternalReason',
    ]) {
      expect(message.text).not.toContain(forbidden)
      expect(message.html).not.toContain(forbidden)
    }
    expect((await operations(event.id)).docs).toHaveLength(1)
  })

  it('accepts exactly the reporter operation inside the normal no-action decision transaction', async () => {
    const source = await report()
    await decideInquiryModerationCase(moderatorReq, {
      caseId: source.caseId,
      category: 'other',
      outcome: 'no-action',
      reason: 'ForbiddenInternalReason',
    })
    const event = await decisionEvent(source.caseId)
    const outbox = (await operations(event.id)).docs
    expect(outbox).toHaveLength(1)
    expect(outbox[0]!.operationReference).toBe(`v1|moderation-event|${event.id}|reporter`)
    const { delivery } = await deliver(String(outbox[0]!.id))
    expect(delivery.deliver).toHaveBeenCalledOnce()
    expect(vi.mocked(delivery.deliver).mock.calls[0]![0].recipientAddress).toBe(recipientEmail(patientReq))
  })

  it.each(['content-restricted', 'conversation-restricted', 'identity-messaging-suspended'] as const)(
    'delivers %s only to the exact reporter and affected participant',
    async (outcome) => {
      const source = await report(clinicReq, outcome === 'content-restricted' ? 'message' : 'conversation')
      const effectiveUntil = new Date(Date.now() + 3_600_000).toISOString()
      await decideInquiryModerationCase(moderatorReq, {
        caseId: source.caseId,
        category: 'harassment-threats',
        outcome,
        reason: 'ForbiddenInternalReason',
        effectiveUntil,
        ...(outcome === 'content-restricted'
          ? {}
          : { affectedActor: { kind: 'patient', id: String(patientReq.user!.id) } }),
      })
      const event = await decisionEvent(source.caseId)
      const outbox = (await operations(event.id)).docs
      expect(outbox).toHaveLength(2)
      expect(outbox.map((doc) => doc.operationReference).sort()).toEqual(
        ['affected', 'reporter'].map((slot) => `v1|moderation-event|${event.id}|${slot}`).sort(),
      )
      const sent = []
      for (const operation of outbox) {
        const { delivery } = await deliver(String(operation.id))
        expect(delivery.deliver).toHaveBeenCalledOnce()
        sent.push(vi.mocked(delivery.deliver).mock.calls[0]![0])
      }
      expect(sent.map((message) => message.recipientAddress).sort()).toEqual(
        [recipientEmail(patientReq), recipientEmail(clinicReq)].sort(),
      )
      expect(sent.some((message) => message.recipientAddress === recipientEmail(otherClinicReq))).toBe(false)
      expect(sent.some((message) => message.recipientAddress === recipientEmail(moderatorReq))).toBe(false)
      const reporter = sent.find((message) => message.recipientAddress === recipientEmail(clinicReq))!
      const affected = sent.find((message) => message.recipientAddress === recipientEmail(patientReq))!
      expect(reporter.text).toContain('Action taken')
      expect(reporter.text).not.toContain('scheduled to end')
      expect(reporter.html).toContain(`https://dashboard.example.test/?inquiry=${source.inquiryId}`)
      expect(affected.text).toContain('scheduled to end')
      expect(affected.text).toContain('UTC')
      expect(affected.html).toContain(`https://website.example.test/patient/inquiries/${source.inquiryId}`)
      for (const message of sent) {
        expect(message.subject).toBe('A moderation decision is available')
        expect(message.text).toContain('Harassment, threats, or inappropriate conduct')
        for (const forbidden of [
          'ForbiddenPatientName',
          'ForbiddenHealthDetails',
          'ForbiddenReportDescription',
          'ForbiddenInternalReason',
        ]) {
          expect(message.text).not.toContain(forbidden)
          expect(message.html).not.toContain(forbidden)
        }
      }
    },
  )

  it.each(['patient', 'clinic'] as const)(
    'gives the affected slot priority when %s reporter and affected identities coincide',
    async (kind) => {
      const recipientReq = kind === 'patient' ? patientReq : clinicReq
      const source = await report(recipientReq)
      await decideInquiryModerationCase(moderatorReq, {
        caseId: source.caseId,
        category: 'other',
        outcome: 'identity-messaging-suspended',
        reason: 'ForbiddenInternalReason',
        affectedActor: { kind, id: String(recipientReq.user!.id) },
      })
      const event = await decisionEvent(source.caseId)
      const outbox = (await operations(event.id)).docs
      expect(outbox).toHaveLength(1)
      expect(outbox[0]!.operationReference).toBe(`v1|moderation-event|${event.id}|affected`)
      const { delivery } = await deliver(String(outbox[0]!.id))
      expect(delivery.deliver).toHaveBeenCalledOnce()
      const message = vi.mocked(delivery.deliver).mock.calls[0]![0]
      expect(message.recipientAddress).toBe(recipientEmail(recipientReq))
      expect(message.text).toContain('Messaging suspended')
      expect(message.text).not.toContain('scheduled to end')
    },
  )

  it('suppresses an unaccepted report receipt once its authoritative initial decision exists', async () => {
    const source = await report()
    const receipt = (await operations(source.receivedEventId, 'moderation.report-received')).docs[0]!
    await decideInquiryModerationCase(moderatorReq, {
      caseId: source.caseId,
      category: 'other',
      outcome: 'no-action',
      reason: 'ForbiddenInternalReason',
    })
    const { delivery, logs } = await deliver(String(receipt.id))
    expect(delivery.deliver).not.toHaveBeenCalled()
    expect(logs).toContainEqual(expect.objectContaining({ outcomeCode: 'superseded', outboxState: 'suppressed' }))
    const stored = (await operations(source.receivedEventId, 'moderation.report-received')).docs[0]!
    expect(stored).toMatchObject({
      state: 'suppressed',
      commandPayload: null,
      recipientAddress: null,
      preparedHtml: null,
    })
  })

  it('never recalls a provider-accepted receipt and gives the later decision its own operation', async () => {
    const source = await report()
    const receipt = (await operations(source.receivedEventId, 'moderation.report-received')).docs[0]!
    const adapter: DeliveryAdapter = {
      deliver: vi.fn<DeliveryAdapter['deliver']>(async () => ({
        type: 'accepted',
        messageId: 'fake-accepted-receipt',
      })),
    }
    await deliver(String(receipt.id), adapter)
    expect(adapter.deliver).toHaveBeenCalledOnce()
    await decideInquiryModerationCase(moderatorReq, {
      caseId: source.caseId,
      category: 'other',
      outcome: 'no-action',
      reason: 'ForbiddenInternalReason',
    })
    await deliver(String(receipt.id), adapter)
    expect(adapter.deliver).toHaveBeenCalledOnce()
    expect((await operations(source.receivedEventId, 'moderation.report-received')).docs[0]).toMatchObject({
      state: 'accepted',
      providerMessageId: 'fake-accepted-receipt',
    })
    const event = await decisionEvent(source.caseId)
    const outbox = (await operations(event.id)).docs
    expect(outbox).toHaveLength(1)
    expect(outbox[0]!.id).not.toBe(receipt.id)
  })

  it.each(['operation', 'first-event', 'commit'] as const)(
    'rolls the full decision callback back on unexpected %s failure',
    async (boundary) => {
      const source = await report()
      const before = await committedState(source.inquiryId)
      const fail = async () => {
        throw new Error('Synthetic storage failure')
      }
      const submit = () =>
        decideInquiryModerationCase(moderatorReq, {
          caseId: source.caseId,
          category: 'other',
          outcome: 'conversation-restricted',
          reason: 'ForbiddenInternalReason',
          affectedActor: { kind: 'patient', id: String(patientReq.user!.id) },
        })
      if (boundary === 'commit') {
        const fault = vi.spyOn(payload.db, 'commitTransaction').mockImplementationOnce(fail)
        try {
          await expect(submit()).rejects.toMatchObject({ kind: 'unavailable' })
        } finally {
          fault.mockRestore()
        }
      } else
        await withBeforeHook(
          boundary === 'operation' ? 'transactionalEmailOutbox' : 'transactionalEmailEvents',
          fail,
          async () => {
            await expect(submit()).rejects.toMatchObject({ kind: 'unavailable' })
          },
        )
      expect(await committedState(source.inquiryId)).toEqual(before)
    },
  )

  it.each([1, 3] as const)(
    'retries the complete decision callback at most three times after %s serialization failures',
    async (failures) => {
      const source = await report()
      const before = await committedState(source.inquiryId)
      let attempts = 0
      let writes = 0
      const hooks = payload.collections.inquiryModerationCases.config.hooks
      const original = hooks.afterChange
      hooks.afterChange = [
        ...(original ?? []),
        async ({ doc }) => {
          writes++
          return doc
        },
      ]
      try {
        await withBeforeHook(
          'transactionalEmailEvents',
          async ({ data }) => {
            if (data.type === 'command.accepted' && attempts++ < failures)
              throw Object.assign(new Error('Synthetic serialization conflict'), { code: '40001' })
            return data
          },
          async () => {
            const submit = () =>
              decideInquiryModerationCase(moderatorReq, {
                caseId: source.caseId,
                category: 'other',
                outcome: 'no-action',
                reason: 'ForbiddenInternalReason',
              })
            if (failures === 3) await expect(submit()).rejects.toMatchObject({ kind: 'conflict' })
            else {
              await expect(submit()).resolves.toEqual({ decided: true })
              const event = await decisionEvent(source.caseId)
              expect((await operations(event.id)).docs).toHaveLength(1)
            }
          },
        )
        expect(writes).toBe(failures === 3 ? 3 : 2)
        if (failures === 3) expect(await committedState(source.inquiryId)).toEqual(before)
      } finally {
        hooks.afterChange = original
      }
    },
  )

  it('commits an eligible domain decision with atomic scrubbed suppression if its clinic reporter loses read eligibility', async () => {
    const source = await report(clinicReq)
    const hooks = payload.collections.inquiryModerationEvents.config.hooks
    const original = hooks.afterChange
    const loseEligibility: CollectionAfterChangeHook = async ({ doc, req }) => {
      if (doc.eventType === 'decision-recorded')
        await payload.update({
          collection: 'clinicStaff',
          id: clinicReq.user!.id,
          data: { authSync: { status: 'failed' } },
          context: { skipClinicStaffAuthSync: true },
          req,
          overrideAccess: true,
        })
      return doc
    }
    hooks.afterChange = [...(original ?? []), loseEligibility]
    try {
      await expect(
        decideInquiryModerationCase(moderatorReq, {
          caseId: source.caseId,
          category: 'other',
          outcome: 'no-action',
          reason: 'ForbiddenInternalReason',
        }),
      ).resolves.toEqual({ decided: true })
      const event = await decisionEvent(source.caseId)
      const outbox = (await operations(event.id)).docs
      expect(outbox).toHaveLength(1)
      expect(outbox[0]).toMatchObject({
        state: 'suppressed',
        latestEventSequence: 3,
        attemptCount: 0,
        commandPayload: null,
        recipientAddress: null,
        preparedHtml: null,
      })
      const state = await committedState(source.inquiryId)
      expect(
        state.mailEvents
          .filter((entry) => entry.outbox === outbox[0]!.id)
          .sort((left, right) => left.sequence - right.sequence)
          .map(({ sequence, type, source, outcomeCode }) => ({ sequence, type, source, outcomeCode })),
      ).toEqual([
        { sequence: 1, type: 'command.accepted', source: 'command', outcomeCode: null },
        { sequence: 2, type: 'delivery.suppressed', source: 'command', outcomeCode: 'ineligible' },
        { sequence: 3, type: 'payload.scrubbed', source: 'command', outcomeCode: null },
      ])
      const { delivery } = await deliver(String(outbox[0]!.id))
      expect(delivery.deliver).not.toHaveBeenCalled()
      await expect(bindTransactionalEmail(otherClinicReq).accept(commandFor(event.id))).rejects.toMatchObject({
        code: 'access-denied',
      })
    } finally {
      hooks.afterChange = original
      await payload.update({
        collection: 'clinicStaff',
        id: clinicReq.user!.id,
        data: { authSync: { status: 'synced' } },
        context: { skipClinicStaffAuthSync: true },
        overrideAccess: true,
      })
    }
  })

  it('revalidates the current address on retry without redirecting prepared decision bytes', async () => {
    const source = await report()
    await decideInquiryModerationCase(moderatorReq, {
      caseId: source.caseId,
      category: 'other',
      outcome: 'no-action',
      reason: 'ForbiddenInternalReason',
    })
    const event = await decisionEvent(source.caseId)
    const operation = (await operations(event.id)).docs[0]!
    const adapter: DeliveryAdapter = { deliver: vi.fn<DeliveryAdapter['deliver']>(async () => ({ type: 'retryable' })) }
    await deliver(String(operation.id), adapter)
    expect(adapter.deliver).toHaveBeenCalledOnce()
    const before = (await operations(event.id)).docs[0]!
    const originalEmail = recipientEmail(patientReq)
    try {
      await payload.update({
        collection: 'patients',
        id: patientReq.user!.id,
        data: { email: `${prefix}-replacement-${patientIds.length}@example.test` },
        overrideAccess: true,
      })
      await deliver(String(operation.id), adapter, () => Date.parse(before.nextAttemptAt!) + 1)
      expect(adapter.deliver).toHaveBeenCalledOnce()
      expect((await operations(event.id)).docs[0]).toMatchObject({
        state: 'suppressed',
        preparedHtml: null,
        recipientAddress: null,
        commandPayload: null,
      })
    } finally {
      await payload.update({
        collection: 'patients',
        id: patientReq.user!.id,
        data: { email: originalEmail },
        overrideAccess: true,
      })
    }
  })

  it('detects moved clinic binding before now-ineligible clinic access', async () => {
    const source = await report(clinicReq)
    await decideInquiryModerationCase(moderatorReq, {
      caseId: source.caseId,
      category: 'other',
      outcome: 'no-action',
      reason: 'ForbiddenInternalReason',
    })
    const event = await decisionEvent(source.caseId)
    const operation = (await operations(event.id)).docs[0]!
    try {
      await payload.update({
        collection: 'clinicStaff',
        id: clinicReq.user!.id,
        data: { clinic: null },
        context: { skipClinicStaffAuthSync: true },
        overrideAccess: true,
      })
      const { delivery, logs } = await deliver(String(operation.id))
      expect(delivery.deliver).not.toHaveBeenCalled()
      expect(logs).toContainEqual(
        expect.objectContaining({ outcomeCode: 'recipient-changed', outboxState: 'suppressed' }),
      )
    } finally {
      await payload.update({
        collection: 'clinicStaff',
        id: clinicReq.user!.id,
        data: { clinic: clinicId },
        context: { skipClinicStaffAuthSync: true },
        overrideAccess: true,
      })
    }
  })

  it('delivers a decision for a closed but still readable Inquiry', async () => {
    const source = await report()
    const inquiry = await payload.findByID({
      collection: 'patientClinicInquiries',
      id: source.inquiryId,
      depth: 0,
      overrideAccess: true,
    })
    await updateClinicInquiryState(clinicReq, {
      action: 'close',
      inquiryId: source.inquiryId,
      expectedRevision: inquiry.revision ?? 0,
    })
    await decideInquiryModerationCase(moderatorReq, {
      caseId: source.caseId,
      category: 'other',
      outcome: 'no-action',
      reason: 'ForbiddenInternalReason',
    })
    const event = await decisionEvent(source.caseId)
    const operation = (await operations(event.id)).docs[0]!
    const { delivery } = await deliver(String(operation.id))
    expect(delivery.deliver).toHaveBeenCalledOnce()
  })

  it.each(['upheld', 'overturned'] as const)(
    'revalidates old decision statements after a later %s appeal decision',
    async (outcome) => {
      const source = await report()
      await decideInquiryModerationCase(moderatorReq, {
        caseId: source.caseId,
        category: 'other',
        outcome: 'conversation-restricted',
        reason: 'ForbiddenInternalReason',
        affectedActor: { kind: 'patient', id: String(patientReq.user!.id) },
      })
      const event = await decisionEvent(source.caseId)
      const operation = (await operations(event.id)).docs[0]!
      await submitInquiryModerationAppeal(patientReq, { caseId: source.caseId, text: 'ForbiddenAppealText' })
      await decideInquiryModerationAppeal(moderatorReq, {
        caseId: source.caseId,
        outcome,
        reason: 'ForbiddenAppealReason',
      })
      const { delivery, logs } = await deliver(String(operation.id))
      if (outcome === 'upheld') expect(delivery.deliver).toHaveBeenCalledOnce()
      else {
        expect(delivery.deliver).not.toHaveBeenCalled()
        expect(logs).toContainEqual(expect.objectContaining({ outcomeCode: 'superseded', outboxState: 'suppressed' }))
      }
    },
  )

  it('allows only the exact decision actor and deduplicates repeated command acceptance', async () => {
    const source = await report()
    await decideInquiryModerationCase(moderatorReq, {
      caseId: source.caseId,
      category: 'other',
      outcome: 'no-action',
      reason: 'ForbiddenInternalReason',
    })
    const event = await decisionEvent(source.caseId)
    const operation = (await operations(event.id)).docs[0]!
    for (const unauthorized of [patientReq, clinicReq, otherClinicReq, await createLocalReq({}, payload)])
      await expect(bindTransactionalEmail(unauthorized).accept(commandFor(event.id))).rejects.toMatchObject({
        code: 'access-denied',
      })
    await expect(bindTransactionalEmail(moderatorReq).accept(commandFor(event.id))).resolves.toMatchObject({
      operationId: String(operation.id),
      deduplicated: true,
    })
    await expect(bindTransactionalEmail(moderatorReq).accept(commandFor(event.id, 'affected'))).rejects.toMatchObject({
      code: 'source-missing',
    })
    expect((await operations(event.id)).docs).toHaveLength(1)
  })

  it('preserves normal domain decision without mail while Production activation is undeclared', async () => {
    const source = await report()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'production')
    await expect(
      decideInquiryModerationCase(moderatorReq, {
        caseId: source.caseId,
        category: 'other',
        outcome: 'no-action',
        reason: 'ForbiddenInternalReason',
      }),
    ).resolves.toEqual({ decided: true })
    const event = await decisionEvent(source.caseId)
    expect((await operations(event.id)).docs).toHaveLength(0)
  })

  it('rolls the first recipient operation and all domain effects back if accepting the second fanout slot fails', async () => {
    const source = await report(clinicReq)
    const before = await committedState(source.inquiryId)
    let operationsAttempted = 0
    await withBeforeHook(
      'transactionalEmailOutbox',
      async ({ data }) => {
        if (++operationsAttempted === 2) throw new Error('Synthetic second-recipient storage failure')
        return data
      },
      async () => {
        await expect(
          decideInquiryModerationCase(moderatorReq, {
            caseId: source.caseId,
            category: 'other',
            outcome: 'conversation-restricted',
            reason: 'ForbiddenInternalReason',
            affectedActor: { kind: 'patient', id: String(patientReq.user!.id) },
          }),
        ).rejects.toMatchObject({ kind: 'unavailable' })
      },
    )
    expect(operationsAttempted).toBe(2)
    expect(await committedState(source.inquiryId)).toEqual(before)
  })

  it.each(['delivery.suppressed', 'payload.scrubbed'] as const)(
    'rolls the valid domain decision and terminal operation back when %s cannot append',
    async (type) => {
      const source = await report(clinicReq)
      const before = await committedState(source.inquiryId)
      const hooks = payload.collections.inquiryModerationEvents.config.hooks
      const original = hooks.afterChange
      const loseEligibility: CollectionAfterChangeHook = async ({ doc, req }) => {
        if (doc.eventType === 'decision-recorded')
          await payload.update({
            collection: 'clinicStaff',
            id: clinicReq.user!.id,
            data: { authSync: { status: 'failed' } },
            context: { skipClinicStaffAuthSync: true },
            req,
            overrideAccess: true,
          })
        return doc
      }
      hooks.afterChange = [...(original ?? []), loseEligibility]
      try {
        await withBeforeHook(
          'transactionalEmailEvents',
          async ({ data }) => {
            if (data.type === type) throw new Error('Synthetic terminal event storage failure')
            return data
          },
          async () => {
            await expect(
              decideInquiryModerationCase(moderatorReq, {
                caseId: source.caseId,
                category: 'other',
                outcome: 'no-action',
                reason: 'ForbiddenInternalReason',
              }),
            ).rejects.toMatchObject({ kind: 'unavailable' })
          },
        )
        expect(await committedState(source.inquiryId)).toEqual(before)
        expect(
          (
            await payload.findByID({
              collection: 'clinicStaff',
              id: clinicReq.user!.id,
              depth: 0,
              overrideAccess: true,
            })
          ).authSync?.status,
        ).toBe('synced')
      } finally {
        hooks.afterChange = original
      }
    },
  )

  it('converges concurrent decisions on one immutable event and one logical recipient operation', async () => {
    const source = await report()
    const otherModeratorReq = await createLocalReq({}, payload)
    otherModeratorReq.user = moderatorReq.user
    const input = {
      caseId: source.caseId,
      category: 'other' as const,
      outcome: 'no-action' as const,
      reason: 'ForbiddenInternalReason',
    }
    const results = await Promise.allSettled([
      decideInquiryModerationCase(moderatorReq, input),
      decideInquiryModerationCase(otherModeratorReq, input),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const event = await decisionEvent(source.caseId)
    expect((await operations(event.id)).docs).toHaveLength(1)
    const state = await committedState(source.inquiryId)
    expect(state.events.filter((entry) => entry.eventType === 'decision-recorded')).toHaveLength(1)
  })
})

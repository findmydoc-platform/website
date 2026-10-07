import http from 'node:http'
import https from 'node:https'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type CollectionBeforeChangeHook, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import { createVerifiedPatientInquiry } from '@/features/inquiryCommunication/service'
import {
  createInquiryModerationReport,
  decideInquiryModerationCase,
  submitInquiryModerationAppeal,
} from '@/features/inquiryModeration/service'
import { runOwnedTransaction } from '@/features/transactionalEmail/transactions'
import { openStorageCapability } from '@/features/transactionalEmail/capability'
import { createTransactionalEmailWorker } from '@/features/transactionalEmail/worker'
import { bindTransactionalEmail } from '@/features/transactionalEmail/payloadIntegration'
import type { DeliveryAdapter } from '@/features/transactionalEmail/delivery'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import { cleanupTransactionalEmailFixtures } from '../fixtures/cleanupTransactionalEmailFixtures'
import {
  asClinicScopedPayloadUser,
  asPayloadPatientUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPatientTestUser,
  createPlatformTestUser,
} from '../fixtures/testUsers'

vi.mock('@payloadcms/storage-s3', () => ({ s3Storage: () => (incoming: unknown) => incoming }))

describe('authoritative moderation appeal receipt', () => {
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
  const prefix = testSlug('transactionalEmail.moderationAppeal.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const city = (await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })).docs[0]
    if (!city) throw new Error('Expected baseline city')
    const fixture = await createClinicFixture(payload, city.id, { slugPrefix: prefix })
    clinicId = fixture.clinic.id
    doctorId = fixture.doctor.id
    for (const other of [false, true]) {
      const staff = await createClinicTestUser(payload, {
        createdStaffIds: staffIds,
        emailPrefix: `${prefix}-${other}`,
      })
      const req = await createLocalReq({}, payload)
      req.user = await asClinicScopedPayloadUser(payload, staff, clinicId)
      if (other) otherClinicReq = req
      else clinicReq = req
    }
    const moderator = await createPlatformTestUser(payload, { createdStaffIds: staffIds, emailPrefix: `${prefix}-mod` })
    const authorized = await payload.update({
      collection: 'platformStaff',
      context: { trustedPlatformStaffOps: true },
      data: { capabilities: ['conversation-moderation'] },
      depth: 0,
      id: moderator.id,
      overrideAccess: true,
    })
    moderatorReq = await createLocalReq({}, payload)
    moderatorReq.user = { ...authorized, collection: 'platformStaff' } as never
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

  async function decidedCase(kind: 'patient' | 'clinic' = 'clinic') {
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
    ).docs[0]
    if (!conversation) throw new Error('Expected conversation')
    const report = await createInquiryModerationReport(kind === 'clinic' ? patientReq : clinicReq, {
      category: 'other',
      description: 'ForbiddenReportDescription',
      inquiryId: created.inquiry.id,
      idempotencyKey: `${prefix}-report-${inquiryIds.length}`,
      targetId: String(conversation.id),
      targetType: 'conversation',
    })
    await decideInquiryModerationCase(moderatorReq, {
      caseId: report.reportId,
      category: 'privacy-concern',
      outcome: 'conversation-restricted',
      reason: 'ForbiddenInternalReason',
      affectedActor: { kind, id: String((kind === 'clinic' ? clinicReq : patientReq).user!.id) },
    })
    for (const event of await events(report.reportId)) {
      if (event.eventType === 'report-received') references.push(`v1|moderation-event|${event.id}|reporter`)
      if (event.eventType === 'decision-recorded')
        references.push(`v1|moderation-event|${event.id}|reporter`, `v1|moderation-event|${event.id}|affected`)
    }
    return {
      caseId: report.reportId,
      inquiryId: created.inquiry.id,
      actorReq: kind === 'clinic' ? clinicReq : patientReq,
    }
  }

  async function events(caseId: string) {
    return (
      await payload.find({
        collection: 'inquiryModerationEvents',
        depth: 0,
        pagination: false,
        overrideAccess: true,
        sort: 'sequence',
        where: { moderationCase: { equals: caseId } },
      })
    ).docs
  }

  async function mail(reference: string) {
    return runOwnedTransaction(await createLocalReq({}, payload), async (_, transactionID) => {
      const capability = openStorageCapability(transactionID)
      try {
        const req = await createLocalReq(
          { context: capability.context, req: { transactionID: Promise.resolve(transactionID) } },
          payload,
        )
        const operations = await payload.find({
          collection: 'transactionalEmailOutbox',
          depth: 0,
          pagination: false,
          overrideAccess: true,
          req,
          where: { operationReference: { equals: reference } },
        })
        const audit = operations.docs.length
          ? await payload.find({
              collection: 'transactionalEmailEvents',
              depth: 0,
              pagination: false,
              overrideAccess: true,
              req,
              sort: 'sequence',
              where: { outbox: { in: operations.docs.map((operation) => operation.id) } },
            })
          : { docs: [] }
        return { operations: operations.docs, audit: audit.docs }
      } finally {
        capability.close()
      }
    })
  }

  async function appeal(source: Awaited<ReturnType<typeof decidedCase>>) {
    await submitInquiryModerationAppeal(source.actorReq, { caseId: source.caseId, text: 'ForbiddenAppealText' })
    const event = (await events(source.caseId)).find((event) => event.eventType === 'appeal-submitted')
    if (!event) throw new Error('Expected immutable appeal event')
    const reference = `v1|moderation-event|${event.id}|appellant`
    references.push(reference)
    const stored = await mail(reference)
    return { event, reference, stored }
  }

  async function deliver(operationId: number | string, adapter?: DeliveryAdapter, now?: () => number) {
    const delivery: DeliveryAdapter = adapter ?? {
      deliver: vi.fn<DeliveryAdapter['deliver']>(async () => ({ type: 'accepted', messageId: 'fake-appeal' })),
    }
    await createTransactionalEmailWorker(await createLocalReq({}, payload), {
      delivery,
      suppression: async () => 'cleared',
      now,
    }).run(String(operationId))
    return delivery
  }

  async function state(caseId: string) {
    const moderationCase = await payload.findByID({
      collection: 'inquiryModerationCases',
      depth: 0,
      id: caseId,
      overrideAccess: true,
    })
    const domainEvents = await events(caseId)
    const appealEvent = domainEvents.find((event) => event.eventType === 'appeal-submitted')
    const stored = appealEvent
      ? await mail(`v1|moderation-event|${appealEvent.id}|appellant`)
      : { operations: [], audit: [] }
    return { moderationCase, domainEvents, ...stored }
  }

  async function withBeforeHook<Result>(
    collection: 'transactionalEmailOutbox' | 'transactionalEmailEvents' | 'inquiryModerationEvents',
    hook: CollectionBeforeChangeHook,
    work: () => Promise<Result>,
  ): Promise<Result> {
    const hooks = payload.collections[collection].config.hooks
    const original = hooks.beforeChange
    hooks.beforeChange = [...(original ?? []), hook]
    try {
      return await work()
    } finally {
      hooks.beforeChange = original
    }
  }

  it('commits the exact clinic appellant receipt and delivers only its reviewed category through the fake worker', async () => {
    const source = await decidedCase()
    await expect(
      submitInquiryModerationAppeal(source.actorReq, { caseId: source.caseId, text: 'ForbiddenAppealText' }),
    ).resolves.toEqual({ submitted: true })
    const appeal = (await events(source.caseId)).find((event) => event.eventType === 'appeal-submitted')
    expect(appeal).toBeDefined()
    const reference = `v1|moderation-event|${appeal!.id}|appellant`
    references.push(reference)
    const stored = await mail(reference)
    expect(stored.operations).toHaveLength(1)
    expect(stored.audit.map((event) => event.type)).toEqual(['command.accepted'])
    const delivery: DeliveryAdapter = {
      deliver: vi.fn<DeliveryAdapter['deliver']>(async () => ({ type: 'accepted', messageId: 'fake-appeal' })),
    }
    await createTransactionalEmailWorker(await createLocalReq({}, payload), {
      delivery,
      suppression: async () => 'cleared',
    }).run(String(stored.operations[0]!.id))
    expect(delivery.deliver).toHaveBeenCalledOnce()
    const message = vi.mocked(delivery.deliver).mock.calls[0]![0]
    expect(message.subject).toBe('We received your appeal')
    expect(message.html).toContain(`https://dashboard.example.test/?inquiry=${source.inquiryId}`)
    expect(message.text).toContain('Privacy concern or wrong recipient')
    for (const forbidden of [
      'ForbiddenAppealText',
      'ForbiddenReportDescription',
      'ForbiddenHealthDetails',
      'ForbiddenInternalReason',
      'ForbiddenPatientName',
    ]) {
      expect(message.html).not.toContain(forbidden)
      expect(message.text).not.toContain(forbidden)
    }
  })

  it('delivers a patient appeal to that exact patient through its protected Inquiry target', async () => {
    const source = await decidedCase('patient')
    const { stored } = await appeal(source)
    const delivery = await deliver(stored.operations[0]!.id)
    const message = vi.mocked(delivery.deliver).mock.calls[0]![0]
    if (!patientReq.user || !('email' in patientReq.user)) throw new Error('Expected patient email')
    expect(message.recipientAddress).toBe(patientReq.user.email)
    expect(message.html).toContain(`https://website.example.test/patient/inquiries/${source.inquiryId}`)
    expect(message.text).toContain('Privacy concern or wrong recipient')
    expect(message.text).not.toContain('ForbiddenAppealText')
  })

  it('does not turn clinic-wide access or a foreign patient into the affected appellant', async () => {
    const source = await decidedCase()
    const before = await state(source.caseId)
    for (const req of [otherClinicReq, patientReq])
      await expect(
        submitInquiryModerationAppeal(req, { caseId: source.caseId, text: 'Foreign appeal' }),
      ).rejects.toMatchObject({ kind: 'not-found' })
    expect(await state(source.caseId)).toEqual(before)
    const { event, stored } = await appeal(source)
    await expect(
      bindTransactionalEmail(otherClinicReq).accept({
        type: 'moderation.appeal-received',
        moderationEventId: event.id,
        recipientSlot: 'appellant',
      }),
    ).rejects.toMatchObject({ code: 'access-denied' })
    expect((await state(source.caseId)).operations).toEqual(stored.operations)
  })

  it('rejects replay without creating a second appeal, audit or operation', async () => {
    const source = await decidedCase()
    await appeal(source)
    const before = await state(source.caseId)
    await expect(
      submitInquiryModerationAppeal(source.actorReq, { caseId: source.caseId, text: 'ForbiddenAppealText' }),
    ).rejects.toMatchObject({ kind: 'invalid-state' })
    expect(await state(source.caseId)).toEqual(before)
    expect(before.domainEvents.filter((event) => event.eventType === 'appeal-submitted')).toHaveLength(1)
    expect(before.operations).toHaveLength(1)
  })

  it('converges concurrent affected submissions on one appeal and one logical operation', async () => {
    const source = await decidedCase()
    const concurrentReq = await createLocalReq({}, payload)
    concurrentReq.user = source.actorReq.user
    const results = await Promise.allSettled(
      [source.actorReq, concurrentReq].map((req) =>
        submitInquiryModerationAppeal(req, { caseId: source.caseId, text: 'ForbiddenAppealText' }),
      ),
    )
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const observed = await state(source.caseId)
    const appealEvents = observed.domainEvents.filter((event) => event.eventType === 'appeal-submitted')
    expect(appealEvents).toHaveLength(1)
    references.push(`v1|moderation-event|${appealEvents[0]!.id}|appellant`)
    expect(observed.operations).toHaveLength(1)
    expect(observed.audit.map((event) => event.type)).toEqual(['command.accepted'])
  })

  it.each(['event', 'operation', 'first-event', 'commit'] as const)(
    'rolls the whole appeal back when %s fails unexpectedly',
    async (boundary) => {
      const source = await decidedCase()
      const before = await state(source.caseId)
      const submit = () =>
        submitInquiryModerationAppeal(source.actorReq, { caseId: source.caseId, text: 'ForbiddenAppealText' })
      const fail = () => {
        throw new Error('Synthetic storage failure')
      }
      if (boundary === 'commit') {
        const commit = vi.spyOn(payload.db, 'commitTransaction').mockImplementationOnce(fail)
        await expect(submit()).rejects.toMatchObject({ kind: 'unavailable' })
        commit.mockRestore()
      } else {
        await withBeforeHook(
          boundary === 'event'
            ? 'inquiryModerationEvents'
            : boundary === 'operation'
              ? 'transactionalEmailOutbox'
              : 'transactionalEmailEvents',
          fail,
          async () => {
            await expect(submit()).rejects.toMatchObject({ kind: 'unavailable' })
          },
        )
      }
      expect(await state(source.caseId)).toEqual(before)
    },
  )

  it.each([
    ['40001', 2],
    ['40P01', 2],
    ['40001', 3],
  ] as const)('retries the complete appeal callback for %s, bounded after %s conflicts', async (code, failures) => {
    const source = await decidedCase()
    const before = await state(source.caseId)
    let attempts = 0
    let caseWrites = 0
    const hooks = payload.collections.inquiryModerationCases.config.hooks
    const original = hooks.afterChange
    hooks.afterChange = [
      ...(original ?? []),
      async ({ doc }) => {
        if (doc.status === 'appealed') caseWrites++
        return doc
      },
    ]
    try {
      await withBeforeHook(
        'transactionalEmailEvents',
        ({ data }) => {
          if (data.type === 'command.accepted' && attempts++ < failures)
            throw Object.assign(new Error('Synthetic transaction conflict'), { code })
          return data
        },
        async () => {
          if (failures === 3)
            await expect(
              submitInquiryModerationAppeal(source.actorReq, { caseId: source.caseId, text: 'ForbiddenAppealText' }),
            ).rejects.toMatchObject({ kind: 'conflict' })
          else {
            const receipt = await appeal(source)
            expect(receipt.stored.operations).toHaveLength(1)
            expect(
              (await events(source.caseId)).filter((event) => event.eventType === 'appeal-submitted'),
            ).toHaveLength(1)
          }
        },
      )
      expect(caseWrites).toBe(3)
      expect(attempts).toBe(3)
      if (failures === 3) expect(await state(source.caseId)).toEqual(before)
    } finally {
      hooks.afterChange = original
    }
  })

  it('keeps its receipt and all appeal records invisible until the owner commits', async () => {
    const source = await decidedCase()
    const before = await state(source.caseId)
    let release!: () => void
    let entered!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const reached = new Promise<void>((resolve) => {
      entered = resolve
    })
    const commit = payload.db.commitTransaction.bind(payload.db)
    vi.spyOn(payload.db, 'commitTransaction').mockImplementationOnce(async (transactionID) => {
      entered()
      await gate
      await commit(transactionID)
    })
    let returned = false
    const pending = submitInquiryModerationAppeal(source.actorReq, {
      caseId: source.caseId,
      text: 'ForbiddenAppealText',
    }).then((receipt) => {
      returned = true
      return receipt
    })
    await reached
    try {
      expect(returned).toBe(false)
      expect(await state(source.caseId)).toEqual(before)
    } finally {
      release()
    }
    await expect(pending).resolves.toEqual({ submitted: true })
    const observed = await state(source.caseId)
    expect(observed.moderationCase.status).toBe('appealed')
    const event = observed.domainEvents.find((event) => event.eventType === 'appeal-submitted')!
    references.push(`v1|moderation-event|${event.id}|appellant`)
    expect(observed.operations).toHaveLength(1)
  })

  it('does not roll a committed appeal back after a later provider failure', async () => {
    const source = await decidedCase()
    const { stored } = await appeal(source)
    const before = await state(source.caseId)
    await deliver(stored.operations[0]!.id, {
      deliver: vi.fn<DeliveryAdapter['deliver']>(async () => ({ type: 'permanent' })),
    })
    const after = await state(source.caseId)
    expect(after.moderationCase).toEqual(before.moderationCase)
    expect(after.domainEvents).toEqual(before.domainEvents)
    expect(after.operations[0]!.state).toBe('failed')
  })

  it.each(['missing-address', 'access-lost'] as const)(
    'commits a scrubbed terminal receipt when %s is observed in the same appeal transaction',
    async (loss) => {
      const source = await decidedCase()
      const staff = await payload.findByID({
        collection: 'clinicStaff',
        id: clinicReq.user!.id,
        depth: 0,
        overrideAccess: true,
      })
      const hooks = payload.collections.inquiryModerationEvents.config.hooks
      const original = hooks.afterChange
      hooks.afterChange = [
        ...(original ?? []),
        async ({ doc, req }) => {
          if (doc.eventType === 'appeal-submitted')
            await payload.update({
              collection: 'clinicStaff',
              id: staff.id,
              data: loss === 'missing-address' ? { email: null } : { authSync: { status: 'failed' } },
              overrideAccess: true,
              context: { skipClinicStaffAuthSync: true },
              req,
            })
          return doc
        },
      ]
      try {
        const { stored } = await appeal(source)
        expect(stored.operations).toHaveLength(1)
        expect(stored.operations[0]).toMatchObject({
          state: 'suppressed',
          attemptCount: 0,
          commandPayload: null,
          recipientAddress: null,
          latestEventSequence: 3,
        })
        expect(stored.audit.map((event) => [event.type, event.source])).toEqual([
          ['command.accepted', 'command'],
          ['delivery.suppressed', 'command'],
          ['payload.scrubbed', 'command'],
        ])
        expect(stored.audit[1]!.outcomeCode).toBe('ineligible')
        expect((await state(source.caseId)).moderationCase.status).toBe('appealed')
        expect((await deliver(stored.operations[0]!.id)).deliver).not.toHaveBeenCalled()
      } finally {
        hooks.afterChange = original
        await payload.update({
          collection: 'clinicStaff',
          id: staff.id,
          data: { email: staff.email, authSync: staff.authSync },
          overrideAccess: true,
          context: { skipClinicStaffAuthSync: true },
        })
      }
    },
  )

  it.each(['delivery.suppressed', 'payload.scrubbed'] as const)(
    'rolls the appeal and expected terminal acceptance back when %s storage fails',
    async (type) => {
      const source = await decidedCase()
      const before = await state(source.caseId)
      const hooks = payload.collections.inquiryModerationEvents.config.hooks
      const original = hooks.afterChange
      hooks.afterChange = [
        ...(original ?? []),
        async ({ doc, req }) => {
          if (doc.eventType === 'appeal-submitted')
            await payload.update({
              collection: 'clinicStaff',
              id: clinicReq.user!.id,
              data: { authSync: { status: 'failed' } },
              overrideAccess: true,
              context: { skipClinicStaffAuthSync: true },
              req,
            })
          return doc
        },
      ]
      try {
        await withBeforeHook(
          'transactionalEmailEvents',
          ({ data }) => {
            if (data.type === type) throw new Error('Synthetic terminal event failure')
            return data
          },
          async () => {
            await expect(
              submitInquiryModerationAppeal(source.actorReq, { caseId: source.caseId, text: 'ForbiddenAppealText' }),
            ).rejects.toMatchObject({ kind: 'unavailable' })
          },
        )
        expect(await state(source.caseId)).toEqual(before)
        expect(
          (await payload.findByID({ collection: 'clinicStaff', id: clinicReq.user!.id, overrideAccess: true })).authSync
            ?.status,
        ).toBe('synced')
      } finally {
        hooks.afterChange = original
      }
    },
  )

  it.each(['missing-address', 'access-lost', 'binding-changed'] as const)(
    'suppresses %s before preparation without substituting another clinic identity',
    async (loss) => {
      const source = await decidedCase()
      const { stored, reference } = await appeal(source)
      const staff = await payload.findByID({
        collection: 'clinicStaff',
        id: clinicReq.user!.id,
        depth: 0,
        overrideAccess: true,
      })
      try {
        await payload.update({
          collection: 'clinicStaff',
          id: staff.id,
          data:
            loss === 'missing-address'
              ? { email: null }
              : loss === 'access-lost'
                ? { authSync: { status: 'failed' } }
                : { clinic: null },
          overrideAccess: true,
          context: { skipClinicStaffAuthSync: true },
        })
        const delivery = await deliver(stored.operations[0]!.id)
        expect(delivery.deliver).not.toHaveBeenCalled()
        const observed = await mail(reference)
        expect(observed.operations[0]).toMatchObject({
          state: 'suppressed',
          recipientAddress: null,
          commandPayload: null,
        })
        expect(observed.audit.find((event) => event.type === 'delivery.suppressed')!.outcomeCode).toBe(
          loss === 'binding-changed' ? 'recipient-changed' : 'ineligible',
        )
      } finally {
        await payload.update({
          collection: 'clinicStaff',
          id: staff.id,
          data: { email: staff.email, clinic: staff.clinic, authSync: staff.authSync },
          overrideAccess: true,
          context: { skipClinicStaffAuthSync: true },
        })
      }
    },
  )

  it('never redirects a patient receipt when its address changes between provider attempts', async () => {
    const source = await decidedCase('patient')
    const { stored, reference } = await appeal(source)
    const timestamp = Date.now()
    const first: DeliveryAdapter = { deliver: vi.fn<DeliveryAdapter['deliver']>(async () => ({ type: 'retryable' })) }
    await deliver(stored.operations[0]!.id, first, () => timestamp)
    expect(first.deliver).toHaveBeenCalledOnce()
    await payload.update({
      collection: 'patients',
      id: patientReq.user!.id,
      data: { email: `${prefix}-changed@example.test` },
      overrideAccess: true,
    })
    const later = await deliver(stored.operations[0]!.id, undefined, () => timestamp + 61_000)
    expect(later.deliver).not.toHaveBeenCalled()
    const observed = await mail(reference)
    expect(observed.operations[0]!.state).toBe('suppressed')
    expect(observed.audit.find((event) => event.type === 'delivery.suppressed')!.outcomeCode).toBe('recipient-changed')
  })

  it('suppresses an unavailable immutable appeal source before delivery', async () => {
    const source = await decidedCase('patient')
    const { event, reference, stored } = await appeal(source)
    await payload.delete({ collection: 'inquiryModerationEvents', id: event.id, overrideAccess: true })
    expect((await deliver(stored.operations[0]!.id)).deliver).not.toHaveBeenCalled()
    expect((await mail(reference)).audit.find((entry) => entry.type === 'delivery.suppressed')!.outcomeCode).toBe(
      'source-unavailable',
    )
  })
})

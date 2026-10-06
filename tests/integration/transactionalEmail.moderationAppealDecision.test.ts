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
  decideInquiryModerationAppeal,
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

describe('authoritative moderation appeal decision', () => {
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
  const prefix = testSlug('transactionalEmail.moderationAppealDecision.test.ts')

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
    vi.useRealTimers()
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

  async function decidedCase(
    kind: 'patient' | 'clinic' = 'clinic',
    options: {
      sameIdentity?: boolean
      effectiveUntil?: string
      appellantReq?: PayloadRequest
      reporterReq?: PayloadRequest
    } = {},
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
    ).docs[0]
    if (!conversation) throw new Error('Expected conversation')
    const actorReq = options.appellantReq ?? (kind === 'clinic' ? clinicReq : patientReq)
    const reporterReq =
      options.reporterReq ?? (options.sameIdentity ? actorReq : kind === 'clinic' ? patientReq : clinicReq)
    const report = await createInquiryModerationReport(reporterReq, {
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
      affectedActor: { kind, id: String(actorReq.user!.id) },
      effectiveUntil: options.effectiveUntil,
    })
    for (const event of await events(report.reportId)) {
      if (event.eventType === 'report-received') references.push(`v1|moderation-event|${event.id}|reporter`)
      if (event.eventType === 'decision-recorded')
        references.push(`v1|moderation-event|${event.id}|reporter`, `v1|moderation-event|${event.id}|affected`)
    }
    return {
      caseId: report.reportId,
      inquiryId: created.inquiry.id,
      actorReq,
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

  async function pendingCase(
    kind: 'patient' | 'clinic' = 'clinic',
    options: {
      sameIdentity?: boolean
      effectiveUntil?: string
      appellantReq?: PayloadRequest
      reporterReq?: PayloadRequest
    } = {},
  ) {
    const source = await decidedCase(kind, options)
    const submitted = await appeal(source)
    return { ...source, receipt: submitted }
  }

  async function decide(source: Awaited<ReturnType<typeof pendingCase>>, outcome: 'upheld' | 'overturned' = 'upheld') {
    await decideInquiryModerationAppeal(moderatorReq, {
      caseId: source.caseId,
      outcome,
      reason: 'ForbiddenAppealDecisionReason',
    })
    const event = (await events(source.caseId)).find((event) => event.eventType === 'appeal-decided')
    if (!event) throw new Error('Expected immutable appeal decision')
    const appellantReference = `v1|moderation-event|${event.id}|appellant`
    const reporterReference = `v1|moderation-event|${event.id}|reporter`
    references.push(appellantReference, reporterReference)
    return {
      event,
      appellantReference,
      reporterReference,
      appellant: await mail(appellantReference),
      reporter: await mail(reporterReference),
    }
  }

  async function snapshot(source: Awaited<ReturnType<typeof pendingCase>>) {
    const moderationCase = await payload.findByID({
      collection: 'inquiryModerationCases',
      id: source.caseId,
      depth: 0,
      overrideAccess: true,
    })
    const domainEvents = await events(source.caseId)
    const inquiry = await payload.findByID({
      collection: 'patientClinicInquiries',
      id: source.inquiryId,
      depth: 0,
      overrideAccess: true,
    })
    const activity = (
      await payload.find({
        collection: 'inquiryAuditEvents',
        depth: 0,
        pagination: false,
        overrideAccess: true,
        sort: 'sequence',
        where: { inquiry: { equals: source.inquiryId } },
      })
    ).docs
    const final = domainEvents.find((event) => event.eventType === 'appeal-decided')
    return {
      moderationCase,
      domainEvents,
      inquiry,
      activity,
      appellant: final ? await mail(`v1|moderation-event|${final.id}|appellant`) : null,
      reporter: final ? await mail(`v1|moderation-event|${final.id}|reporter`) : null,
    }
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

  const decisionInput = (source: Awaited<ReturnType<typeof pendingCase>>) => ({
    caseId: source.caseId,
    outcome: 'overturned' as const,
    reason: 'ForbiddenAppealDecisionReason',
  })

  it.each(['event', 'operation', 'first-event', 'second-recipient', 'commit'] as const)(
    'rolls back the full final decision and fanout on unexpected %s failure',
    async (boundary) => {
      const source = await pendingCase()
      const before = await snapshot(source)
      const submit = () => decideInquiryModerationAppeal(moderatorReq, decisionInput(source))
      const fail = () => {
        throw new Error('Synthetic final decision storage failure')
      }
      if (boundary === 'commit') {
        const fault = vi.spyOn(payload.db, 'commitTransaction').mockImplementationOnce(fail)
        try {
          await expect(submit()).rejects.toMatchObject({ kind: 'unavailable' })
        } finally {
          fault.mockRestore()
        }
      } else {
        let writes = 0
        await withBeforeHook(
          boundary === 'event'
            ? 'inquiryModerationEvents'
            : boundary === 'first-event'
              ? 'transactionalEmailEvents'
              : 'transactionalEmailOutbox',
          ({ data }) => {
            if (boundary !== 'second-recipient' || ++writes === 2) fail()
            return data
          },
          async () => {
            await expect(submit()).rejects.toMatchObject({ kind: 'unavailable' })
          },
        )
      }
      expect(await snapshot(source)).toEqual(before)
    },
  )

  it.each([
    ['40001', 2],
    ['40P01', 2],
    ['40001', 3],
  ] as const)('repeats the complete final decision for %s and stops after %s conflicts', async (code, failures) => {
    const source = await pendingCase()
    const before = await snapshot(source)
    let writes = 0
    const hooks = payload.collections.inquiryModerationCases.config.hooks
    const original = hooks.afterChange
    hooks.afterChange = [
      ...(original ?? []),
      async ({ doc }) => {
        if (doc.appealOutcome === 'overturned') writes++
        return doc
      },
    ]
    try {
      await withBeforeHook(
        'transactionalEmailEvents',
        ({ data }) => {
          if (data.type === 'command.accepted' && writes <= failures)
            throw Object.assign(new Error('Synthetic complete callback conflict'), { code })
          return data
        },
        async () => {
          if (failures === 3)
            await expect(decideInquiryModerationAppeal(moderatorReq, decisionInput(source))).rejects.toMatchObject({
              kind: 'conflict',
            })
          else {
            const result = await decide(source, 'overturned')
            expect(result.appellant.operations).toHaveLength(1)
            expect(result.reporter.operations).toHaveLength(1)
            expect((await events(source.caseId)).filter((event) => event.eventType === 'appeal-decided')).toHaveLength(
              1,
            )
          }
        },
      )
      expect(writes).toBe(3)
      if (failures === 3) expect(await snapshot(source)).toEqual(before)
    } finally {
      hooks.afterChange = original
    }
  })

  it('rejects replay without changing the final decision or either operation', async () => {
    const source = await pendingCase()
    await decide(source)
    const before = await snapshot(source)
    await expect(decideInquiryModerationAppeal(moderatorReq, decisionInput(source))).rejects.toMatchObject({
      kind: 'invalid-state',
    })
    expect(await snapshot(source)).toEqual(before)
  })

  it('converges concurrent final decisions on one event and one operation per exact participant', async () => {
    const source = await pendingCase()
    const results = await Promise.allSettled(
      [1, 2].map(() => decideInquiryModerationAppeal(moderatorReq, decisionInput(source))),
    )
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    const current = await snapshot(source)
    expect(current.domainEvents.filter((event) => event.eventType === 'appeal-decided')).toHaveLength(1)
    expect(current.appellant!.operations).toHaveLength(1)
    expect(current.reporter!.operations).toHaveLength(1)
    const event = current.domainEvents.find((event) => event.eventType === 'appeal-decided')!
    references.push(`v1|moderation-event|${event.id}|appellant`, `v1|moderation-event|${event.id}|reporter`)
  })

  async function withClinicLoss<Result>(loss: 'missing-address' | 'access-lost', work: () => Promise<Result>) {
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
        if (doc.eventType === 'appeal-decided')
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
      return await work()
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
  }

  it.each([
    ['appellant', 'missing-address'],
    ['appellant', 'access-lost'],
    ['reporter', 'missing-address'],
    ['reporter', 'access-lost'],
  ] as const)(
    'commits the final decision with terminal %s %s and leaves the other exact participant deliverable',
    async (slot, loss) => {
      const source = await pendingCase(slot === 'appellant' ? 'clinic' : 'patient')
      await withClinicLoss(loss, async () => {
        const result = await decide(source)
        const terminal = slot === 'appellant' ? result.appellant : result.reporter
        const eligible = slot === 'appellant' ? result.reporter : result.appellant
        expect((await snapshot(source)).moderationCase.status).toBe('resolved')
        expect(terminal.operations[0]).toMatchObject({
          state: 'suppressed',
          attemptCount: 0,
          commandPayload: null,
          recipientAddress: null,
          latestEventSequence: 3,
        })
        expect(terminal.audit.map((event) => [event.type, event.source])).toEqual([
          ['command.accepted', 'command'],
          ['delivery.suppressed', 'command'],
          ['payload.scrubbed', 'command'],
        ])
        expect(terminal.audit[1]!.outcomeCode).toBe('ineligible')
        expect((await deliver(terminal.operations[0]!.id)).deliver).not.toHaveBeenCalled()
        expect((await deliver(eligible.operations[0]!.id)).deliver).toHaveBeenCalledOnce()
      })
    },
  )

  it.each(['delivery.suppressed', 'payload.scrubbed'] as const)(
    'rolls back the final decision, first fanout and native eligibility mutation when terminal %s storage fails',
    async (type) => {
      const source = await pendingCase('patient')
      const before = await snapshot(source)
      await withClinicLoss('access-lost', async () => {
        await withBeforeHook(
          'transactionalEmailEvents',
          ({ data }) => {
            if (data.type === type) throw new Error('Synthetic final terminal event failure')
            return data
          },
          async () => {
            await expect(decideInquiryModerationAppeal(moderatorReq, decisionInput(source))).rejects.toMatchObject({
              kind: 'unavailable',
            })
          },
        )
        expect(await snapshot(source)).toEqual(before)
        expect(
          (await payload.findByID({ collection: 'clinicStaff', id: clinicReq.user!.id, overrideAccess: true })).authSync
            ?.status,
        ).toBe('synced')
      })
    },
  )

  it.each(['missing-address', 'access-lost', 'binding-changed'] as const)(
    'revalidates current clinic %s before preparing its final decision without substituting staff',
    async (loss) => {
      const source = await pendingCase()
      const result = await decide(source)
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
        expect((await deliver(result.appellant.operations[0]!.id)).deliver).not.toHaveBeenCalled()
        const stored = await mail(result.appellantReference)
        expect(stored.operations[0]).toMatchObject({
          state: 'suppressed',
          recipientAddress: null,
          commandPayload: null,
        })
        expect(stored.audit).toContainEqual(
          expect.objectContaining({
            type: 'delivery.suppressed',
            outcomeCode: loss === 'binding-changed' ? 'recipient-changed' : 'ineligible',
          }),
        )
        expect((await deliver(result.reporter.operations[0]!.id)).deliver).toHaveBeenCalledOnce()
      } finally {
        await payload.update({
          collection: 'clinicStaff',
          id: staff.id,
          data: { clinic: staff.clinic, email: staff.email, authSync: staff.authSync },
          overrideAccess: true,
          context: { skipClinicStaffAuthSync: true },
        })
      }
    },
  )

  it('never redirects a prepared patient final decision when its address changes between provider attempts', async () => {
    const source = await pendingCase('patient')
    const result = await decide(source, 'overturned')
    const timestamp = Date.now()
    const adapter: DeliveryAdapter = { deliver: vi.fn<DeliveryAdapter['deliver']>(async () => ({ type: 'retryable' })) }
    await deliver(result.appellant.operations[0]!.id, adapter, () => timestamp)
    expect(adapter.deliver).toHaveBeenCalledOnce()
    await payload.update({
      collection: 'patients',
      id: patientReq.user!.id,
      data: { email: `${prefix}-changed@example.test` },
      overrideAccess: true,
    })
    await deliver(result.appellant.operations[0]!.id, adapter, () => timestamp + 61_000)
    expect(adapter.deliver).toHaveBeenCalledOnce()
    expect((await mail(result.appellantReference)).audit).toContainEqual(
      expect.objectContaining({ type: 'delivery.suppressed', outcomeCode: 'recipient-changed' }),
    )
  })

  it('suppresses a missing immutable final event before either provider call', async () => {
    const source = await pendingCase()
    const result = await decide(source)
    await payload.delete({ collection: 'inquiryModerationEvents', id: result.event.id, overrideAccess: true })
    for (const [stored, reference] of [
      [result.appellant, result.appellantReference],
      [result.reporter, result.reporterReference],
    ] as const) {
      expect((await deliver(stored.operations[0]!.id)).deliver).not.toHaveBeenCalled()
      expect((await mail(reference)).audit).toContainEqual(
        expect.objectContaining({ type: 'delivery.suppressed', outcomeCode: 'source-unavailable' }),
      )
    }
  })

  it('allows only the exact authorized platform decision actor and deduplicates both recipient commands', async () => {
    const source = await pendingCase()
    const result = await decide(source)
    for (const recipientSlot of ['appellant', 'reporter'] as const) {
      const command = {
        type: 'moderation.appeal-decided' as const,
        moderationEventId: Number(result.event.id),
        recipientSlot,
      }
      for (const unauthorized of [patientReq, clinicReq, otherClinicReq, await createLocalReq({}, payload)])
        await expect(bindTransactionalEmail(unauthorized).accept(command)).rejects.toMatchObject({
          code: 'access-denied',
        })
      const stored = recipientSlot === 'appellant' ? result.appellant : result.reporter
      await expect(bindTransactionalEmail(moderatorReq).accept(command)).resolves.toMatchObject({
        operationId: String(stored.operations[0]!.id),
        deduplicated: true,
      })
      expect(
        (await mail(recipientSlot === 'appellant' ? result.appellantReference : result.reporterReference)).operations,
      ).toHaveLength(1)
    }
  })

  it.each(['upheld', 'overturned', 'ended'] as const)(
    'supersedes only earlier initial statements contradicted by a final %s outcome',
    async (outcome) => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2027-04-10T10:00:00Z'))
      const source = await pendingCase('clinic', { effectiveUntil: '2027-04-10T11:00:00Z' })
      const initial = (await events(source.caseId)).find((event) => event.eventType === 'decision-recorded')!
      const reporterReference = `v1|moderation-event|${initial.id}|reporter`
      const affectedReference = `v1|moderation-event|${initial.id}|affected`
      const earlierReporter = await mail(reporterReference)
      const earlierAffected = await mail(affectedReference)
      if (outcome === 'ended') vi.setSystemTime(new Date('2027-04-10T12:00:00Z'))
      const result = await decide(source, outcome === 'overturned' ? 'overturned' : 'upheld')
      const reporter = await deliver(earlierReporter.operations[0]!.id)
      const affected = await deliver(earlierAffected.operations[0]!.id)
      if (outcome === 'overturned') {
        expect(reporter.deliver).not.toHaveBeenCalled()
        expect((await mail(reporterReference)).audit).toContainEqual(
          expect.objectContaining({ type: 'delivery.suppressed', outcomeCode: 'superseded' }),
        )
      } else expect(reporter.deliver).toHaveBeenCalledOnce()
      if (outcome !== 'upheld') {
        expect(affected.deliver).not.toHaveBeenCalled()
        expect((await mail(affectedReference)).audit).toContainEqual(
          expect.objectContaining({ type: 'delivery.suppressed', outcomeCode: 'superseded' }),
        )
      } else expect(affected.deliver).toHaveBeenCalledOnce()
      expect((await deliver(result.appellant.operations[0]!.id)).deliver).toHaveBeenCalledOnce()
      expect((await deliver(result.reporter.operations[0]!.id)).deliver).toHaveBeenCalledOnce()
    },
  )

  it('never recalls provider-accepted initial decision operations after overturning the measure', async () => {
    const source = await pendingCase()
    const initial = (await events(source.caseId)).find((event) => event.eventType === 'decision-recorded')!
    const accepted = []
    for (const slot of ['affected', 'reporter'] as const) {
      const reference = `v1|moderation-event|${initial.id}|${slot}`
      const operation = (await mail(reference)).operations[0]!
      const adapter = await deliver(operation.id)
      accepted.push({ reference, operation, adapter, before: await mail(reference) })
    }
    const result = await decide(source, 'overturned')
    for (const { reference, operation, adapter, before } of accepted) {
      await deliver(operation.id, adapter)
      expect(adapter.deliver).toHaveBeenCalledOnce()
      expect(await mail(reference)).toEqual(before)
    }
    expect(result.appellant.operations[0]!.id).not.toBe(accepted[0]!.operation.id)
    expect((await deliver(result.appellant.operations[0]!.id)).deliver).toHaveBeenCalledOnce()
  })

  it('retains an ambiguous earlier receipt audit but never retries its now-superseded content', async () => {
    const source = await pendingCase()
    const timestamp = Date.now()
    const adapter: DeliveryAdapter = {
      deliver: vi.fn<DeliveryAdapter['deliver']>(async () => ({
        type: 'ambiguous',
        outcomeCode: 'provider-ambiguous',
      })),
    }
    const operation = source.receipt.stored.operations[0]!
    await deliver(operation.id, adapter, () => timestamp)
    const result = await decide(source)
    await deliver(operation.id, adapter, () => timestamp + 61_000)
    expect(adapter.deliver).toHaveBeenCalledOnce()
    const stored = await mail(source.receipt.reference)
    expect(stored.audit).toContainEqual(expect.objectContaining({ type: 'delivery.ambiguous' }))
    expect(stored.audit).toContainEqual(
      expect.objectContaining({ type: 'delivery.suppressed', outcomeCode: 'superseded' }),
    )
    expect(stored.operations[0]).toMatchObject({
      state: 'suppressed',
      commandPayload: null,
      recipientAddress: null,
      preparedHtml: null,
    })
    expect((await deliver(result.appellant.operations[0]!.id)).deliver).toHaveBeenCalledOnce()
  })

  it('exposes neither the final decision nor either mail receipt before the shared owner commits', async () => {
    const source = await pendingCase()
    const before = await snapshot(source)
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
    const pending = decide(source, 'overturned').then((result) => {
      returned = true
      return result
    })
    await reached
    try {
      expect(returned).toBe(false)
      expect(await snapshot(source)).toEqual(before)
    } finally {
      release()
    }
    const result = await pending
    expect(result.appellant.operations).toHaveLength(1)
    expect(result.reporter.operations).toHaveLength(1)
    expect((await snapshot(source)).moderationCase.appealOutcome).toBe('overturned')
  })

  it('keeps the committed final domain outcome after a later permanent provider failure', async () => {
    const source = await pendingCase()
    const result = await decide(source)
    const before = await snapshot(source)
    const adapter: DeliveryAdapter = {
      deliver: vi.fn<DeliveryAdapter['deliver']>(async () => ({
        type: 'permanent',
        outcomeCode: 'provider-policy-rejected',
      })),
    }
    await deliver(result.appellant.operations[0]!.id, adapter)
    expect((await mail(result.appellantReference)).operations[0]!.state).toBe('failed')
    const after = await snapshot(source)
    expect(after.moderationCase).toEqual(before.moderationCase)
    expect(after.domainEvents).toEqual(before.domainEvents)
    expect(after.inquiry).toEqual(before.inquiry)
    expect(after.activity).toEqual(before.activity)
    expect((await deliver(result.reporter.operations[0]!.id)).deliver).toHaveBeenCalledOnce()
  })

  it.each(['preview', 'production'] as const)(
    'preserves the normal domain decision while %s moderation activation is undeclared',
    async (environment) => {
      const source = await pendingCase()
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('VERCEL_ENV', environment)
      vi.stubEnv('DEPLOYMENT_ENV', environment)
      vi.stubEnv('CI', 'false')
      const result = await decide(source)
      expect((await snapshot(source)).moderationCase.status).toBe('resolved')
      expect(result.appellant.operations).toHaveLength(0)
      expect(result.reporter.operations).toHaveLength(0)
    },
  )

  it('commits a final decision after its exact clinic appellant is deleted without inventing a replacement recipient', async () => {
    const staff = await createClinicTestUser(payload, {
      createdStaffIds: staffIds,
      emailPrefix: `${prefix}-deleted-appellant`,
    })
    const deletedReq = await createLocalReq({}, payload)
    deletedReq.user = await asClinicScopedPayloadUser(payload, staff, clinicId)
    const source = await pendingCase('clinic', { appellantReq: deletedReq })
    await payload.delete({ collection: 'clinicStaff', id: staff.id, overrideAccess: true })
    const result = await decide(source, 'overturned')
    expect((await snapshot(source)).moderationCase.status).toBe('resolved')
    const terminal = result.appellant
    expect(terminal.operations).toHaveLength(1)
    expect(terminal.operations[0]).toMatchObject({
      state: 'suppressed',
      attemptCount: 0,
      commandPayload: null,
      recipientAddress: null,
    })
    expect(terminal.audit).toContainEqual(
      expect.objectContaining({ type: 'delivery.suppressed', outcomeCode: 'ineligible' }),
    )
    expect((await deliver(terminal.operations[0]!.id)).deliver).not.toHaveBeenCalled()
    expect((await deliver(result.reporter.operations[0]!.id)).deliver).toHaveBeenCalledOnce()
  })

  it.each(['reporter', 'same-identity'] as const)(
    'preserves the existing domain rollback when its exact clinic %s is deleted before the final decision',
    async (slot) => {
      const staff = await createClinicTestUser(payload, {
        createdStaffIds: staffIds,
        emailPrefix: `${prefix}-deleted-before-${slot}`,
      })
      const deletedReq = await createLocalReq({}, payload)
      deletedReq.user = await asClinicScopedPayloadUser(payload, staff, clinicId)
      const source = await pendingCase(slot === 'reporter' ? 'patient' : 'clinic', {
        sameIdentity: slot === 'same-identity',
        ...(slot === 'reporter' ? { reporterReq: deletedReq } : { appellantReq: deletedReq }),
      })
      await payload.delete({ collection: 'clinicStaff', id: staff.id, overrideAccess: true })
      const before = await snapshot(source)
      await expect(decideInquiryModerationAppeal(moderatorReq, decisionInput(source))).rejects.toMatchObject({
        kind: 'unavailable',
      })
      expect(await snapshot(source)).toEqual(before)
      expect((await events(source.caseId)).filter((event) => event.eventType === 'appeal-decided')).toHaveLength(0)
    },
  )

  it('supersedes the unaccepted appeal receipt after its final decision without provider activity', async () => {
    const source = await pendingCase()
    const result = await decide(source)
    const delivery = await deliver(source.receipt.stored.operations[0]!.id)
    expect(delivery.deliver).not.toHaveBeenCalled()
    const receipt = await mail(source.receipt.reference)
    expect(receipt.operations[0]).toMatchObject({
      state: 'suppressed',
      recipientAddress: null,
      commandPayload: null,
      preparedHtml: null,
    })
    expect(receipt.audit).toContainEqual(
      expect.objectContaining({ type: 'delivery.suppressed', outcomeCode: 'superseded' }),
    )
    const currentDelivery = await deliver(result.appellant.operations[0]!.id)
    expect(currentDelivery.deliver).toHaveBeenCalledOnce()
  })

  it.each(['reporter', 'same-identity'] as const)(
    'suppresses a queued final notification when its exact clinic %s is subsequently deleted',
    async (slot) => {
      const staff = await createClinicTestUser(payload, {
        createdStaffIds: staffIds,
        emailPrefix: `${prefix}-deleted-after-${slot}`,
      })
      const deletedReq = await createLocalReq({}, payload)
      deletedReq.user = await asClinicScopedPayloadUser(payload, staff, clinicId)
      const source = await pendingCase(slot === 'reporter' ? 'patient' : 'clinic', {
        sameIdentity: slot === 'same-identity',
        ...(slot === 'reporter' ? { reporterReq: deletedReq } : { appellantReq: deletedReq }),
      })
      const result = await decide(source, 'overturned')
      await payload.delete({ collection: 'clinicStaff', id: staff.id, overrideAccess: true })
      const target = slot === 'reporter' ? result.reporter : result.appellant
      expect((await deliver(target.operations[0]!.id)).deliver).not.toHaveBeenCalled()
      const terminal = await mail(slot === 'reporter' ? result.reporterReference : result.appellantReference)
      expect(terminal.operations[0]).toMatchObject({
        state: 'suppressed',
        attemptCount: 0,
        commandPayload: null,
        recipientAddress: null,
        preparedHtml: null,
        preparedText: null,
      })
      expect(terminal.audit).toContainEqual(
        expect.objectContaining({ type: 'delivery.suppressed', outcomeCode: 'ineligible' }),
      )
      if (slot === 'same-identity') expect(result.reporter.operations).toHaveLength(0)
      else expect((await deliver(result.appellant.operations[0]!.id)).deliver).toHaveBeenCalledOnce()
    },
  )

  it('preserves an accepted appeal receipt and never recalls it after the final decision', async () => {
    const source = await pendingCase()
    const receiptId = source.receipt.stored.operations[0]!.id
    const delivery = await deliver(receiptId)
    const before = await mail(source.receipt.reference)
    expect(before.operations[0]).toMatchObject({ state: 'accepted', recipientAddress: null, commandPayload: null })
    const result = await decide(source, 'overturned')
    await deliver(receiptId, delivery)
    expect(delivery.deliver).toHaveBeenCalledOnce()
    expect(await mail(source.receipt.reference)).toEqual(before)
    expect(result.appellant.operations[0]!.id).not.toBe(receiptId)
    const current = await deliver(result.appellant.operations[0]!.id)
    expect(vi.mocked(current.deliver).mock.calls[0]![0].text).toContain('Restriction lifted')
  })

  it.each([
    ['patient', 'upheld', 'Restriction remains', 'Action taken'],
    ['clinic', 'upheld', 'Restriction remains', 'Action taken'],
    ['patient', 'overturned', 'Restriction lifted', 'No action'],
    ['clinic', 'overturned', 'Restriction lifted', 'No action'],
    ['patient', 'ended', 'Restriction ended', 'Action taken'],
    ['clinic', 'ended', 'Restriction ended', 'Action taken'],
  ] as const)(
    'delivers the reviewed %s %s final status without exposing the other participant',
    async (kind, outcome, appellantStatus, reporterStatus) => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2027-04-10T10:00:00Z'))
      const source = await pendingCase(kind, { effectiveUntil: '2027-04-10T11:00:00Z' })
      if (outcome === 'ended') vi.setSystemTime(new Date('2027-04-10T12:00:00Z'))
      const result = await decide(source, outcome === 'overturned' ? 'overturned' : 'upheld')
      const delivery = await deliver(result.appellant.operations[0]!.id)
      const reporterDelivery = await deliver(result.reporter.operations[0]!.id)
      const appellant = vi.mocked(delivery.deliver).mock.calls[0]![0]
      const reporter = vi.mocked(reporterDelivery.deliver).mock.calls[0]![0]
      expect(appellant.text).toContain(appellantStatus)
      expect(reporter.text).toContain(reporterStatus)
      expect(reporter.text).not.toContain('scheduled to end')
      if (outcome === 'upheld') {
        expect(appellant.text).toContain('scheduled to end')
        expect(appellant.text).toContain('UTC')
      } else expect(appellant.text).not.toContain('scheduled to end')
      for (const message of [appellant, reporter]) {
        expect(message.subject).toBe('An appeal decision is available')
        expect(message.text).toContain('Privacy concern or wrong recipient')
        for (const forbidden of [
          'ForbiddenHealthDetails',
          'ForbiddenReportDescription',
          'ForbiddenInternalReason',
          'ForbiddenAppealText',
          'ForbiddenAppealDecisionReason',
          'ForbiddenPatientName',
        ])
          expect(`${message.subject} ${message.html} ${message.text}`).not.toContain(forbidden)
      }
      expect(appellant.html).toContain(
        kind === 'patient'
          ? `https://website.example.test/patient/inquiries/${source.inquiryId}`
          : `https://dashboard.example.test/?inquiry=${source.inquiryId}`,
      )
      expect(reporter.recipientAddress).not.toBe(appellant.recipientAddress)
    },
  )

  it.each(['patient', 'clinic'] as const)(
    'gives the appellant slot priority for the same %s identity',
    async (kind) => {
      const source = await pendingCase(kind, { sameIdentity: true })
      const result = await decide(source)
      expect(result.appellant.operations).toHaveLength(1)
      expect(result.reporter.operations).toHaveLength(0)
      const delivery = await deliver(result.appellant.operations[0]!.id)
      expect(delivery.deliver).toHaveBeenCalledOnce()
      expect(vi.mocked(delivery.deliver).mock.calls[0]![0].text).toContain('Restriction remains')
      await expect(
        bindTransactionalEmail(moderatorReq).accept({
          type: 'moderation.appeal-decided',
          moderationEventId: Number(result.event.id),
          recipientSlot: 'reporter',
        }),
      ).rejects.toMatchObject({ code: 'source-missing' })
    },
  )

  it('stops prepared Restriction remains bytes when the restriction ends before a retry, without stopping the truthful reporter result', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2027-04-10T10:00:00Z'))
    const source = await pendingCase('patient', { effectiveUntil: '2027-04-10T11:00:00Z' })
    const result = await decide(source)
    const adapter: DeliveryAdapter = {
      deliver: vi.fn<DeliveryAdapter['deliver']>(async () => ({
        type: 'retryable',
        outcomeCode: 'provider-temporary',
      })),
    }
    await deliver(result.appellant.operations[0]!.id, adapter)
    expect(vi.mocked(adapter.deliver).mock.calls[0]![0].text).toContain('Restriction remains')
    vi.setSystemTime(new Date('2027-04-10T12:00:00Z'))
    await deliver(result.appellant.operations[0]!.id, adapter)
    expect(adapter.deliver).toHaveBeenCalledOnce()
    expect((await mail(result.appellantReference)).audit).toContainEqual(
      expect.objectContaining({ type: 'delivery.suppressed', outcomeCode: 'superseded' }),
    )
    const reporter = await deliver(result.reporter.operations[0]!.id)
    expect(vi.mocked(reporter.deliver).mock.calls[0]![0].text).toContain('Action taken')
  })

  it('commits the final decision and both exact participant slots before delivering neutral package content', async () => {
    const source = await pendingCase()
    const result = await decide(source)
    expect(result.appellant.operations).toHaveLength(1)
    expect(result.reporter.operations).toHaveLength(1)
    expect(result.appellant.audit.map((event) => event.type)).toEqual(['command.accepted'])
    expect(result.reporter.audit.map((event) => event.type)).toEqual(['command.accepted'])
    const delivery = await deliver(result.appellant.operations[0]!.id)
    const reporterDelivery = await deliver(result.reporter.operations[0]!.id)
    expect(delivery.deliver).toHaveBeenCalledOnce()
    expect(reporterDelivery.deliver).toHaveBeenCalledOnce()
    const appellantMessage = vi.mocked(delivery.deliver).mock.calls[0]![0]
    const reporterMessage = vi.mocked(reporterDelivery.deliver).mock.calls[0]![0]
    if (!clinicReq.user || !('email' in clinicReq.user)) throw new Error('Expected clinic email')
    expect(appellantMessage.recipientAddress).toBe(clinicReq.user.email)
    expect(appellantMessage.subject).toBe('An appeal decision is available')
    expect(appellantMessage.text).toContain('Restriction remains')
    expect(appellantMessage.text).toContain('Privacy concern or wrong recipient')
    expect(appellantMessage.html).toContain(`https://dashboard.example.test/?inquiry=${source.inquiryId}`)
    expect(reporterMessage.text).toContain('Action taken')
    expect(reporterMessage.html).toContain(`https://website.example.test/patient/inquiries/${source.inquiryId}`)
    for (const message of [appellantMessage, reporterMessage])
      for (const forbidden of [
        'ForbiddenHealthDetails',
        'ForbiddenReportDescription',
        'ForbiddenInternalReason',
        'ForbiddenAppealText',
        'ForbiddenAppealDecisionReason',
        'ForbiddenPatientName',
      ])
        expect(`${message.subject} ${message.html} ${message.text}`).not.toContain(forbidden)
  })
})

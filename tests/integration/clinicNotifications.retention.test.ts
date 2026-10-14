import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import cases from '../fixtures/clinic-notifications-v1.json'
import { sendPostHogException } from '@/posthog/api'
import { GET as scheduledRetention } from '@/app/api/internal/clinic-notifications/retention/route'
import {
  captureClinicNotificationOccurrence,
  type NotificationCaptureMember,
} from '@/features/clinicNotifications/capture'
import {
  activateClinicNotificationsForTest,
  readClinicNotifications,
  markClinicNotificationsRead,
} from '@/features/clinicNotifications/service'
import { submitGuestClinicInquiry } from '@/features/inquiryCommunication/service'
import { runClinicNotificationRetention } from '@/features/clinicNotifications/retention'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { createClinicTestUser, asClinicScopedPayloadUser } from '../fixtures/testUsers'
import { testSlug } from '../fixtures/testSlug'
vi.mock('@payloadcms/storage-s3', () => ({ s3Storage: () => (incoming: unknown) => incoming }))
vi.mock('@/posthog/api', () => ({ sendPostHogException: vi.fn() }))
describe('independent notification retention with native storage', () => {
  let payload: Payload
  let req: PayloadRequest
  let staffReq: PayloadRequest
  let clinicId: number
  let doctorId: number
  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const cities = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const fixture = await createClinicFixture(payload, cities.docs[0]!.id, {
      slugPrefix: testSlug('clinicNotifications.retention.test.ts'),
    })
    clinicId = fixture.clinic.id
    doctorId = fixture.doctor.id
    req = await createLocalReq({}, payload)
    const staff = await createClinicTestUser(payload, { createdStaffIds: [], emailPrefix: 'notification-retention' })
    staffReq = await createLocalReq({}, payload)
    staffReq.user = await asClinicScopedPayloadUser(payload, staff, clinicId)
    await activateClinicNotificationsForTest(req)
  }, 60000)
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })
  afterAll(async () => {
    await payload?.db.destroy?.()
  })
  async function occurrence(label: string) {
    const source = await submitGuestClinicInquiry(req, {
      clinicId,
      doctorId,
      consent: true,
      email: `retention-${label}@example.com`,
      fullName: 'Synthetic Retention Patient',
      message: 'Protected source text survives notification cleanup.',
      phoneNumber: '+491234567890',
    })
    const stored = (
      await payload.find({
        collection: 'clinicNotificationOccurrences',
        overrideAccess: true,
        depth: 0,
        where: { sourceRecordId: { equals: source.id } },
      })
    ).docs[0]!
    return { source, stored }
  }
  async function waitForRace(signal: Promise<void>): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        signal,
        new Promise<void>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Timed out waiting for the native notification race')), 15000)
        }),
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
  it('physically deletes due occurrences and first personal receipts without user traffic, keeping source data', async () => {
    const { source, stored } = await occurrence('first')
    const id = await payload.db.beginTransaction({ isolationLevel: 'serializable' })
    const receiptReq = await createLocalReq(
      { context: { clinicNotificationCommand: true }, req: { transactionID: Promise.resolve(id!) } },
      payload,
    )
    await payload.create({
      collection: 'clinicNotificationReadReceipts',
      overrideAccess: true,
      req: receiptReq,
      data: { occurrence: stored.id, clinicStaff: staffReq.user!.id, readAt: new Date().toISOString() },
    })
    await payload.db.commitTransaction(id!)
    vi.setSystemTime(new Date(Date.parse(stored.expiresAt) - 1))
    expect(await runClinicNotificationRetention(req)).toMatchObject({ result: 'success', occurrencesDeleted: 0 })
    expect(
      (await payload.find({ collection: 'clinicNotificationOccurrences', overrideAccess: true })).docs,
    ).toHaveLength(1)
    vi.setSystemTime(new Date(Date.parse(stored.expiresAt) + 300000))
    expect(await runClinicNotificationRetention(req)).toMatchObject({
      result: 'success',
      occurrencesDeleted: 1,
      receiptsDeleted: 1,
    })
    expect(
      (await payload.find({ collection: 'clinicNotificationOccurrences', overrideAccess: true })).docs,
    ).toHaveLength(0)
    expect(
      (await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true })).docs,
    ).toHaveLength(0)
    expect(
      await payload.findByID({ collection: 'patientClinicInquiries', id: Number(source.id), overrideAccess: true }),
    ).toMatchObject({ message: 'Protected source text survives notification cleanup.' })
    expect(await runClinicNotificationRetention(req)).toMatchObject({
      result: 'success',
      occurrencesDeleted: 0,
      receiptsDeleted: 0,
    })
  })
  it('removes every closed v1 event variant with all personal receipts in bounded batches', async () => {
    const transactionID = await payload.db.beginTransaction({ isolationLevel: 'serializable' })
    const sourceReq = await createLocalReq({ req: { transactionID: Promise.resolve(transactionID!) } }, payload)
    for (const fixture of cases) {
      const item = fixture.response.items?.[0]
      if (!item) continue
      const member = item.members[0]!
      const {
        notificationId: _notificationId,
        occurredAt: _occurredAt,
        expiresAt: _expiresAt,
        readAt: _readAt,
        ...capture
      } = member
      await captureClinicNotificationOccurrence(sourceReq, { clinicId, member: capture as NotificationCaptureMember })
    }
    await payload.db.commitTransaction(transactionID!)
    const occurrences = (
      await payload.find({ collection: 'clinicNotificationOccurrences', overrideAccess: true, limit: 100, depth: 0 })
    ).docs
    expect(occurrences).toHaveLength(14)
    const id = await payload.db.beginTransaction({ isolationLevel: 'serializable' })
    const receiptReq = await createLocalReq(
      { context: { clinicNotificationCommand: true }, req: { transactionID: Promise.resolve(id!) } },
      payload,
    )
    for (const stored of occurrences)
      await payload.create({
        collection: 'clinicNotificationReadReceipts',
        overrideAccess: true,
        depth: 0,
        req: receiptReq,
        data: { occurrence: stored.id, clinicStaff: staffReq.user!.id, readAt: new Date().toISOString() },
      })
    await payload.db.commitTransaction(id!)
    vi.setSystemTime(new Date(Math.max(...occurrences.map(({ expiresAt }) => Date.parse(expiresAt))) + 300000))
    expect(await runClinicNotificationRetention(req)).toMatchObject({
      result: 'success',
      occurrencesDeleted: 14,
      receiptsDeleted: 14,
    })
    expect(
      (await payload.find({ collection: 'clinicNotificationOccurrences', overrideAccess: true })).docs,
    ).toHaveLength(0)
    expect(
      (await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true })).docs,
    ).toHaveLength(0)
  })

  it('rolls back receipts with the failed occurrence deletion and recovers on the next five-minute execution', async () => {
    const { stored } = await occurrence('rollback')
    const id = await payload.db.beginTransaction({ isolationLevel: 'serializable' })
    const receiptReq = await createLocalReq(
      { context: { clinicNotificationCommand: true }, req: { transactionID: Promise.resolve(id!) } },
      payload,
    )
    await payload.create({
      collection: 'clinicNotificationReadReceipts',
      overrideAccess: true,
      depth: 0,
      req: receiptReq,
      data: { occurrence: stored.id, clinicStaff: staffReq.user!.id, readAt: new Date().toISOString() },
    })
    await payload.db.commitTransaction(id!)
    const control = (
      await payload.find({
        collection: 'clinicNotificationControls',
        where: { key: { equals: 'notification-retention' } },
        overrideAccess: true,
      })
    ).docs[0]!
    const time = Math.max(Date.parse(stored.expiresAt), Date.parse(control.retentionStartedAt!)) + 300000
    vi.setSystemTime(new Date(time))
    const hooks = payload.collections.clinicNotificationOccurrences.config.hooks
    const previous = hooks.beforeDelete
    hooks.beforeDelete = [
      ...(previous ?? []),
      () => {
        throw new Error('synthetic clinic-123 patient-name protected source content and Bearer private-secret')
      },
    ]
    const error = vi.spyOn(payload.logger, 'error')
    try {
      expect(await runClinicNotificationRetention(req)).toMatchObject({
        result: 'failure',
        transactionOutcome: 'not_committed',
        occurrencesDeleted: 0,
        receiptsDeleted: 0,
      })
      const diagnostic = JSON.stringify(error.mock.calls)
      expect(diagnostic).toContain('clinic_dashboard.notifications.retention')
      expect(diagnostic).not.toMatch(/clinic-123|patient-name|source content|private-secret/)
      expect(
        (await payload.find({ collection: 'clinicNotificationOccurrences', overrideAccess: true })).docs,
      ).toHaveLength(1)
      expect(
        (await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true })).docs,
      ).toHaveLength(1)
      expect(await readClinicNotifications(staffReq, { mode: 'summary' })).toMatchObject({ unreadCount: 0 })
      expect(
        (
          await payload.find({
            collection: 'clinicNotificationControls',
            where: { key: { equals: 'notification-retention' } },
            overrideAccess: true,
          })
        ).docs[0],
      ).toMatchObject({ retentionResult: 'failure', retentionLeaseToken: null })
    } finally {
      hooks.beforeDelete = previous
    }
    vi.setSystemTime(new Date(time + 300000))
    expect(await runClinicNotificationRetention(req)).toMatchObject({
      result: 'success',
      occurrencesDeleted: 1,
      receiptsDeleted: 1,
      missedSlots: 0,
    })
  })
  it('coordinates overlapping invocations using one persisted owner and recovers missed UTC slots', async () => {
    const { stored } = await occurrence('overlap')
    const prior = (
      await payload.find({
        collection: 'clinicNotificationControls',
        where: { key: { equals: 'notification-retention' } },
        overrideAccess: true,
      })
    ).docs[0]!
    const time = Math.max(Date.parse(stored.expiresAt), Number(prior.retentionSlot) * 300000) + 3 * 300000 + 45000
    vi.setSystemTime(new Date(time))
    let entered!: () => void
    let release!: () => void
    const paused = new Promise<void>((resolve) => {
      entered = resolve
    })
    const resumed = new Promise<void>((resolve) => {
      release = resolve
    })
    const hooks = payload.collections.clinicNotificationOccurrences.config.hooks
    const previous = hooks.beforeDelete
    hooks.beforeDelete = [
      ...(previous ?? []),
      async () => {
        entered()
        await resumed
      },
    ]
    const first = runClinicNotificationRetention(req)
    try {
      await paused
      expect(await runClinicNotificationRetention(req)).toMatchObject({
        result: 'busy',
        occurrencesDeleted: 0,
        receiptsDeleted: 0,
      })
      release()
      const result = await first
      expect(result).toMatchObject({ result: 'success', occurrencesDeleted: 1, recoveredInterruptedRun: false })
      expect(result.missedSlots).toBe(2)
    } finally {
      release()
      await first
      hooks.beforeDelete = previous
    }
    const observed = (
      await payload.find({
        collection: 'clinicNotificationControls',
        where: { key: { equals: 'notification-retention' } },
        overrideAccess: true,
      })
    ).docs[0]!
    vi.setSystemTime(new Date(time + 300000))
    expect(await runClinicNotificationRetention(await createLocalReq({}, payload))).toMatchObject({
      result: 'success',
      missedSlots: 0,
      occurrencesDeleted: 0,
    })
    const next = (
      await payload.find({
        collection: 'clinicNotificationControls',
        where: { key: { equals: 'notification-retention' } },
        overrideAccess: true,
      })
    ).docs[0]!
    expect(next.retentionSlot).toBe(observed.retentionSlot! + 1)
    expect(next.retentionLeaseToken).toBeNull()
    expect(next.retentionCompletedAt).toBe(new Date(time + 300000).toISOString())
  })
  it('reports due work as incomplete at its batch limit and completes the remaining work next tick', async () => {
    const { stored } = await occurrence('bounded')
    const prior = (
      await payload.find({
        collection: 'clinicNotificationControls',
        where: { key: { equals: 'notification-retention' } },
        overrideAccess: true,
      })
    ).docs[0]!
    const time = Math.max(Date.parse(stored.expiresAt), Number(prior.retentionSlot) * 300000) + 300000
    vi.setSystemTime(new Date(time))
    expect(await runClinicNotificationRetention(req, { maxBatches: 0 })).toMatchObject({
      result: 'incomplete',
      occurrencesDeleted: 0,
      transactionOutcome: 'committed',
    })
    const incomplete = (
      await payload.find({
        collection: 'clinicNotificationControls',
        where: { key: { equals: 'notification-retention' } },
        overrideAccess: true,
      })
    ).docs[0]!
    expect(incomplete.retentionCompletedAt).toBe(prior.retentionCompletedAt)
    expect(incomplete.retentionResult).toBe('incomplete')
    expect(
      (await payload.find({ collection: 'clinicNotificationOccurrences', overrideAccess: true })).docs,
    ).toHaveLength(1)
    vi.setSystemTime(new Date(time + 300000))
    expect(await runClinicNotificationRetention(req, { maxBatches: 1 })).toMatchObject({
      result: 'success',
      occurrencesDeleted: 1,
    })
    expect(
      (await payload.find({ collection: 'clinicNotificationOccurrences', overrideAccess: true })).docs,
    ).toHaveLength(0)
  })
  it('reports a lost deletion commit response as unknown and recovers without recreating records or leaking errors', async () => {
    const { stored } = await occurrence('unknown')
    const prior = (
      await payload.find({
        collection: 'clinicNotificationControls',
        where: { key: { equals: 'notification-retention' } },
        overrideAccess: true,
      })
    ).docs[0]!
    const time = Math.max(Date.parse(stored.expiresAt), Number(prior.retentionSlot) * 300000) + 300000
    vi.setSystemTime(new Date(time))
    const original = payload.db.commitTransaction.bind(payload.db)
    let commits = 0
    const commit = vi.spyOn(payload.db, 'commitTransaction').mockImplementation(async (id) => {
      await original(id)
      if (++commits === 2) throw new Error('synthetic occurrence-456 Bearer confidential database response')
    })
    const diagnostic = vi.mocked(sendPostHogException)
    diagnostic.mockClear()
    diagnostic.mockRejectedValueOnce(new Error('synthetic unavailable external telemetry'))
    const log = vi.spyOn(payload.logger, 'error').mockImplementation(() => {
      throw new Error('synthetic log sink unavailable')
    })
    try {
      expect(await runClinicNotificationRetention(req)).toMatchObject({
        result: 'failure',
        transactionOutcome: 'unknown',
        occurrencesDeleted: 0,
      })
      expect(diagnostic).toHaveBeenCalledTimes(1)
      const [error, options] = diagnostic.mock.calls[0]!
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe('Clinic notification retention needs recovery')
      expect(JSON.stringify(options)).not.toMatch(/occurrence-456|confidential|Bearer/)
      expect(
        (await payload.find({ collection: 'clinicNotificationOccurrences', overrideAccess: true })).docs,
      ).toHaveLength(0)
      expect(
        (
          await payload.find({
            collection: 'clinicNotificationControls',
            where: { key: { equals: 'notification-retention' } },
            overrideAccess: true,
          })
        ).docs[0],
      ).toMatchObject({ retentionResult: 'running' })
    } finally {
      commit.mockRestore()
      log.mockRestore()
    }
    vi.setSystemTime(new Date(time + 300000))
    expect(await runClinicNotificationRetention(req)).toMatchObject({
      result: 'success',
      occurrencesDeleted: 0,
      recoveredInterruptedRun: true,
      missedSlots: 0,
    })
  })
  it('records handled source capture failures as controlled operational errors after rollback', async () => {
    const hooks = payload.collections.clinicNotificationOccurrences.config.hooks
    const previous = hooks.beforeChange
    hooks.beforeChange = [
      ...(previous ?? []),
      () => {
        throw new Error('synthetic patient-789 confidential source body Bearer private-secret')
      },
    ]
    const log = vi.spyOn(payload.logger, 'error')
    const diagnostic = vi.mocked(sendPostHogException)
    diagnostic.mockClear()
    try {
      await expect(occurrence('source-diagnostic')).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' })
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'source_capture',
          result: 'failure',
          transactionOutcome: 'not_committed',
          errorCode: 'SERVICE_UNAVAILABLE',
        }),
        expect.any(String),
      )
      expect(diagnostic).toHaveBeenCalledTimes(1)
      expect((diagnostic.mock.calls[0]![0] as Error).message).toBe('Clinic notification operation failed')
      expect(JSON.stringify(diagnostic.mock.calls[0]![1])).not.toMatch(
        /patient-789|confidential|source body|private-secret/,
      )
      expect(
        (
          await payload.find({
            collection: 'patientClinicInquiries',
            where: { email: { equals: 'retention-source-diagnostic@example.com' } },
            overrideAccess: true,
          })
        ).docs,
      ).toHaveLength(0)
    } finally {
      hooks.beforeChange = previous
    }
  })
  it('rolls back an over-budget batch and recovers the expired lease at the next scheduled tick', async () => {
    const { stored } = await occurrence('deadline')
    const prior = (
      await payload.find({
        collection: 'clinicNotificationControls',
        where: { key: { equals: 'notification-retention' } },
        overrideAccess: true,
      })
    ).docs[0]!
    const time = Math.max(Date.parse(stored.expiresAt), Number(prior.retentionSlot) * 300000) + 300000
    vi.setSystemTime(new Date(time))
    const hooks = payload.collections.clinicNotificationOccurrences.config.hooks
    const previous = hooks.beforeDelete
    hooks.beforeDelete = [
      ...(previous ?? []),
      () => {
        vi.setSystemTime(new Date(time + 220001))
      },
    ]
    try {
      expect(await runClinicNotificationRetention(req)).toMatchObject({
        result: 'incomplete',
        transactionOutcome: 'not_committed',
        occurrencesDeleted: 0,
        elapsedMs: 220001,
      })
      expect(
        (await payload.find({ collection: 'clinicNotificationOccurrences', overrideAccess: true })).docs,
      ).toHaveLength(1)
      expect(
        (
          await payload.find({
            collection: 'clinicNotificationControls',
            where: { key: { equals: 'notification-retention' } },
            overrideAccess: true,
          })
        ).docs[0]!.retentionCompletedAt,
      ).toBe(prior.retentionCompletedAt)
    } finally {
      hooks.beforeDelete = previous
    }
    vi.setSystemTime(new Date(time + 300000))
    expect(await runClinicNotificationRetention(req)).toMatchObject({
      result: 'success',
      occurrencesDeleted: 1,
      recoveredInterruptedRun: true,
      missedSlots: 0,
    })
  })

  it('executes the dedicated authenticated scheduler handler against real local storage without Dashboard traffic', async () => {
    const { source, stored } = await occurrence('scheduled')
    const prior = (
      await payload.find({
        collection: 'clinicNotificationControls',
        where: { key: { equals: 'notification-retention' } },
        overrideAccess: true,
      })
    ).docs[0]!
    vi.setSystemTime(new Date(Math.max(Date.parse(stored.expiresAt), Number(prior.retentionSlot) * 300000) + 300000))
    const secret = 'synthetic-local-notification-cron-secret-only'
    vi.stubEnv('CRON_SECRET', secret)
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_ENV', 'production')
    const response = await scheduledRetention(
      new Request('https://scheduler.example.test/api/internal/clinic-notifications/retention', {
        headers: { authorization: `Bearer ${secret}` },
      }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(
      (await payload.find({ collection: 'clinicNotificationOccurrences', overrideAccess: true })).docs,
    ).toHaveLength(0)
    expect(
      await payload.findByID({
        collection: 'patientClinicInquiries',
        id: Number(source.id),
        depth: 0,
        overrideAccess: true,
      }),
    ).toMatchObject({ message: 'Protected source text survives notification cleanup.' })
  })
  it('keeps a pre-expiry acknowledgement decision valid during a late commit and concurrent physical cleanup', async () => {
    const prior = (
      await payload.find({
        collection: 'clinicNotificationControls',
        where: { key: { equals: 'notification-retention' } },
        overrideAccess: true,
        depth: 0,
      })
    ).docs[0]!
    vi.setSystemTime(new Date(Date.parse(prior.retentionCompletedAt!) + 300000))
    const { source, stored } = await occurrence('late-commit-cleanup')
    vi.setSystemTime(new Date(Date.parse(stored.expiresAt) - 1))
    expect(await readClinicNotifications(staffReq, { mode: 'summary' })).toMatchObject({ unreadCount: 1 })
    let enteredCommit!: () => void
    let releaseCommit!: () => void
    let enteredCleanup!: () => void
    let releaseCleanup!: () => void
    const committing = new Promise<void>((resolve) => {
      enteredCommit = resolve
    })
    const allowCommit = new Promise<void>((resolve) => {
      releaseCommit = resolve
    })
    const deleting = new Promise<void>((resolve) => {
      enteredCleanup = resolve
    })
    const allowDelete = new Promise<void>((resolve) => {
      releaseCleanup = resolve
    })
    let firstReadAt: string | undefined
    const originalCommit = payload.db.commitTransaction.bind(payload.db)
    const commit = vi.spyOn(payload.db, 'commitTransaction').mockImplementationOnce(async (transactionID) => {
      const transactionReq = await createLocalReq({ req: { transactionID: Promise.resolve(transactionID) } }, payload)
      const prepared = (
        await payload.find({
          collection: 'clinicNotificationReadReceipts',
          where: { occurrence: { equals: stored.id } },
          overrideAccess: true,
          depth: 0,
          req: transactionReq,
        })
      ).docs
      expect(prepared).toHaveLength(1)
      firstReadAt = prepared[0]!.readAt
      vi.setSystemTime(new Date(stored.expiresAt))
      await originalCommit(transactionID)
      enteredCommit()
      await allowCommit
    })
    const hooks = payload.collections.clinicNotificationOccurrences.config.hooks
    const previous = hooks.beforeDelete
    let deletionAttempts = 0
    hooks.beforeDelete = [
      ...(previous ?? []),
      async ({ id }) => {
        if (id === stored.id && ++deletionAttempts === 1) {
          enteredCleanup()
          await allowDelete
        }
      },
    ]
    const marking = markClinicNotificationsRead(staffReq, { notificationIds: [stored.notificationId] })
    let cleanup: ReturnType<typeof runClinicNotificationRetention> | undefined
    try {
      await waitForRace(committing)
      expect(await readClinicNotifications(staffReq, { mode: 'summary' })).toMatchObject({ unreadCount: 0 })
      for (const view of ['unread', 'all'] as const)
        expect(await readClinicNotifications(staffReq, { mode: 'page', view })).toMatchObject({ items: [] })
      cleanup = runClinicNotificationRetention(req)
      await waitForRace(deleting)
      releaseCommit()
      expect(await marking).toMatchObject({ acknowledged: true, serverTime: stored.expiresAt })
      commit.mockRestore()
      const receipts = (
        await payload.find({
          collection: 'clinicNotificationReadReceipts',
          where: { occurrence: { equals: stored.id } },
          overrideAccess: true,
          depth: 0,
        })
      ).docs
      expect(receipts).toHaveLength(1)
      expect(receipts[0]!.readAt).toBe(firstReadAt)
      expect(Date.parse(firstReadAt!)).toBe(Date.parse(stored.expiresAt) - 1)
      await markClinicNotificationsRead(staffReq, { notificationIds: [stored.notificationId] })
      expect(
        (
          await payload.find({
            collection: 'clinicNotificationReadReceipts',
            where: { occurrence: { equals: stored.id } },
            overrideAccess: true,
            depth: 0,
          })
        ).docs,
      ).toEqual(receipts)
      releaseCleanup()
      const result = await cleanup
      if (result.result === 'failure') {
        expect(result.transactionOutcome).toBe('not_committed')
        expect(
          (
            await payload.find({
              collection: 'clinicNotificationReadReceipts',
              where: { occurrence: { equals: stored.id } },
              overrideAccess: true,
              depth: 0,
            })
          ).docs,
        ).toEqual(receipts)
        expect(
          (
            await payload.find({
              collection: 'clinicNotificationOccurrences',
              where: { id: { equals: stored.id } },
              overrideAccess: true,
              depth: 0,
            })
          ).docs,
        ).toHaveLength(1)
        vi.setSystemTime(new Date(Date.parse(stored.expiresAt) + 300000))
        expect(await runClinicNotificationRetention(req)).toMatchObject({
          result: 'success',
          occurrencesDeleted: 1,
          receiptsDeleted: 1,
        })
      } else expect(result).toMatchObject({ result: 'success', occurrencesDeleted: 1, receiptsDeleted: 1 })
      expect(
        (await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true, depth: 0 })).docs,
      ).toHaveLength(0)
      expect(
        (await payload.find({ collection: 'clinicNotificationOccurrences', overrideAccess: true, depth: 0 })).docs,
      ).toHaveLength(0)
      expect(await readClinicNotifications(staffReq, { mode: 'summary' })).toMatchObject({ unreadCount: 0 })
      expect(
        await payload.findByID({
          collection: 'patientClinicInquiries',
          id: Number(source.id),
          overrideAccess: true,
          depth: 0,
        }),
      ).toMatchObject({ message: 'Protected source text survives notification cleanup.' })
    } finally {
      releaseCommit()
      releaseCleanup()
      await marking.catch(() => undefined)
      await cleanup?.catch(() => undefined)
      commit.mockRestore()
      hooks.beforeDelete = previous
    }
  }, 60000)

  it('does not leave orphaned receipts when cleanup overlaps an uncommitted acknowledgement transaction', async () => {
    const prior = (
      await payload.find({
        collection: 'clinicNotificationControls',
        where: { key: { equals: 'notification-retention' } },
        overrideAccess: true,
        depth: 0,
      })
    ).docs[0]!
    vi.setSystemTime(new Date(Date.parse(prior.retentionCompletedAt!) + 300000))
    const { source, stored } = await occurrence('uncommitted-cleanup')
    vi.setSystemTime(new Date(Date.parse(stored.expiresAt) - 1))
    let enteredCommit!: () => void
    let releaseCommit!: () => void
    let enteredCleanup!: () => void
    let releaseCleanup!: () => void
    const committing = new Promise<void>((resolve) => {
      enteredCommit = resolve
    })
    const allowCommit = new Promise<void>((resolve) => {
      releaseCommit = resolve
    })
    const deleting = new Promise<void>((resolve) => {
      enteredCleanup = resolve
    })
    const allowDelete = new Promise<void>((resolve) => {
      releaseCleanup = resolve
    })
    let firstReadAt: string | undefined
    const originalCommit = payload.db.commitTransaction.bind(payload.db)
    const commit = vi.spyOn(payload.db, 'commitTransaction').mockImplementationOnce(async (transactionID) => {
      const transactionReq = await createLocalReq({ req: { transactionID: Promise.resolve(transactionID) } }, payload)
      const prepared = (
        await payload.find({
          collection: 'clinicNotificationReadReceipts',
          where: { occurrence: { equals: stored.id } },
          overrideAccess: true,
          depth: 0,
          req: transactionReq,
        })
      ).docs
      expect(prepared).toHaveLength(1)
      firstReadAt = prepared[0]!.readAt
      vi.setSystemTime(new Date(stored.expiresAt))
      enteredCommit()
      await allowCommit
      await originalCommit(transactionID)
    })
    const hooks = payload.collections.clinicNotificationOccurrences.config.hooks
    const previous = hooks.beforeDelete
    let deletionAttempts = 0
    hooks.beforeDelete = [
      ...(previous ?? []),
      async ({ id }) => {
        if (id === stored.id && ++deletionAttempts === 1) {
          enteredCleanup()
          await allowDelete
        }
      },
    ]
    const marking = markClinicNotificationsRead(staffReq, { notificationIds: [stored.notificationId] }).then(
      (value) => ({ value }),
      (error) => ({ error }),
    )
    let cleanup: ReturnType<typeof runClinicNotificationRetention> | undefined
    try {
      await waitForRace(committing)
      cleanup = runClinicNotificationRetention(req)
      await waitForRace(deleting)
      releaseCommit()
      const outcome = await marking
      const receipts = (
        await payload.find({
          collection: 'clinicNotificationReadReceipts',
          where: { occurrence: { equals: stored.id } },
          overrideAccess: true,
          depth: 0,
        })
      ).docs
      if ('error' in outcome) {
        expect(outcome.error).toMatchObject({ code: 'SERVICE_UNAVAILABLE', writeOutcome: 'unknown' })
        expect(receipts).toHaveLength(0)
      } else {
        expect(outcome.value).toMatchObject({ acknowledged: true })
        expect(receipts).toHaveLength(1)
        expect(receipts[0]!.readAt).toBe(firstReadAt)
      }
      commit.mockRestore()
      expect(await readClinicNotifications(staffReq, { mode: 'summary' })).toMatchObject({ unreadCount: 0 })
      for (const view of ['unread', 'all'] as const)
        expect(await readClinicNotifications(staffReq, { mode: 'page', view })).toMatchObject({ items: [] })
      releaseCleanup()
      const result = await cleanup
      expect(result.attemptCount).toBeLessThanOrEqual(5)
      if (result.result === 'failure') {
        expect(result.transactionOutcome).toBe('not_committed')
        expect(
          (
            await payload.find({
              collection: 'clinicNotificationOccurrences',
              where: { id: { equals: stored.id } },
              overrideAccess: true,
              depth: 0,
            })
          ).docs,
        ).toHaveLength(1)
        expect(
          (
            await payload.find({
              collection: 'clinicNotificationReadReceipts',
              where: { occurrence: { equals: stored.id } },
              overrideAccess: true,
              depth: 0,
            })
          ).docs,
        ).toEqual(receipts)
        vi.setSystemTime(new Date(Date.parse(stored.expiresAt) + 300000))
        expect(await runClinicNotificationRetention(req)).toMatchObject({
          result: 'success',
          occurrencesDeleted: 1,
          receiptsDeleted: receipts.length,
        })
      } else
        expect(result).toMatchObject({ result: 'success', occurrencesDeleted: 1, receiptsDeleted: receipts.length })
      expect(
        (await payload.find({ collection: 'clinicNotificationOccurrences', overrideAccess: true, depth: 0 })).docs,
      ).toHaveLength(0)
      expect(
        (await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true, depth: 0 })).docs,
      ).toHaveLength(0)
      await markClinicNotificationsRead(staffReq, { notificationIds: [stored.notificationId] })
      expect(
        (await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true, depth: 0 })).docs,
      ).toHaveLength(0)
      expect(
        await payload.findByID({
          collection: 'patientClinicInquiries',
          id: Number(source.id),
          overrideAccess: true,
          depth: 0,
        }),
      ).toMatchObject({ message: 'Protected source text survives notification cleanup.' })
    } finally {
      releaseCommit()
      releaseCleanup()
      await marking
      await cleanup?.catch(() => undefined)
      commit.mockRestore()
      hooks.beforeDelete = previous
    }
  }, 60000)
  it('skips a member expiring before the decision, retains the fixed selection and recovers physical cleanup without changing first readAt', async () => {
    const prior = (
      await payload.find({
        collection: 'clinicNotificationControls',
        where: { key: { equals: 'notification-retention' } },
        overrideAccess: true,
        depth: 0,
      })
    ).docs[0]!
    const base = Date.parse(prior.retentionCompletedAt!) + 300000
    vi.setSystemTime(new Date(base))
    const first = await occurrence('selection-expiring')
    vi.setSystemTime(new Date(base + 300000))
    const second = await occurrence('selection-remaining')
    vi.setSystemTime(new Date(base + 600000))
    const later = await occurrence('selection-unselected')
    const sources = await Promise.all(
      [first, second, later].map(async ({ source }) => {
        const doc = await payload.findByID({
          collection: 'patientClinicInquiries',
          id: Number(source.id),
          overrideAccess: true,
          depth: 0,
        })
        return { id: doc.id, createdAt: doc.createdAt, updatedAt: doc.updatedAt, message: doc.message }
      }),
    )
    const fixedIds = [first.stored.notificationId, second.stored.notificationId]
    const receiptHooks = payload.collections.clinicNotificationReadReceipts.config.hooks
    const previousReceipts = receiptHooks.afterChange
    let writes = 0
    receiptHooks.afterChange = [
      ...(previousReceipts ?? []),
      ({ doc }) => {
        writes++
        vi.setSystemTime(new Date(first.stored.expiresAt))
        return doc
      },
    ]
    vi.setSystemTime(new Date(Date.parse(first.stored.expiresAt) - 1))
    try {
      expect(await markClinicNotificationsRead(staffReq, { notificationIds: fixedIds })).toMatchObject({
        acknowledged: true,
      })
    } finally {
      receiptHooks.afterChange = previousReceipts
    }
    expect(writes).toBeGreaterThan(1)
    const receipts = (
      await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true, depth: 0 })
    ).docs
    expect(receipts).toHaveLength(1)
    expect(receipts[0]!.occurrence).toBe(second.stored.id)
    expect(receipts[0]!.readAt).toBe(first.stored.expiresAt)
    expect(await readClinicNotifications(staffReq, { mode: 'summary' })).toMatchObject({
      unreadCount: 1,
      nextUnreadCountChangeAt: later.stored.expiresAt,
    })
    const all = await readClinicNotifications(staffReq, { mode: 'page', view: 'all' })
    if (all.mode !== 'page') throw new Error('Expected All page')
    expect(all.items.flatMap(({ members }) => members.map(({ notificationId }) => notificationId)).sort()).toEqual(
      [second.stored.notificationId, later.stored.notificationId].sort(),
    )
    expect(
      all.items
        .flatMap(({ members }) => members)
        .find(({ notificationId }) => notificationId === later.stored.notificationId)!.readAt,
    ).toBeNull()
    await markClinicNotificationsRead(staffReq, { notificationIds: fixedIds })
    expect(
      (await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true, depth: 0 })).docs,
    ).toEqual(receipts)
    const hooks = payload.collections.clinicNotificationOccurrences.config.hooks
    const previous = hooks.beforeDelete
    hooks.beforeDelete = [
      ...(previous ?? []),
      () => {
        throw new Error('Synthetic bounded cleanup outage after the fixed acknowledgement decision')
      },
    ]
    try {
      expect(await runClinicNotificationRetention(req)).toMatchObject({
        result: 'failure',
        transactionOutcome: 'not_committed',
        occurrencesDeleted: 0,
        receiptsDeleted: 0,
      })
      expect(
        (await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true, depth: 0 })).docs,
      ).toEqual(receipts)
      expect(
        (await payload.find({ collection: 'clinicNotificationOccurrences', overrideAccess: true, depth: 0 })).docs,
      ).toHaveLength(3)
    } finally {
      hooks.beforeDelete = previous
    }
    vi.setSystemTime(new Date(second.stored.expiresAt))
    expect(await readClinicNotifications(staffReq, { mode: 'summary' })).toMatchObject({ unreadCount: 1 })
    await markClinicNotificationsRead(staffReq, { notificationIds: fixedIds })
    expect(
      (await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true, depth: 0 })).docs,
    ).toEqual(receipts)
    expect(await runClinicNotificationRetention(req)).toMatchObject({
      result: 'success',
      occurrencesDeleted: 2,
      receiptsDeleted: 1,
      missedSlots: 0,
    })
    expect(
      (await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true, depth: 0 })).docs,
    ).toHaveLength(0)
    expect(
      (await payload.find({ collection: 'clinicNotificationOccurrences', overrideAccess: true, depth: 0 })).docs,
    ).toEqual([later.stored])
    const unread = await readClinicNotifications(staffReq, { mode: 'page', view: 'unread' })
    if (unread.mode !== 'page') throw new Error('Expected Unread page')
    expect(unread.items.flatMap(({ members }) => members.map(({ notificationId }) => notificationId))).toEqual([
      later.stored.notificationId,
    ])
    vi.setSystemTime(new Date(later.stored.expiresAt))
    expect(await readClinicNotifications(staffReq, { mode: 'summary' })).toMatchObject({ unreadCount: 0 })
    for (const view of ['unread', 'all'] as const)
      expect(await readClinicNotifications(staffReq, { mode: 'page', view })).toMatchObject({ items: [] })
    expect(await runClinicNotificationRetention(req)).toMatchObject({
      result: 'success',
      occurrencesDeleted: 1,
      receiptsDeleted: 0,
    })
    expect(
      (await payload.find({ collection: 'clinicNotificationOccurrences', overrideAccess: true, depth: 0 })).docs,
    ).toHaveLength(0)
    expect(
      (await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true, depth: 0 })).docs,
    ).toHaveLength(0)
    for (const source of sources)
      expect(
        await payload.findByID({ collection: 'patientClinicInquiries', id: source.id, overrideAccess: true, depth: 0 }),
      ).toMatchObject(source)
  })
})

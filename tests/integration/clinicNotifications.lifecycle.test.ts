import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import { createVerifiedPatientInquiry, submitGuestClinicInquiry } from '@/features/inquiryCommunication/service'
import { activateClinicNotificationsForTest, readClinicNotifications } from '@/features/clinicNotifications/service'
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

describe('clinic notification source-to-feed lifecycle', () => {
  let payload: Payload
  let clinicId: number
  let doctorId: number
  let staffReq: PayloadRequest
  let sourceReq: PayloadRequest
  const staffIds: Array<string | number> = []
  const patientIds: Array<string | number> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const cities = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const fixture = await createClinicFixture(payload, cities.docs[0]!.id, {
      slugPrefix: testSlug('clinicNotifications.lifecycle.test.ts'),
    })
    clinicId = fixture.clinic.id
    doctorId = fixture.doctor.id
    const staff = await createClinicTestUser(payload, {
      createdStaffIds: staffIds,
      emailPrefix: 'notification-clinic',
    })
    staffReq = await createLocalReq({}, payload)
    staffReq.user = await asClinicScopedPayloadUser(payload, staff, clinicId)
    sourceReq = await createLocalReq({}, payload)
  }, 60_000)

  afterAll(async () => {
    await payload?.db.destroy?.()
  })

  it('does not capture preparatory history before the persisted activation boundary', async () => {
    await submitGuestClinicInquiry(sourceReq, {
      clinicId,
      doctorId,
      consent: true,
      email: 'before-activation@example.com',
      fullName: 'Before Activation',
      message: 'This qualifying inquiry predates notification activation.',
      phoneNumber: '+491234567890',
    })
    expect(await readClinicNotifications(staffReq, { mode: 'summary' })).toMatchObject({ unreadCount: 0 })
    expect(
      (await payload.find({ collection: 'clinicNotificationOccurrences', overrideAccess: true })).docs,
    ).toHaveLength(0)
  })

  it('captures one real guest inquiry once after activation and never marks it by reading', async () => {
    await activateClinicNotificationsForTest(sourceReq)
    const input = {
      clinicId,
      doctorId,
      consent: true,
      email: 'synthetic-notification@example.com',
      fullName: 'Jamie Carter',
      message: 'Private initial inquiry text must stay outside the notification envelope.',
      phoneNumber: '+491234567890',
    }
    const created = await submitGuestClinicInquiry(sourceReq, input)
    const repeated = await submitGuestClinicInquiry(sourceReq, input)
    expect(repeated).toEqual({ ...created, deduped: true })
    const feed = await readClinicNotifications(staffReq, { mode: 'page', view: 'unread' })
    expect(feed).toMatchObject({
      contractVersion: 'clinic-notifications-v1',
      mode: 'page',
      unreadCount: 1,
      items: [
        {
          kind: 'occurrence',
          display: { eventLabel: 'New inquiry', displayName: 'Jamie Carter' },
          destination: { kind: 'inquiry', inquiryId: created.id },
          members: [{ eventType: 'inquiry_created', readAt: null, sourceRecord: { kind: 'inquiry', id: created.id } }],
        },
      ],
    })
    expect(JSON.stringify(feed)).not.toContain(input.message)
    const receipts = await payload.find({ collection: 'clinicNotificationReadReceipts' as never, overrideAccess: true })
    expect(receipts.docs).toHaveLength(0)
    expect(await readClinicNotifications(staffReq, { mode: 'summary' })).toMatchObject({ unreadCount: 1 })
  })

  it('captures the verified source path once while preserving the original identity on replay', async () => {
    const patient = await createPatientTestUser(payload, {
      createdPatientIds: patientIds,
      emailPrefix: 'notification-patient',
      firstName: 'Ada',
      lastName: 'Patient',
    })
    const patientReq = await createLocalReq({}, payload)
    patientReq.user = asPayloadPatientUser(patient)
    const input = {
      clinicId: String(clinicId),
      doctorId: String(doctorId),
      consent: true as const,
      idempotencyKey: 'notification-verified-creation-0001',
      message: 'Initial verified source text.',
      phoneNumber: '+491234567890',
    }
    const first = await createVerifiedPatientInquiry(patientReq, input)
    const before = (
      await payload.find({
        collection: 'clinicNotificationOccurrences',
        overrideAccess: true,
        where: { sourceRecordId: { equals: first.inquiry.id } },
      })
    ).docs
    await createVerifiedPatientInquiry(patientReq, input)
    expect(
      (
        await payload.find({
          collection: 'clinicNotificationOccurrences',
          overrideAccess: true,
          where: { sourceRecordId: { equals: first.inquiry.id } },
        })
      ).docs,
    ).toEqual(before)
    expect(before).toHaveLength(1)
    expect(before[0]?.eventType).toBe('inquiry_created')
    const positions = (
      await payload.find({
        collection: 'inquiryReadPositions',
        overrideAccess: true,
        where: { inquiry: { equals: Number(first.inquiry.id) } },
      })
    ).docs
    await readClinicNotifications(staffReq, { mode: 'page', view: 'all' })
    await readClinicNotifications(staffReq, { mode: 'summary' })
    expect(
      (
        await payload.find({
          collection: 'inquiryReadPositions',
          overrideAccess: true,
          where: { inquiry: { equals: Number(first.inquiry.id) } },
        })
      ).docs,
    ).toEqual(positions)
  })

  it('rolls back the guest source and audit together when occurrence storage rejects the write', async () => {
    const hooks = payload.collections.clinicNotificationOccurrences.config.hooks
    const previous = hooks.beforeChange
    hooks.beforeChange = [
      ...(previous ?? []),
      () => {
        throw new Error('Synthetic occurrence storage failure')
      },
    ]
    try {
      await expect(
        submitGuestClinicInquiry(sourceReq, {
          clinicId,
          doctorId,
          consent: true,
          email: 'rollback-source@example.com',
          fullName: 'Rollback Source',
          message: 'This source must roll back with its occurrence.',
          phoneNumber: '+491234567890',
        }),
      ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' })
    } finally {
      hooks.beforeChange = previous
    }
    expect(
      (
        await payload.find({
          collection: 'patientClinicInquiries',
          overrideAccess: true,
          where: { email: { equals: 'rollback-source@example.com' } },
        })
      ).docs,
    ).toHaveLength(0)
    expect(await readClinicNotifications(staffReq, { mode: 'summary' })).toMatchObject({ unreadCount: 2 })
  })

  it('excludes expired occurrences immediately while their physical records still exist', async () => {
    const expiredId = (
      await submitGuestClinicInquiry(sourceReq, {
        clinicId,
        doctorId,
        consent: true,
        email: 'expired-source@example.com',
        fullName: 'Expired Source',
        message: 'This synthetic occurrence is beyond its retention deadline.',
        phoneNumber: '+491234567890',
      })
    ).id
    const stored = await payload.find({
      collection: 'clinicNotificationOccurrences',
      overrideAccess: true,
      where: { sourceRecordId: { equals: expiredId } },
    })
    expect(stored.docs).toHaveLength(1)
    try {
      vi.setSystemTime(new Date(Date.parse(stored.docs[0]!.expiresAt) - 1))
      expect(JSON.stringify(await readClinicNotifications(staffReq, { mode: 'page', view: 'all' }))).toContain(
        'Expired Source',
      )
      vi.setSystemTime(new Date(stored.docs[0]!.expiresAt))
      expect(await readClinicNotifications(staffReq, { mode: 'summary' })).toMatchObject({ unreadCount: 0 })
      const feed = await readClinicNotifications(staffReq, { mode: 'page', view: 'all' })
      expect(JSON.stringify(feed)).not.toContain('Expired Source')
      expect(
        (
          await payload.find({
            collection: 'clinicNotificationOccurrences',
            overrideAccess: true,
            where: { sourceRecordId: { equals: expiredId } },
          })
        ).docs,
      ).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects unguarded mutation and identity changes even through the Local API', async () => {
    const stored = await payload.find({ collection: 'clinicNotificationOccurrences', overrideAccess: true, limit: 1 })
    await expect(
      payload.update({
        collection: 'clinicNotificationOccurrences',
        id: stored.docs[0]!.id,
        overrideAccess: true,
        data: { occurredAt: new Date().toISOString() },
      }),
    ).rejects.toThrow('immutable domain records')
    expect(
      (
        await payload.find({
          collection: 'clinicNotificationOccurrences',
          overrideAccess: true,
          where: { id: { equals: stored.docs[0]!.id } },
        })
      ).docs,
    ).toEqual(stored.docs)
  })

  it('rechecks current clinic assignment before returning names or counts', async () => {
    const id = staffReq.user!.id
    const staff = await payload.findByID({ collection: 'clinicStaff', id, overrideAccess: true })
    await payload.update({ collection: 'clinicStaff', id, overrideAccess: true, data: { clinic: null } })
    try {
      await expect(readClinicNotifications(staffReq, { mode: 'summary' })).rejects.toMatchObject({
        code: 'CLINIC_ACCESS_DENIED',
      })
      await expect(readClinicNotifications(staffReq, { mode: 'page', view: 'all' })).rejects.toMatchObject({
        code: 'CLINIC_ACCESS_DENIED',
      })
    } finally {
      await payload.update({ collection: 'clinicStaff', id, overrideAccess: true, data: { clinic: staff.clinic } })
    }
  })

  it('retries an in-flight source transaction against the committed activation boundary', async () => {
    const control = (await payload.find({ collection: 'clinicNotificationControls', overrideAccess: true })).docs[0]!
    const transactionID = await payload.db.beginTransaction({ isolationLevel: 'serializable' })
    const controlReq = await createLocalReq(
      { context: { clinicNotificationCommand: true }, req: { transactionID: Promise.resolve(transactionID!) } },
      payload,
    )
    await payload.update({
      collection: 'clinicNotificationControls',
      id: control.id,
      overrideAccess: true,
      req: controlReq,
      data: { active: false, activatedAt: null },
    })
    await payload.db.commitTransaction(transactionID!)

    let entered!: () => void
    let proceed!: () => void
    const paused = new Promise<void>((resolve) => {
      entered = resolve
    })
    const released = new Promise<void>((resolve) => {
      proceed = resolve
    })
    const hooks = payload.collections.inquiryAuditEvents.config.hooks
    const previous = hooks.afterChange
    let waits = 0
    hooks.afterChange = [
      ...(previous ?? []),
      async ({ doc, req }) => {
        if (req.context?.notificationRaceSource === true && waits++ === 0) {
          entered()
          await released
        }
        return doc
      },
    ]
    const raceReq = await createLocalReq({ context: { notificationRaceSource: true } }, payload)
    const creating = submitGuestClinicInquiry(raceReq, {
      clinicId,
      doctorId,
      consent: true,
      email: 'activation-race@example.com',
      fullName: 'Activation Race',
      message: 'An in-flight source command must retry after activation commits.',
      phoneNumber: '+491234567890',
    })
    try {
      await paused
      await activateClinicNotificationsForTest(sourceReq)
      proceed()
      const created = await creating
      expect(waits).toBe(2)
      const stored = await payload.find({
        collection: 'clinicNotificationOccurrences',
        overrideAccess: true,
        where: { sourceRecordId: { equals: created.id } },
      })
      expect(stored.docs).toHaveLength(1)
      const audit = await payload.find({
        collection: 'inquiryAuditEvents',
        overrideAccess: true,
        where: { and: [{ inquiry: { equals: Number(created.id) } }, { eventType: { equals: 'inquiry-created' } }] },
      })
      expect(audit.docs).toHaveLength(1)
      expect(stored.docs[0]!.sourceOccurrenceId).toBe(String(audit.docs[0]!.id))
    } finally {
      proceed()
      await creating.catch(() => undefined)
      hooks.afterChange = previous
    }
  })

  it('bounds suitable source conflicts to three complete rolled-back attempts', async () => {
    const hooks = payload.collections.clinicNotificationControls.config.hooks
    const previous = hooks.beforeChange
    let attempts = 0
    hooks.beforeChange = [
      ...(previous ?? []),
      () => {
        attempts++
        throw Object.assign(new Error('Synthetic serialization conflict'), { code: '40001' })
      },
    ]
    try {
      await expect(
        submitGuestClinicInquiry(sourceReq, {
          clinicId,
          doctorId,
          consent: true,
          email: 'exhausted-retries@example.com',
          fullName: 'Exhausted Retries',
          message: 'Three bounded source attempts must leave no committed inquiry.',
          phoneNumber: '+491234567890',
        }),
      ).rejects.toMatchObject({ kind: 'conflict' })
    } finally {
      hooks.beforeChange = previous
    }
    expect(attempts).toBe(3)
    expect(
      (
        await payload.find({
          collection: 'patientClinicInquiries',
          overrideAccess: true,
          where: { email: { equals: 'exhausted-retries@example.com' } },
        })
      ).docs,
    ).toHaveLength(0)
  })
  it('refuses a missing native transaction session before any source write', async () => {
    const begin = vi.spyOn(payload.db, 'beginTransaction').mockResolvedValueOnce('missing-native-session')
    try {
      await expect(
        submitGuestClinicInquiry(sourceReq, {
          clinicId,
          doctorId,
          consent: true,
          email: 'missing-session@example.com',
          fullName: 'Missing Session',
          message: 'A fabricated session must never fall back to autocommit.',
          phoneNumber: '+491234567890',
        }),
      ).rejects.toThrow('active native transaction session')
    } finally {
      begin.mockRestore()
    }
    expect(
      (
        await payload.find({
          collection: 'patientClinicInquiries',
          overrideAccess: true,
          where: { email: { equals: 'missing-session@example.com' } },
        })
      ).docs,
    ).toHaveLength(0)
  })

  it('uses protected replay after a lost commit confirmation without duplicating the source or occurrence', async () => {
    const originalCommit = payload.db.commitTransaction.bind(payload.db)
    const commit = vi.spyOn(payload.db, 'commitTransaction').mockImplementationOnce(async (transactionID) => {
      await originalCommit(transactionID)
      throw new Error('Synthetic lost commit confirmation')
    })
    const input = {
      clinicId,
      doctorId,
      consent: true,
      email: 'unknown-commit@example.com',
      fullName: 'Unknown Commit',
      message: 'The commit outcome is unknown until protected replay resolves committed state.',
      phoneNumber: '+491234567890',
    }
    try {
      await expect(submitGuestClinicInquiry(sourceReq, input)).rejects.toThrow('Synthetic lost commit confirmation')
    } finally {
      commit.mockRestore()
    }
    const replay = await submitGuestClinicInquiry(sourceReq, input)
    expect(replay.deduped).toBe(true)
    expect(
      (
        await payload.find({
          collection: 'patientClinicInquiries',
          overrideAccess: true,
          where: { email: { equals: input.email } },
        })
      ).docs,
    ).toHaveLength(1)
    expect(
      (
        await payload.find({
          collection: 'clinicNotificationOccurrences',
          overrideAccess: true,
          where: { sourceRecordId: { equals: replay.id } },
        })
      ).docs,
    ).toHaveLength(1)
  })

  it('enforces canonical occurrence and personal receipt pair uniqueness in native storage', async () => {
    const occurrence = (
      await payload.find({ collection: 'clinicNotificationOccurrences', overrideAccess: true, limit: 1 })
    ).docs[0]!
    const transactionID = await payload.db.beginTransaction({ isolationLevel: 'serializable' })
    const req = await createLocalReq(
      { context: { clinicNotificationCommand: true }, req: { transactionID: Promise.resolve(transactionID!) } },
      payload,
    )
    try {
      await expect(
        payload.create({
          collection: 'clinicNotificationOccurrences',
          overrideAccess: true,
          req,
          data: {
            clinic: occurrence.clinic,
            notificationId: 'synthetic-distinct-notification-id',
            schemaVersion: occurrence.schemaVersion,
            eventType: occurrence.eventType,
            sourceRecordKind: occurrence.sourceRecordKind,
            sourceRecordId: occurrence.sourceRecordId,
            sourceOccurrenceKind: occurrence.sourceOccurrenceKind,
            sourceOccurrenceId: occurrence.sourceOccurrenceId,
            occurredAt: occurrence.occurredAt,
            expiresAt: occurrence.expiresAt,
          },
        }),
      ).rejects.toThrow()
    } finally {
      await payload.db.rollbackTransaction(transactionID!)
    }
    const receiptTransaction = await payload.db.beginTransaction({ isolationLevel: 'serializable' })
    const receiptReq = await createLocalReq(
      { context: { clinicNotificationCommand: true }, req: { transactionID: Promise.resolve(receiptTransaction!) } },
      payload,
    )
    const receipt = { occurrence: occurrence.id, clinicStaff: staffReq.user!.id, readAt: new Date().toISOString() }
    try {
      await payload.create({
        collection: 'clinicNotificationReadReceipts',
        data: receipt,
        overrideAccess: true,
        req: receiptReq,
      })
      await expect(
        payload.create({
          collection: 'clinicNotificationReadReceipts',
          data: receipt,
          overrideAccess: true,
          req: receiptReq,
        }),
      ).rejects.toThrow()
    } finally {
      await payload.db.rollbackTransaction(receiptTransaction!)
    }
    expect(
      (await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true })).docs,
    ).toHaveLength(0)
  })

  it('counts authorized unread entries beyond the complete initial twenty-five-entry page', async () => {
    for (let index = 0; index < 26; index++) {
      await submitGuestClinicInquiry(sourceReq, {
        clinicId,
        doctorId,
        consent: true,
        email: `notification-page-${index}@example.com`,
        fullName: `Page Patient ${index}`,
        message: 'Synthetic initial source for page boundary acceptance.',
        phoneNumber: '+491234567890',
      })
    }
    const feed = await readClinicNotifications(staffReq, { mode: 'page', view: 'unread' })
    expect(feed.mode).toBe('page')
    if (feed.mode !== 'page' || !('unreadCount' in feed))
      throw new Error('Expected an initial page with complete count')
    expect(feed.items).toHaveLength(25)
    expect(feed.unreadCount).toBeGreaterThan(25)
    expect(feed.nextCursor).toEqual(expect.any(String))
    expect(Buffer.byteLength(JSON.stringify(feed))).toBeLessThanOrEqual(524288)
    const summary = await readClinicNotifications(staffReq, { mode: 'summary' })
    expect(summary).toMatchObject({ unreadCount: feed.unreadCount })
  })
})

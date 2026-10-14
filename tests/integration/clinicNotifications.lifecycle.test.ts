import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import { createVerifiedPatientInquiry, submitGuestClinicInquiry } from '@/features/inquiryCommunication/service'
import {
  activateClinicNotificationsForTest,
  markClinicNotificationsRead,
  readClinicNotifications,
} from '@/features/clinicNotifications/service'
import {
  up as scopeMigrationUp,
  down as scopeMigrationDown,
} from '@/migrations/20261013_234505_clinic_notification_scope'
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

  it('serializes an in-flight source before activation and never retrofits its preparatory history', async () => {
    const control = (
      await payload.find({
        collection: 'clinicNotificationControls',
        overrideAccess: true,
        where: { key: { equals: 'notification-center' } },
      })
    ).docs[0]!
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
    let activationEntered!: () => void
    const paused = new Promise<void>((resolve) => {
      entered = resolve
    })
    const released = new Promise<void>((resolve) => {
      proceed = resolve
    })
    const activationAttempt = new Promise<void>((resolve) => {
      activationEntered = resolve
    })
    const hooks = payload.collections.inquiryAuditEvents.config.hooks
    const previous = hooks.afterChange
    const controlHooks = payload.collections.clinicNotificationControls.config.hooks
    const previousControl = controlHooks.beforeChange
    let waits = 0
    let activationSettled = false
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
    controlHooks.beforeChange = [
      ...(previousControl ?? []),
      ({ data, req }) => {
        if (req.context?.inquiryCommunicationCommand !== true) activationEntered()
        return data
      },
    ]
    const raceReq = await createLocalReq({ context: { notificationRaceSource: true } }, payload)
    const input = {
      clinicId,
      doctorId,
      consent: true as const,
      email: 'activation-race@example.com',
      fullName: 'Activation Race',
      message: 'The source owns the inactive activation boundary before its qualifying write.',
      phoneNumber: '+491234567890',
    }
    const creating = submitGuestClinicInquiry(raceReq, input)
    let activating: Promise<boolean> | undefined
    try {
      await paused
      activating = activateClinicNotificationsForTest(sourceReq).then(
        () => {
          activationSettled = true
          return true
        },
        () => {
          activationSettled = true
          return false
        },
      )
      await Promise.race([
        activationAttempt,
        activating.then(() => {
          throw new Error('Expected the controlled native activation barrier')
        }),
      ])
      expect(activationSettled).toBe(false)
      proceed()
      const created = await creating
      const activated = await activating
      expect(waits).toBe(1)
      expect(
        (
          await payload.find({
            collection: 'clinicNotificationOccurrences',
            overrideAccess: true,
            where: { and: [{ sourceRecordKind: { equals: 'inquiry' } }, { sourceRecordId: { equals: created.id } }] },
          })
        ).docs,
      ).toHaveLength(0)
      expect(
        (
          await payload.find({
            collection: 'inquiryAuditEvents',
            overrideAccess: true,
            where: { and: [{ inquiry: { equals: Number(created.id) } }, { eventType: { equals: 'inquiry-created' } }] },
          })
        ).docs,
      ).toHaveLength(1)
      if (!activated) {
        expect(
          (await payload.findByID({ collection: 'clinicNotificationControls', id: control.id, overrideAccess: true }))
            .active,
        ).toBe(false)
        await activateClinicNotificationsForTest(sourceReq)
      }
      expect((await submitGuestClinicInquiry(sourceReq, input)).deduped).toBe(true)
      expect(
        (
          await payload.find({
            collection: 'clinicNotificationOccurrences',
            overrideAccess: true,
            where: { sourceRecordId: { equals: created.id } },
          })
        ).docs,
      ).toHaveLength(0)
      const after = await submitGuestClinicInquiry(sourceReq, {
        ...input,
        email: 'activation-wins@example.com',
        fullName: 'Activation Wins',
        message: 'This new source starts after activation is committed.',
      })
      const captured = (
        await payload.find({
          collection: 'clinicNotificationOccurrences',
          overrideAccess: true,
          where: { sourceRecordId: { equals: after.id } },
        })
      ).docs
      expect(captured).toHaveLength(1)
      const audit = (
        await payload.find({
          collection: 'inquiryAuditEvents',
          overrideAccess: true,
          where: { and: [{ inquiry: { equals: Number(after.id) } }, { eventType: { equals: 'inquiry-created' } }] },
        })
      ).docs[0]!
      expect(captured[0]!.sourceOccurrenceId).toBe(String(audit.id))
      expect(captured[0]!.occurredAt).toBe(audit.createdAt)
    } finally {
      proceed()
      await creating.catch(() => undefined)
      await activating?.catch(() => undefined)
      hooks.afterChange = previous
      controlHooks.beforeChange = previousControl
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
            clinicScopeId: occurrence.clinicScopeId!,
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

  it('marks the fixed personal selection atomically and preserves the first receipt across replay', async () => {
    const page = await readClinicNotifications(staffReq, { mode: 'page', view: 'unread' })
    if (page.mode !== 'page') throw new Error('Expected page')
    const notificationIds = page.items
      .slice(0, 2)
      .flatMap((item) => item.members.map((member) => member.notificationId))
    expect(notificationIds).toHaveLength(2)
    const businessBefore = (
      await payload.find({
        collection: 'patientClinicInquiries',
        overrideAccess: true,
        depth: 0,
        where: { clinic: { equals: clinicId } },
        limit: 100,
      })
    ).docs
    const positionsBefore = (
      await payload.find({ collection: 'inquiryReadPositions', overrideAccess: true, depth: 0, limit: 100 })
    ).docs
    const first = await markClinicNotificationsRead(staffReq, { notificationIds })
    expect(
      (
        await payload.find({
          collection: 'patientClinicInquiries',
          overrideAccess: true,
          depth: 0,
          where: { clinic: { equals: clinicId } },
          limit: 100,
        })
      ).docs,
    ).toEqual(businessBefore)
    expect(
      (await payload.find({ collection: 'inquiryReadPositions', overrideAccess: true, depth: 0, limit: 100 })).docs,
    ).toEqual(positionsBefore)
    expect(first).toMatchObject({ contractVersion: 'clinic-notifications-v1', acknowledged: true })
    const receipts = (await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true })).docs
    expect(receipts).toHaveLength(2)
    await markClinicNotificationsRead(staffReq, {
      notificationIds: [...notificationIds, ...notificationIds, 'missing'],
    })
    expect((await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true })).docs).toEqual(
      receipts,
    )
    const all = await readClinicNotifications(staffReq, { mode: 'page', view: 'all' })
    if (all.mode !== 'page') throw new Error('Expected page')
    expect(
      all.items
        .flatMap((item) => item.members)
        .filter((member) => notificationIds.includes(member.notificationId))
        .every((member) => member.readAt !== null),
    ).toBe(true)
    const second = await createClinicTestUser(payload, {
      createdStaffIds: staffIds,
      emailPrefix: 'notification-other-reader',
    })
    const secondReq = await createLocalReq({}, payload)
    secondReq.user = await asClinicScopedPayloadUser(payload, second, clinicId)
    const otherPage = await readClinicNotifications(secondReq, { mode: 'page', view: 'unread' })
    if (otherPage.mode !== 'page') throw new Error('Expected page')
    expect(
      otherPage.items
        .flatMap((item) => item.members)
        .filter((member) => notificationIds.includes(member.notificationId)),
    ).toHaveLength(2)
  })

  it('rolls back every personal receipt when the second member write fails', async () => {
    const page = await readClinicNotifications(staffReq, { mode: 'page', view: 'unread' })
    if (page.mode !== 'page') throw new Error('Expected page')
    const notificationIds = page.items
      .slice(0, 2)
      .flatMap((item) => item.members.map((member) => member.notificationId))
    const before = (await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true })).docs
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
      await expect(markClinicNotificationsRead(staffReq, { notificationIds })).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
        writeOutcome: 'not_committed',
      })
    } finally {
      hooks.afterChange = previous
    }
    expect((await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true })).docs).toEqual(
      before,
    )
  })

  it('does not retry an unknown submitted commit and preserves its first receipt on manual replay', async () => {
    const page = await readClinicNotifications(staffReq, { mode: 'page', view: 'unread' })
    if (page.mode !== 'page') throw new Error('Expected page')
    const notificationIds = page.items[0]!.members.map((member) => member.notificationId)
    const originalCommit = payload.db.commitTransaction.bind(payload.db)
    const commit = vi.spyOn(payload.db, 'commitTransaction').mockImplementationOnce(async (transactionID) => {
      await originalCommit(transactionID)
      throw new Error('Synthetic lost acknowledgement commit confirmation')
    })
    try {
      await expect(markClinicNotificationsRead(staffReq, { notificationIds })).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
        writeOutcome: 'unknown',
      })
      expect(commit).toHaveBeenCalledTimes(1)
    } finally {
      commit.mockRestore()
    }
    const before = (await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true })).docs
    await markClinicNotificationsRead(staffReq, { notificationIds })
    expect((await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true })).docs).toEqual(
      before,
    )
  })

  it('linearizes current staff offboarding against acknowledgement before either native transaction commits', async () => {
    const original = await payload.findByID({ collection: 'clinicStaff', id: staffReq.user!.id, overrideAccess: true })
    const page = await readClinicNotifications(staffReq, { mode: 'page', view: 'unread' })
    if (page.mode !== 'page') throw new Error('Expected page')
    const notificationIds = page.items[0]!.members.map((member) => member.notificationId)
    let entered!: () => void
    let proceed!: () => void
    const paused = new Promise<void>((resolve) => {
      entered = resolve
    })
    const released = new Promise<void>((resolve) => {
      proceed = resolve
    })
    const hooks = payload.collections.clinicStaff.config.hooks
    const previous = hooks.afterChange
    hooks.afterChange = [
      ...(previous ?? []),
      async ({ doc, req }) => {
        if (req.context?.notificationOffboardRace) {
          entered()
          await released
        }
        return doc
      },
    ]
    const offboard = payload.update({
      collection: 'clinicStaff',
      id: staffReq.user!.id,
      overrideAccess: true,
      data: { clinic: null },
      context: { notificationOffboardRace: true },
    })
    try {
      await paused
      let acknowledgementEntered!: () => void
      const acknowledgementPaused = new Promise<void>((resolve) => {
        acknowledgementEntered = resolve
      })
      const controlHooks = payload.collections.clinicNotificationControls.config.hooks
      const previousControl = controlHooks.beforeChange
      controlHooks.beforeChange = [
        ...(previousControl ?? []),
        ({ data, req }) => {
          if (req.context?.notificationAcknowledgeRace) acknowledgementEntered()
          return data
        },
      ]
      const markReq = await createLocalReq(
        { context: { notificationAcknowledgeRace: true }, user: staffReq.user! },
        payload,
      )
      const marking = markClinicNotificationsRead(markReq, { notificationIds })
      await acknowledgementPaused
      controlHooks.beforeChange = previousControl
      proceed()
      await offboard
      await expect(marking).rejects.toMatchObject({ writeOutcome: 'not_committed' })
      await expect(markClinicNotificationsRead(staffReq, { notificationIds })).rejects.toMatchObject({
        code: 'CLINIC_ACCESS_DENIED',
        writeOutcome: 'not_committed',
      })
      const occurrence = (
        await payload.find({
          collection: 'clinicNotificationOccurrences',
          where: { notificationId: { equals: notificationIds[0]! } },
          overrideAccess: true,
        })
      ).docs[0]!
      expect(
        (
          await payload.find({
            collection: 'clinicNotificationReadReceipts',
            where: { occurrence: { equals: occurrence.id } },
            overrideAccess: true,
          })
        ).docs,
      ).toHaveLength(0)
    } finally {
      proceed()
      await offboard.catch(() => undefined)
      hooks.afterChange = previous
      await payload.update({
        collection: 'clinicStaff',
        id: original.id,
        overrideAccess: true,
        data: { clinic: original.clinic },
      })
    }
  })

  it('skips fixed missing, foreign and expired selections without writes or widening to later arrivals', async () => {
    const before = (await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true })).docs
    const control = (await payload.find({ collection: 'clinicNotificationControls', overrideAccess: true })).docs[0]!
    await markClinicNotificationsRead(staffReq, { notificationIds: ['missing'] })
    await markClinicNotificationsRead(staffReq, { notificationIds: [] })
    expect((await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true })).docs).toEqual(
      before,
    )
    expect(
      (await payload.findByID({ collection: 'clinicNotificationControls', id: control.id, overrideAccess: true }))
        .nonce,
    ).toBe(control.nonce)
    const page = await readClinicNotifications(staffReq, { mode: 'page', view: 'unread' })
    if (page.mode !== 'page') throw new Error('Expected page')
    const member = page.items[0]!.members[0]!
    try {
      vi.setSystemTime(new Date(member.expiresAt))
      await markClinicNotificationsRead(staffReq, { notificationIds: [member.notificationId] })
      expect((await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true })).docs).toEqual(
        before,
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('preserves unique personal receipts under concurrent acknowledgements and a safe manual repetition', async () => {
    const page = await readClinicNotifications(staffReq, { mode: 'page', view: 'unread' })
    if (page.mode !== 'page') throw new Error('Expected page')
    const notificationIds = page.items[0]!.members.map((member) => member.notificationId)
    const outcomes = await Promise.allSettled([
      markClinicNotificationsRead(staffReq, { notificationIds }),
      markClinicNotificationsRead(staffReq, { notificationIds }),
    ])
    expect(outcomes.some((outcome) => outcome.status === 'fulfilled')).toBe(true)
    for (const outcome of outcomes)
      if (outcome.status === 'rejected') expect(outcome.reason).toMatchObject({ writeOutcome: 'not_committed' })
    const first = (await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true })).docs
    await markClinicNotificationsRead(staffReq, { notificationIds })
    expect((await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true })).docs).toEqual(
      first,
    )
  })

  it('keeps native staff hard deletion available after personal marking without orphaning receipts', async () => {
    const deletedReader = await createClinicTestUser(payload, {
      createdStaffIds: staffIds,
      emailPrefix: 'notification-deleted-reader',
    })
    const readerReq = await createLocalReq({}, payload)
    readerReq.user = await asClinicScopedPayloadUser(payload, deletedReader, clinicId)
    const page = await readClinicNotifications(readerReq, { mode: 'page', view: 'unread' })
    if (page.mode !== 'page') throw new Error('Expected page')
    await markClinicNotificationsRead(readerReq, {
      notificationIds: page.items[0]!.members.map((member) => member.notificationId),
    })
    const occurrencesBefore = (
      await payload.find({ collection: 'clinicNotificationOccurrences', overrideAccess: true, limit: 100 })
    ).docs
    await payload.delete({ collection: 'clinicStaff', id: readerReq.user!.id, depth: 0, overrideAccess: true })
    expect(
      (
        await payload.find({
          collection: 'clinicNotificationReadReceipts',
          where: { clinicStaff: { equals: readerReq.user!.id } },
          overrideAccess: true,
        })
      ).docs,
    ).toHaveLength(0)
    expect(
      (await payload.find({ collection: 'clinicNotificationOccurrences', overrideAccess: true, limit: 100 })).docs,
    ).toEqual(occurrencesBefore)
    await expect(markClinicNotificationsRead(readerReq, { notificationIds: [] })).rejects.toMatchObject({
      code: 'CLINIC_ACCESS_DENIED',
    })
  })

  it('rolls back prepared receipts when a selected occurrence expires before the final atomic decision', async () => {
    const page = await readClinicNotifications(staffReq, { mode: 'page', view: 'unread' })
    if (page.mode !== 'page') throw new Error('Expected page')
    const member = page.items[0]!.members[0]!
    const before = (await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true })).docs
    const hooks = payload.collections.clinicNotificationReadReceipts.config.hooks
    const previous = hooks.afterChange
    hooks.afterChange = [
      ...(previous ?? []),
      ({ doc }) => {
        vi.setSystemTime(new Date(member.expiresAt))
        return doc
      },
    ]
    try {
      expect(await markClinicNotificationsRead(staffReq, { notificationIds: [member.notificationId] })).toMatchObject({
        acknowledged: true,
      })
      expect((await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true })).docs).toEqual(
        before,
      )
    } finally {
      hooks.afterChange = previous
      vi.useRealTimers()
    }
  })

  it('commits a decision made before expiry even when commit confirmation arrives at the deadline', async () => {
    const source = await submitGuestClinicInquiry(sourceReq, {
      clinicId,
      doctorId,
      consent: true,
      email: 'delayed-acknowledgement@example.com',
      fullName: 'Delayed Acknowledgement',
      message: 'The authorized decision precedes the deadline; its commit may finish afterward.',
      phoneNumber: '+493000000557',
    })
    const occurrence = (
      await payload.find({
        collection: 'clinicNotificationOccurrences',
        overrideAccess: true,
        depth: 0,
        where: { sourceRecordId: { equals: source.id } },
      })
    ).docs[0]!
    const originalCommit = payload.db.commitTransaction.bind(payload.db)
    let preparedReadAt: string | undefined
    let commit: ReturnType<typeof vi.spyOn> | undefined
    try {
      vi.setSystemTime(new Date(Date.parse(occurrence.expiresAt) - 1))
      const before = await readClinicNotifications(staffReq, { mode: 'summary' })
      if (before.mode !== 'summary') throw new Error('Expected summary')
      commit = vi.spyOn(payload.db, 'commitTransaction').mockImplementationOnce(async (transactionID) => {
        const transactionReq = await createLocalReq({ req: { transactionID: Promise.resolve(transactionID) } }, payload)
        const prepared = (
          await payload.find({
            collection: 'clinicNotificationReadReceipts',
            depth: 0,
            overrideAccess: true,
            req: transactionReq,
            where: { and: [{ occurrence: { equals: occurrence.id } }, { clinicStaff: { equals: staffReq.user!.id } }] },
          })
        ).docs
        expect(prepared).toHaveLength(1)
        preparedReadAt = prepared[0]!.readAt
        vi.setSystemTime(new Date(occurrence.expiresAt))
        await originalCommit(transactionID)
      })
      expect(await markClinicNotificationsRead(staffReq, { notificationIds: [occurrence.notificationId] })).toEqual({
        contractVersion: 'clinic-notifications-v1',
        serverTime: occurrence.expiresAt,
        acknowledged: true,
      })
      expect(commit).toHaveBeenCalledTimes(1)
      commit.mockRestore()
      commit = undefined
      const receipts = (
        await payload.find({
          collection: 'clinicNotificationReadReceipts',
          depth: 0,
          overrideAccess: true,
          where: { occurrence: { equals: occurrence.id } },
        })
      ).docs
      expect(receipts).toHaveLength(1)
      expect(receipts[0]!.readAt).toBe(preparedReadAt)
      expect(Date.parse(receipts[0]!.readAt)).toBeLessThan(Date.parse(occurrence.expiresAt))
      expect(await readClinicNotifications(staffReq, { mode: 'summary' })).toMatchObject({
        unreadCount: before.unreadCount - 1,
      })
      for (const view of ['unread', 'all'] as const) {
        const page = await readClinicNotifications(staffReq, { mode: 'page', view })
        if (page.mode !== 'page') throw new Error('Expected page')
        expect(
          page.items
            .flatMap((item) => item.members)
            .some((member) => member.notificationId === occurrence.notificationId),
        ).toBe(false)
      }
      await markClinicNotificationsRead(staffReq, { notificationIds: [occurrence.notificationId] })
      expect(
        (
          await payload.find({
            collection: 'clinicNotificationReadReceipts',
            depth: 0,
            overrideAccess: true,
            where: { occurrence: { equals: occurrence.id } },
          })
        ).docs,
      ).toEqual(receipts)
    } finally {
      commit?.mockRestore()
      vi.useRealTimers()
    }
  })

  it('reevaluates only the original selection when one prepared member expires before the final decision', async () => {
    let first!: { id: string }
    let second!: { id: string }
    let later!: { id: string }
    const hooks = payload.collections.clinicNotificationReadReceipts.config.hooks
    const previous = hooks.afterChange
    try {
      vi.setSystemTime(new Date('2026-12-01T10:00:00.000Z'))
      first = await submitGuestClinicInquiry(sourceReq, {
        clinicId,
        doctorId,
        consent: true,
        email: 'selection-first@example.com',
        fullName: 'Selection First',
        message: 'First fixed selected occurrence.',
        phoneNumber: '+493000000558',
      })
      vi.setSystemTime(new Date('2026-12-01T10:05:00.000Z'))
      second = await submitGuestClinicInquiry(sourceReq, {
        clinicId,
        doctorId,
        consent: true,
        email: 'selection-second@example.com',
        fullName: 'Selection Second',
        message: 'Second fixed selected occurrence.',
        phoneNumber: '+493000000559',
      })
      const fixed = (
        await payload.find({
          collection: 'clinicNotificationOccurrences',
          overrideAccess: true,
          depth: 0,
          where: { sourceRecordId: { in: [first.id, second.id] } },
        })
      ).docs
      const notificationIds = fixed.map((occurrence) => occurrence.notificationId)
      const firstOccurrence = fixed.find((occurrence) => occurrence.sourceRecordId === first.id)!
      const secondOccurrence = fixed.find((occurrence) => occurrence.sourceRecordId === second.id)!
      vi.setSystemTime(new Date('2026-12-01T10:10:00.000Z'))
      later = await submitGuestClinicInquiry(sourceReq, {
        clinicId,
        doctorId,
        consent: true,
        email: 'selection-later@example.com',
        fullName: 'Selection Later',
        message: 'A later occurrence must never widen the fixed selection.',
        phoneNumber: '+493000000560',
      })
      const laterOccurrence = (
        await payload.find({
          collection: 'clinicNotificationOccurrences',
          overrideAccess: true,
          depth: 0,
          where: { sourceRecordId: { equals: later.id } },
        })
      ).docs[0]!
      let writes = 0
      hooks.afterChange = [
        ...(previous ?? []),
        ({ doc }) => {
          writes++
          vi.setSystemTime(new Date(firstOccurrence.expiresAt))
          return doc
        },
      ]
      expect(await markClinicNotificationsRead(staffReq, { notificationIds })).toMatchObject({ acknowledged: true })
      expect(writes).toBeGreaterThan(1)
      const receipts = (
        await payload.find({
          collection: 'clinicNotificationReadReceipts',
          overrideAccess: true,
          depth: 0,
          where: { occurrence: { in: [firstOccurrence.id, secondOccurrence.id, laterOccurrence.id] } },
        })
      ).docs
      expect(receipts).toHaveLength(1)
      expect(receipts[0]!.occurrence).toBe(secondOccurrence.id)
      expect(await readClinicNotifications(staffReq, { mode: 'summary' })).toMatchObject({
        unreadCount: 1,
        nextUnreadCountChangeAt: laterOccurrence.expiresAt,
      })
      const all = await readClinicNotifications(staffReq, { mode: 'page', view: 'all' })
      if (all.mode !== 'page') throw new Error('Expected page')
      expect(
        all.items
          .flatMap((item) => item.members)
          .map((member) => member.notificationId)
          .sort(),
      ).toEqual([secondOccurrence.notificationId, laterOccurrence.notificationId].sort())
      expect(
        all.items
          .flatMap((item) => item.members)
          .find((member) => member.notificationId === laterOccurrence.notificationId)!.readAt,
      ).toBeNull()
    } finally {
      hooks.afterChange = previous
      vi.useRealTimers()
    }
  })

  it('rolls back both staff deletion and its receipt cleanup if permanent deletion fails', async () => {
    const reader = await createClinicTestUser(payload, {
      createdStaffIds: staffIds,
      emailPrefix: 'notification-delete-rollback',
    })
    const readerReq = await createLocalReq({}, payload)
    readerReq.user = await asClinicScopedPayloadUser(payload, reader, clinicId)
    const page = await readClinicNotifications(readerReq, { mode: 'page', view: 'unread' })
    if (page.mode !== 'page') throw new Error('Expected page')
    await markClinicNotificationsRead(readerReq, {
      notificationIds: page.items.slice(0, 2).flatMap((item) => item.members.map((member) => member.notificationId)),
    })
    const before = (await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true })).docs
    const hooks = payload.collections.clinicNotificationReadReceipts.config.hooks
    const previous = hooks.afterDelete
    hooks.afterDelete = [
      ...(previous ?? []),
      () => {
        throw new Error('Synthetic reader deletion cleanup failure')
      },
    ]
    try {
      await expect(
        payload.delete({ collection: 'clinicStaff', id: readerReq.user!.id, depth: 0, overrideAccess: true }),
      ).rejects.toThrow('Synthetic reader deletion cleanup failure')
    } finally {
      hooks.afterDelete = previous
    }
    expect(
      (await payload.findByID({ collection: 'clinicStaff', id: readerReq.user!.id, depth: 0, overrideAccess: true }))
        .id,
    ).toBe(readerReq.user!.id)
    expect((await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true })).docs).toEqual(
      before,
    )
  })

  it('refuses native bulk offboarding after losing its original session without committing later members', async () => {
    const readers = []
    for (let index = 0; index < 3; index++) {
      const reader = await createClinicTestUser(payload, {
        createdStaffIds: staffIds,
        emailPrefix: `notification-bulk-${index}`,
      })
      readers.push(await asClinicScopedPayloadUser(payload, reader, clinicId))
    }
    const ids = readers.map((reader) => reader.id)
    const before = (
      await payload.find({
        collection: 'clinicStaff',
        overrideAccess: true,
        depth: 0,
        where: { id: { in: ids } },
        limit: 10,
      })
    ).docs
    const hooks = payload.collections.clinicStaff.config.hooks
    const previous = hooks.afterChange
    let writes = 0
    hooks.afterChange = [
      ...(previous ?? []),
      async ({ doc, req }) => {
        if (req.context?.notificationBulkFailure && ++writes === 2) {
          await req.payload.db.rollbackTransaction((await req.transactionID)!)
          delete req.transactionID
          throw new Error('Synthetic bulk native session failure')
        }
        return doc
      },
    ]
    try {
      await expect(
        payload.update({
          collection: 'clinicStaff',
          depth: 0,
          overrideAccess: true,
          context: { notificationBulkFailure: true },
          where: { id: { in: ids } },
          data: { clinic: null },
        }),
      ).rejects.toThrow('active native transaction session')
    } finally {
      hooks.afterChange = previous
    }
    expect(
      (
        await payload.find({
          collection: 'clinicStaff',
          overrideAccess: true,
          depth: 0,
          where: { id: { in: ids } },
          limit: 10,
        })
      ).docs,
    ).toEqual(before)
  })

  it('backfills existing occurrence scopes idempotently without changing identities, deadlines or receipts', async () => {
    const hooks = payload.collections.clinicNotificationOccurrences.config.hooks
    const previous = hooks.beforeChange
    hooks.beforeChange = [
      ...(previous ?? []),
      ({ data }) => {
        delete data.clinicScopeId
        return data
      },
    ]
    let legacyInquiryId: string
    try {
      legacyInquiryId = (
        await submitGuestClinicInquiry(sourceReq, {
          clinicId,
          doctorId,
          consent: true,
          email: 'legacy-scope@example.com',
          fullName: 'Legacy Scope',
          message: 'A real synthetic source delivered by the previous producer shape.',
          phoneNumber: '+493000000555',
        })
      ).id
    } finally {
      hooks.beforeChange = previous
    }
    const legacy = (
      await payload.find({
        collection: 'clinicNotificationOccurrences',
        where: { sourceRecordId: { equals: legacyInquiryId! } },
        depth: 0,
        overrideAccess: true,
      })
    ).docs[0]!
    expect(legacy.clinicScopeId).toBeNull()
    const transactionID = await payload.db.beginTransaction({ isolationLevel: 'serializable' })
    const receiptReq = await createLocalReq(
      { context: { clinicNotificationCommand: true }, req: { transactionID: Promise.resolve(transactionID!) } },
      payload,
    )
    await payload.create({
      collection: 'clinicNotificationReadReceipts',
      data: { occurrence: legacy.id, clinicStaff: staffReq.user!.id as number, readAt: new Date().toISOString() },
      depth: 0,
      overrideAccess: true,
      req: receiptReq,
    })
    await payload.db.commitTransaction(transactionID!)
    const receipts = (
      await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true, depth: 0 })
    ).docs
    for (const name of ['test_notification_scope_replay_one', 'test_notification_scope_replay_two']) {
      await payload.db.migrate({
        migrations: [{ name, up: scopeMigrationUp as never, down: scopeMigrationDown as never }],
      })
      const migrated = await payload.findByID({
        collection: 'clinicNotificationOccurrences',
        id: legacy.id,
        depth: 0,
        overrideAccess: true,
      })
      expect(migrated).toEqual({ ...legacy, clinicScopeId: String(clinicId) })
      expect(
        (await payload.find({ collection: 'clinicNotificationReadReceipts', overrideAccess: true, depth: 0 })).docs,
      ).toEqual(receipts)
      expect(
        (
          await payload.find({
            collection: 'clinicNotificationOccurrences',
            overrideAccess: true,
            depth: 0,
            where: { clinicScopeId: { exists: false } },
          })
        ).totalDocs,
      ).toBe(0)
    }
  })

  it('preserves scalar occurrence history when a clinic is permanently deleted after its source records', async () => {
    const cities = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const fixture = await createClinicFixture(payload, cities.docs[0]!.id, {
      clinicIndex: 2,
      doctorIndex: 2,
      slugPrefix: 'notification-deleted-clinic',
    })
    const source = await submitGuestClinicInquiry(sourceReq, {
      clinicId: fixture.clinic.id,
      doctorId: fixture.doctor.id,
      consent: true,
      email: 'deleted-clinic-scope@example.com',
      fullName: 'Deleted Clinic Scope',
      message: 'The occurrence must survive physical clinic removal.',
      phoneNumber: '+493000000556',
    })
    const before = (
      await payload.find({
        collection: 'clinicNotificationOccurrences',
        overrideAccess: true,
        depth: 0,
        where: { sourceRecordId: { equals: source.id } },
      })
    ).docs[0]!
    for (const collection of [
      'inquiryAuditEvents',
      'inquiryReadPositions',
      'inquiryMessages',
      'inquiryInternalNotes',
      'inquiryAttachments',
      'inquiryConversations',
    ] as const)
      await payload.delete({
        collection,
        overrideAccess: true,
        depth: 0,
        where: { inquiry: { equals: Number(source.id) } },
      })
    await payload.delete({
      collection: 'patientClinicInquiries',
      id: Number(source.id),
      overrideAccess: true,
      depth: 0,
    })
    await payload.delete({ collection: 'doctors', id: fixture.doctor.id, overrideAccess: true, depth: 0 })
    await payload.delete({ collection: 'clinics', id: fixture.clinic.id, overrideAccess: true, depth: 0 })
    const after = await payload.findByID({
      collection: 'clinicNotificationOccurrences',
      id: before.id,
      overrideAccess: true,
      depth: 0,
    })
    expect(after).toEqual({ ...before, clinic: null })
    expect(after.clinicScopeId).toBe(String(fixture.clinic.id))
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

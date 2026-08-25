import { randomUUID } from 'node:crypto'

import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'

import config from '@payload-config'
import {
  createAttachmentDraft,
  createVerifiedPatientInquiry,
  discardAttachmentDraft,
  finalizeAttachmentDraft,
  INQUIRY_ATTACHMENT_DRAFT_LIMITS,
  sendPatientInquiryMessage,
} from '@/features/inquiryCommunication/service'
import type { InquiryAttachmentStorageGateway } from '@/features/inquiryCommunication/storage'
import { deriveDatabaseConfig } from '../../scripts/test-database-harness.mjs'
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

const { Client } = pg

type ActorFixture = {
  actorKey: string
  clinicId: number
  inquiryId: string
  patientId: number
  req: PayloadRequest
  user: NonNullable<PayloadRequest['user']>
}

type SeedAttachmentState = 'discarded' | 'draft'

const createMemoryStorage = (): InquiryAttachmentStorageGateway => ({
  createReadAccess: vi.fn(async () => ({
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    method: 'GET' as const,
    url: 'https://storage.example.invalid/private-read',
  })),
  createUpload: vi.fn(async () => ({
    headers: { 'content-type': 'application/pdf' },
    method: 'PUT' as const,
    url: 'https://storage.example.invalid/private-draft',
  })),
  deleteObjects: vi.fn(async () => undefined),
  sealDraft: vi.fn(async ({ declaredMimeType, declaredSizeBytes, readyObjectKey }) => ({
    mimeType: declaredMimeType,
    readyObjectKey,
    sizeBytes: declaredSizeBytes,
  })),
  verifySealed: vi.fn(async () => undefined),
})

describe.sequential('inquiry attachment quotas with PostgreSQL', () => {
  let payload: Payload
  let sqlClient: InstanceType<typeof Client>
  let activeTarget: ActorFixture
  let activeSameClinicForeign: ActorFixture
  let reservationTarget: ActorFixture
  let reservationSameClinicForeign: ActorFixture
  let foreignClinicActor: ActorFixture
  let concurrencyTarget: ActorFixture
  const createdClinicIds: number[] = []
  const createdDoctorIds: number[] = []
  const createdInquiryIds: Array<number | string> = []
  const createdPatientIds: Array<number | string> = []
  const createdStaffIds: Array<number | string> = []
  const slugPrefix = testSlug('inquiryCommunication.attachmentQuota.postgres.test.ts')

  const createActorFixture = async (clinicId: number, doctorId: number, suffix: string): Promise<ActorFixture> => {
    const patient = await createPatientTestUser(payload, {
      createdPatientIds,
      emailPrefix: `${slugPrefix}-${suffix}`,
      firstName: 'Synthetic',
      lastName: `Quota ${suffix}`,
    })
    const req = await createLocalReq({}, payload)
    const user = asPayloadPatientUser(patient)
    req.user = user
    const created = await createVerifiedPatientInquiry(req, {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(doctorId),
      idempotencyKey: `${slugPrefix}-${suffix}-create`,
      message: `Synthetic attachment quota inquiry for ${suffix}.`,
      phoneNumber: '+493000000071',
    })
    createdInquiryIds.push(created.inquiry.id)
    return {
      actorKey: `patients:${String(patient.id)}`,
      clinicId,
      inquiryId: created.inquiry.id,
      patientId: patient.id,
      req,
      user,
    }
  }

  const seedAttachments = async (
    actor: ActorFixture,
    options: { count: number; objectCreatedAt: Date; state: SeedAttachmentState },
  ): Promise<void> => {
    const batch = `${slugPrefix}-${randomUUID()}`
    const expiresAt = new Date(options.objectCreatedAt.getTime() + 15 * 60 * 1_000).toISOString()
    await sqlClient.query(
      `INSERT INTO inquiry_attachments (
         inquiry_id,
         clinic_id,
         patient_id,
         owner_kind,
         owner_patient_id,
         file_name,
         declared_mime_type,
         declared_size_bytes,
         state,
         expires_at,
         object_created_at,
         actor_key,
         draft_object_key
       )
       SELECT
         $1,
         $2,
         $3,
         'patient',
         $3,
         $4::text || '-' || generated.sequence::text || '.pdf',
         'application/pdf',
         4,
         $5::public.enum_inquiry_attachments_state,
         $6::timestamptz,
         $7::timestamptz,
         $8,
         $9::text || '/' || generated.sequence::text
       FROM generate_series(1, $10::integer) AS generated(sequence)`,
      [
        Number(actor.inquiryId),
        actor.clinicId,
        actor.patientId,
        batch,
        options.state,
        expiresAt,
        options.objectCreatedAt.toISOString(),
        actor.actorKey,
        `inquiry-communication/${actor.clinicId}/${actor.inquiryId}/${batch}/draft`,
        options.count,
      ],
    )
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const databaseConfig = deriveDatabaseConfig(process.env.DATABASE_URI)
    sqlClient = new Client({ connectionString: databaseConfig.connectionString })
    await sqlClient.connect()

    const city = (await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })).docs[0]
    if (!city) throw new Error('Expected a baseline city for the attachment quota integration test.')

    const clinicFixtures = []
    for (let index = 0; index < 4; index += 1) {
      const fixture = await createClinicFixture(payload, city.id, {
        clinicIndex: index,
        doctorIndex: index,
        slugPrefix: `${slugPrefix}-${index + 1}`,
      })
      await payload.update({
        collection: 'clinics',
        data: { status: 'approved' },
        depth: 0,
        id: fixture.clinic.id,
        overrideAccess: true,
      })
      const clinicStaff = await createClinicTestUser(payload, {
        createdStaffIds,
        emailPrefix: `${slugPrefix}-${index + 1}-staff`,
        firstName: 'Synthetic',
        lastName: `Quota Staff ${index + 1}`,
      })
      await asClinicScopedPayloadUser(payload, clinicStaff, fixture.clinic.id)
      createdClinicIds.push(fixture.clinic.id)
      createdDoctorIds.push(fixture.doctor.id)
      clinicFixtures.push(fixture)
    }

    const activeClinic = clinicFixtures[0]
    const reservationClinic = clinicFixtures[1]
    const foreignClinic = clinicFixtures[2]
    const concurrencyClinic = clinicFixtures[3]
    if (!activeClinic || !reservationClinic || !foreignClinic || !concurrencyClinic) {
      throw new Error('Expected four synthetic clinics for isolated attachment quota scopes.')
    }

    activeTarget = await createActorFixture(activeClinic.clinic.id, activeClinic.doctor.id, 'active-target')
    activeSameClinicForeign = await createActorFixture(
      activeClinic.clinic.id,
      activeClinic.doctor.id,
      'active-same-clinic-foreign',
    )
    reservationTarget = await createActorFixture(
      reservationClinic.clinic.id,
      reservationClinic.doctor.id,
      'reservation-target',
    )
    reservationSameClinicForeign = await createActorFixture(
      reservationClinic.clinic.id,
      reservationClinic.doctor.id,
      'reservation-same-clinic-foreign',
    )
    foreignClinicActor = await createActorFixture(foreignClinic.clinic.id, foreignClinic.doctor.id, 'foreign-clinic')
    concurrencyTarget = await createActorFixture(
      concurrencyClinic.clinic.id,
      concurrencyClinic.doctor.id,
      'concurrency-target',
    )
  }, 60_000)

  afterAll(async () => {
    if (payload) {
      for (const collection of [
        'inquiryAuditEvents',
        'inquiryReadPositions',
        'inquiryMessages',
        'inquiryInternalNotes',
        'inquiryAttachments',
        'inquiryConversations',
      ] as const) {
        await payload.delete({
          collection,
          overrideAccess: true,
          trash: true,
          where: { inquiry: { in: createdInquiryIds } },
        })
      }
      for (const id of createdInquiryIds) {
        await payload.delete({ collection: 'patientClinicInquiries', id, overrideAccess: true, trash: true })
      }
      await cleanupTrackedUsers(payload, { patientIds: createdPatientIds, staffIds: createdStaffIds })
      for (const id of createdDoctorIds) {
        await payload.delete({ collection: 'doctors', id, overrideAccess: true, trash: true })
      }
      for (const id of createdClinicIds) {
        await payload.delete({ collection: 'clinics', id, overrideAccess: true, trash: true })
      }
    }
    await sqlClient?.end().catch(() => undefined)
  }, 60_000)

  it('separates active capacity by actor, clinic, and terminal attachment state', async () => {
    const storage = createMemoryStorage()
    const boundDraft = await createAttachmentDraft(
      activeTarget.req,
      {
        fileName: 'synthetic-bound.pdf',
        inquiryId: activeTarget.inquiryId,
        mimeType: 'application/pdf',
        sizeBytes: 4,
      },
      storage,
    )
    const bound = await finalizeAttachmentDraft(
      activeTarget.req,
      { draftId: boundDraft.draftId, inquiryId: activeTarget.inquiryId },
      storage,
    )
    await sendPatientInquiryMessage(
      activeTarget.req,
      {
        attachmentDraftId: bound.attachment.id,
        expectedRevision: 0,
        idempotencyKey: `${slugPrefix}-bind-active-scope`,
        inquiryId: activeTarget.inquiryId,
      },
      storage,
    )

    const discardedDraft = await createAttachmentDraft(
      activeTarget.req,
      {
        fileName: 'synthetic-discarded.pdf',
        inquiryId: activeTarget.inquiryId,
        mimeType: 'application/pdf',
        sizeBytes: 4,
      },
      storage,
    )
    await discardAttachmentDraft(activeTarget.req, {
      draftId: discardedDraft.draftId,
      inquiryId: activeTarget.inquiryId,
    })

    const now = new Date()
    await seedAttachments(activeTarget, {
      count: INQUIRY_ATTACHMENT_DRAFT_LIMITS.activePerActor - 1,
      objectCreatedAt: now,
      state: 'draft',
    })
    await seedAttachments(activeSameClinicForeign, {
      count: INQUIRY_ATTACHMENT_DRAFT_LIMITS.activePerClinic - (INQUIRY_ATTACHMENT_DRAFT_LIMITS.activePerActor - 1) - 1,
      objectCreatedAt: now,
      state: 'draft',
    })
    await seedAttachments(foreignClinicActor, {
      count: INQUIRY_ATTACHMENT_DRAFT_LIMITS.activePerClinic,
      objectCreatedAt: now,
      state: 'draft',
    })

    const before = await sqlClient.query<{
      active_for_actor: string
      active_for_clinic: string
      bound_for_actor: string
      discarded_for_actor: string
      foreign_clinic_active: string
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE actor_key = $1 AND state IN ('draft', 'verified'))::text AS active_for_actor,
         COUNT(*) FILTER (WHERE clinic_id = $2 AND state IN ('draft', 'verified'))::text AS active_for_clinic,
         COUNT(*) FILTER (WHERE actor_key = $1 AND state = 'bound')::text AS bound_for_actor,
         COUNT(*) FILTER (WHERE actor_key = $1 AND state = 'discarded')::text AS discarded_for_actor,
         COUNT(*) FILTER (WHERE clinic_id = $3 AND state IN ('draft', 'verified'))::text AS foreign_clinic_active
       FROM inquiry_attachments
       WHERE inquiry_id = ANY($4::integer[])`,
      [
        activeTarget.actorKey,
        activeTarget.clinicId,
        foreignClinicActor.clinicId,
        [
          Number(activeTarget.inquiryId),
          Number(activeSameClinicForeign.inquiryId),
          Number(foreignClinicActor.inquiryId),
        ],
      ],
    )
    expect(before.rows[0]).toEqual({
      active_for_actor: String(INQUIRY_ATTACHMENT_DRAFT_LIMITS.activePerActor - 1),
      active_for_clinic: String(INQUIRY_ATTACHMENT_DRAFT_LIMITS.activePerClinic - 1),
      bound_for_actor: '1',
      discarded_for_actor: '1',
      foreign_clinic_active: String(INQUIRY_ATTACHMENT_DRAFT_LIMITS.activePerClinic),
    })

    const winnerStorage = createMemoryStorage()
    await expect(
      createAttachmentDraft(
        activeTarget.req,
        {
          fileName: 'synthetic-last-active-slot.pdf',
          inquiryId: activeTarget.inquiryId,
          mimeType: 'application/pdf',
          sizeBytes: 4,
        },
        winnerStorage,
      ),
    ).resolves.toMatchObject({ draftId: expect.any(String) })
    expect(winnerStorage.createUpload).toHaveBeenCalledTimes(1)

    const blockedStorage = createMemoryStorage()
    await expect(
      createAttachmentDraft(
        activeTarget.req,
        {
          fileName: 'synthetic-over-active-capacity.pdf',
          inquiryId: activeTarget.inquiryId,
          mimeType: 'application/pdf',
          sizeBytes: 4,
        },
        blockedStorage,
      ),
    ).rejects.toMatchObject({ kind: 'rate-limited' })
    expect(blockedStorage.createUpload).not.toHaveBeenCalled()
  }, 60_000)

  it('separates the recent reservation window from old, foreign-actor, and foreign-clinic rows', async () => {
    const now = new Date()
    const old = new Date(now.getTime() - INQUIRY_ATTACHMENT_DRAFT_LIMITS.reservationWindowMs - 60_000)
    await seedAttachments(reservationTarget, {
      count: INQUIRY_ATTACHMENT_DRAFT_LIMITS.reservationsPerActor - 1,
      objectCreatedAt: now,
      state: 'discarded',
    })
    await seedAttachments(reservationTarget, {
      count: INQUIRY_ATTACHMENT_DRAFT_LIMITS.reservationsPerActor,
      objectCreatedAt: old,
      state: 'discarded',
    })
    await seedAttachments(reservationSameClinicForeign, {
      count:
        INQUIRY_ATTACHMENT_DRAFT_LIMITS.reservationsPerClinic -
        (INQUIRY_ATTACHMENT_DRAFT_LIMITS.reservationsPerActor - 1) -
        1,
      objectCreatedAt: now,
      state: 'discarded',
    })
    await seedAttachments(foreignClinicActor, {
      count: INQUIRY_ATTACHMENT_DRAFT_LIMITS.reservationsPerClinic,
      objectCreatedAt: now,
      state: 'discarded',
    })

    const windowStart = new Date(now.getTime() - INQUIRY_ATTACHMENT_DRAFT_LIMITS.reservationWindowMs).toISOString()
    const before = await sqlClient.query<{
      old_for_actor: string
      recent_for_actor: string
      recent_for_clinic: string
      recent_for_foreign_clinic: string
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE actor_key = $1 AND object_created_at < $2::timestamptz)::text AS old_for_actor,
         COUNT(*) FILTER (WHERE actor_key = $1 AND object_created_at >= $2::timestamptz)::text AS recent_for_actor,
         COUNT(*) FILTER (WHERE clinic_id = $3 AND object_created_at >= $2::timestamptz)::text AS recent_for_clinic,
         COUNT(*) FILTER (WHERE clinic_id = $4 AND object_created_at >= $2::timestamptz)::text AS recent_for_foreign_clinic
       FROM inquiry_attachments
       WHERE inquiry_id = ANY($5::integer[])`,
      [
        reservationTarget.actorKey,
        windowStart,
        reservationTarget.clinicId,
        foreignClinicActor.clinicId,
        [
          Number(reservationTarget.inquiryId),
          Number(reservationSameClinicForeign.inquiryId),
          Number(foreignClinicActor.inquiryId),
        ],
      ],
    )
    expect(before.rows[0]).toEqual({
      old_for_actor: String(INQUIRY_ATTACHMENT_DRAFT_LIMITS.reservationsPerActor),
      recent_for_actor: String(INQUIRY_ATTACHMENT_DRAFT_LIMITS.reservationsPerActor - 1),
      recent_for_clinic: String(INQUIRY_ATTACHMENT_DRAFT_LIMITS.reservationsPerClinic - 1),
      recent_for_foreign_clinic: String(
        INQUIRY_ATTACHMENT_DRAFT_LIMITS.activePerClinic + INQUIRY_ATTACHMENT_DRAFT_LIMITS.reservationsPerClinic,
      ),
    })

    const winnerStorage = createMemoryStorage()
    await expect(
      createAttachmentDraft(
        reservationTarget.req,
        {
          fileName: 'synthetic-last-reservation-slot.pdf',
          inquiryId: reservationTarget.inquiryId,
          mimeType: 'application/pdf',
          sizeBytes: 4,
        },
        winnerStorage,
      ),
    ).resolves.toMatchObject({ draftId: expect.any(String) })

    const blockedStorage = createMemoryStorage()
    await expect(
      createAttachmentDraft(
        reservationTarget.req,
        {
          fileName: 'synthetic-over-reservation-capacity.pdf',
          inquiryId: reservationTarget.inquiryId,
          mimeType: 'application/pdf',
          sizeBytes: 4,
        },
        blockedStorage,
      ),
    ).rejects.toMatchObject({ kind: 'rate-limited' })
    expect(blockedStorage.createUpload).not.toHaveBeenCalled()
  }, 60_000)

  it('allows at most one presign when two transactions race for the final actor slot', async () => {
    await seedAttachments(concurrencyTarget, {
      count: INQUIRY_ATTACHMENT_DRAFT_LIMITS.activePerActor - 1,
      objectCreatedAt: new Date(),
      state: 'draft',
    })
    const requests = await Promise.all([createLocalReq({}, payload), createLocalReq({}, payload)])
    for (const req of requests) req.user = concurrencyTarget.user
    const storages = [createMemoryStorage(), createMemoryStorage()]
    const results = await Promise.allSettled(
      requests.map((req, index) =>
        createAttachmentDraft(
          req,
          {
            fileName: `synthetic-concurrent-${index + 1}.pdf`,
            inquiryId: concurrencyTarget.inquiryId,
            mimeType: 'application/pdf',
            sizeBytes: 4,
          },
          storages[index],
        ),
      ),
    )

    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(rejected[0]).toMatchObject({ reason: { kind: 'rate-limited' } })
    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        expect(storages[index]?.createUpload).toHaveBeenCalledTimes(1)
      } else {
        expect(storages[index]?.createUpload).not.toHaveBeenCalled()
      }
    }

    const activeAfter = await sqlClient.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM inquiry_attachments
       WHERE actor_key = $1
         AND state IN ('draft', 'verified')`,
      [concurrencyTarget.actorKey],
    )
    expect(activeAfter.rows[0]?.count).toBe(String(INQUIRY_ATTACHMENT_DRAFT_LIMITS.activePerActor))
  }, 60_000)
})

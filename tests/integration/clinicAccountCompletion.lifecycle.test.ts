import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import {
  replaceClinicTestUserAssignment,
  asClinicScopedPayloadUser,
  createClinicTestUser,
  cleanupTrackedUsers,
} from '../fixtures/testUsers'
import { testSlug } from '../fixtures/testSlug'
import { createLocalReq } from 'payload'
import { convertClinicStaffLocalAccess } from '@/auth/utilities/clinicAccountCompletion'
import type { PostgresAdapter } from '@payloadcms/db-postgres'
import {
  up as activateLocalSchema,
  down as removeLocalSchema,
  backfillLocalClinicActivation,
} from '@/migrations/20261017_084048_clinic_staff_identity_activation'
import { readClinicAccessState } from '@/auth/utilities/clinicAccessState'

describe('native clinic account evidence boundary', () => {
  let payload: Payload
  let cityId: number
  const clinicIds: number[] = []
  const doctorIds: number[] = []
  const staffIds: Array<number | string> = []
  const prefix = testSlug('clinicAccountCompletion.lifecycle.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const cities = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true, depth: 0 })
    cityId = cities.docs[0]!.id
  })

  afterEach(async () => {
    await cleanupTrackedUsers(payload, { staffIds })
    for (const id of doctorIds.splice(0)) await payload.delete({ collection: 'doctors', id, overrideAccess: true })
    for (const id of clinicIds.splice(0)) await payload.delete({ collection: 'clinics', id, overrideAccess: true })
  })

  it('converts valid original evidence once without replacing personal identity or completion', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, { slugPrefix: prefix })
    clinicIds.push(clinic.id)
    doctorIds.push(doctor.id)
    const staff = await createClinicTestUser(payload, { emailPrefix: prefix, createdStaffIds: staffIds })
    await asClinicScopedPayloadUser(payload, staff, clinic.id)
    const before = await payload.findByID({ collection: 'clinicStaff', id: staff.id, overrideAccess: true, depth: 0 })
    const req = await createLocalReq({}, payload)
    const converted = await convertClinicStaffLocalAccess(req, staff.id)
    expect(converted.assignmentScope).toBe('local')
    expect(converted.activationReadiness).toMatchObject({
      version: 'identity-v1',
      principalId: String(staff.id),
      subject: staff.supabaseUserId,
    })
    expect(converted).toMatchObject({
      id: before.id,
      supabaseUserId: before.supabaseUserId,
      status: before.status,
      clinic: before.clinic,
      accountCompletion: before.accountCompletion,
    })
    const repeated = await convertClinicStaffLocalAccess(req, staff.id)
    expect(repeated.activationReadiness).toEqual(converted.activationReadiness)
    expect(repeated.accountCompletion).toEqual(before.accountCompletion)
    expect(await readClinicAccessState(payload, staff.id)).not.toBeNull()
    await expect(
      payload.update({
        collection: 'clinicStaff',
        id: staff.id,
        data: { activationReadiness: { ...converted.activationReadiness, subject: 'forged' } },
        overrideAccess: true,
        context: { seed: true, skipClinicStaffAuthSync: true },
      }),
    ).rejects.toThrow()
  })

  it('keeps a converted principal without completion restricted and rejects manufactured readiness', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, { slugPrefix: prefix })
    clinicIds.push(clinic.id)
    doctorIds.push(doctor.id)
    const staff = await createClinicTestUser(payload, { emailPrefix: prefix, createdStaffIds: staffIds })
    await payload.update({ collection: 'clinicStaff', id: staff.id, data: { clinic: clinic.id }, overrideAccess: true })
    const converted = await convertClinicStaffLocalAccess(await createLocalReq({}, payload), staff.id)
    expect(converted.assignmentScope).toBe('local')
    expect(converted.activationReadiness?.version).toBeFalsy()
    expect(await readClinicAccessState(payload, staff.id)).toBeNull()
    await expect(
      payload.update({
        collection: 'clinicStaff',
        id: staff.id,
        data: {
          activationReadiness: {
            version: 'identity-v1',
            principalId: String(staff.id),
            subject: staff.supabaseUserId,
            establishedAt: new Date().toISOString(),
          },
        },
        context: { seed: true, trustedPlatformStaffOps: true, clinicAccountEvidenceCapability: {} },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('migrates historical valid, missing and clinic-inconsistent evidence and repeats the backfill safely', async () => {
    const first = await createClinicFixture(payload, cityId, { slugPrefix: `${prefix}-origin` })
    const second = await createClinicFixture(payload, cityId, { slugPrefix: `${prefix}-other` })
    clinicIds.push(first.clinic.id, second.clinic.id)
    doctorIds.push(first.doctor.id, second.doctor.id)
    const valid = await createClinicTestUser(payload, { emailPrefix: `${prefix}-valid`, createdStaffIds: staffIds })
    const inconsistent = await createClinicTestUser(payload, {
      emailPrefix: `${prefix}-inconsistent`,
      createdStaffIds: staffIds,
    })
    const missing = await createClinicTestUser(payload, { emailPrefix: `${prefix}-missing`, createdStaffIds: staffIds })
    await asClinicScopedPayloadUser(payload, valid, first.clinic.id)
    await asClinicScopedPayloadUser(payload, inconsistent, first.clinic.id)
    await replaceClinicTestUserAssignment(payload, inconsistent.id, second.clinic.id, { skipClinicStaffAuthSync: true })
    await payload.update({
      collection: 'clinicStaff',
      id: missing.id,
      data: { clinic: first.clinic.id },
      overrideAccess: true,
    })
    const read = (id: number) => payload.findByID({ collection: 'clinicStaff', id, overrideAccess: true, depth: 0 })
    const before = await read(valid.id)
    const req = await createLocalReq({}, payload)
    const args = { db: (payload.db as unknown as PostgresAdapter).drizzle, payload, req }
    await removeLocalSchema(args)
    await activateLocalSchema(args)
    const migrated = await read(valid.id)
    expect(migrated.activationReadiness).toMatchObject({
      version: 'identity-v1',
      principalId: String(valid.id),
      subject: valid.supabaseUserId,
    })
    expect(migrated).toMatchObject({
      id: before.id,
      supabaseUserId: before.supabaseUserId,
      clinic: before.clinic,
      status: before.status,
      accountCompletion: before.accountCompletion,
    })
    for (const staff of [missing, inconsistent]) {
      const restricted = await read(staff.id)
      expect(restricted.assignmentScope).toBe('local')
      expect(restricted.activationReadiness?.version).toBeFalsy()
      expect(await readClinicAccessState(payload, staff.id)).toBeNull()
    }
    await backfillLocalClinicActivation(args)
    await backfillLocalClinicActivation(args)
    expect((await read(valid.id)).activationReadiness).toEqual(migrated.activationReadiness)
    expect((await read(valid.id)).accountCompletion).toEqual(before.accountCompletion)
    expect(await readClinicAccessState(payload, valid.id)).not.toBeNull()
  })

  it('accepts signed synthetic legacy evidence through real hooks and keeps unpublished access private', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, { slugPrefix: prefix })
    clinicIds.push(clinic.id)
    doctorIds.push(doctor.id)
    await payload.update({ collection: 'clinics', id: clinic.id, data: { status: 'approved' }, overrideAccess: true })
    const staff = await createClinicTestUser(payload, { emailPrefix: prefix, createdStaffIds: staffIds })
    expect(await readClinicAccessState(payload, staff.id)).toBeNull()
    await asClinicScopedPayloadUser(payload, staff, clinic.id)
    const stored = await payload.findByID({ collection: 'clinicStaff', id: staff.id, overrideAccess: true, depth: 0 })
    expect(stored.accountCompletion).toMatchObject({
      source: 'legacy-audit',
      subject: staff.supabaseUserId,
      clinicId: String(clinic.id),
    })
    expect(stored.legacyAccess?.initialParticipant).toBe(false)
    expect(await readClinicAccessState(payload, staff.id)).not.toBeNull()
    const updated = await payload.update({
      collection: 'clinicStaff',
      id: staff.id,
      data: { firstName: 'Updated' },
      context: { skipClinicStaffAuthSync: true },
      overrideAccess: true,
      depth: 0,
    })
    expect(updated.accountCompletion).toEqual(stored.accountCompletion)
    expect(updated.legacyAccess).toEqual(stored.legacyAccess)
    await expect(
      payload.update({
        collection: 'clinicStaff',
        id: staff.id,
        data: { accountCompletion: { ...stored.accountCompletion, subject: 'forged' } },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
    await payload.update({ collection: 'clinics', id: clinic.id, data: { status: 'pending' }, overrideAccess: true })
    expect(await readClinicAccessState(payload, staff.id)).not.toBeNull()
    const publicRead = await payload.find({
      collection: 'clinics',
      where: { id: { equals: clinic.id } },
      overrideAccess: false,
      depth: 0,
    })
    expect(publicRead.docs).toHaveLength(0)
    await payload.update({
      collection: 'clinics',
      id: clinic.id,
      data: { participationStatus: 'disabled' },
      overrideAccess: true,
    })
    expect(await readClinicAccessState(payload, staff.id)).toBeNull()
  })
})

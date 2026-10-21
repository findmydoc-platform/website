import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type CollectionSlug, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import type { Doctor, Review } from '@/payload-types'
import { submitGuestClinicInquiry } from '@/features/inquiryCommunication/service'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import {
  asClinicScopedPayloadUser,
  asPayloadStaffUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPatientTestUser,
  createPlatformTestUser,
} from '../fixtures/testUsers'
import { testSlug } from '../fixtures/testSlug'

type Target = { collection: CollectionSlug; id: number | string; data: Record<string, unknown>; req: PayloadRequest }

describe('native authorization final hooks', () => {
  let payload: Payload
  let operator: PayloadRequest
  let clinicId: number
  let deleteClinicId: number
  let doctorId: number
  let deleteDoctorId: number
  let draftId: number
  const staffIds: Array<number | string> = []
  const patientIds: Array<number | string> = []
  let reviewId: number
  const groupIds: number[] = []
  const tagIds: number[] = []
  const targets: Target[] = []
  const prefix = testSlug('nativeAuthorizationFinalHooks.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    operator = await createLocalReq(
      {
        user: asPayloadStaffUser(
          await createPlatformTestUser(payload, { emailPrefix: prefix, createdStaffIds: staffIds }),
        ),
        context: { skipClinicStaffAuthSync: true },
      },
      payload,
    )
    const city = (await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })).docs[0]!
    const fixture = await createClinicFixture(payload, city.id, { slugPrefix: prefix })
    clinicId = fixture.clinic.id
    doctorId = fixture.doctor.id
    const deleteDoctor = await payload.create({
      collection: 'doctors',
      data: {
        clinic: clinicId,
        title: 'dr',
        firstName: 'Delete',
        lastName: 'Fixture',
        fullName: 'Dr. Delete Fixture',
        gender: 'male',
        qualifications: ['MD'],
        languages: ['english'],
        active: true,
      } as Doctor,
    })
    deleteDoctorId = deleteDoctor.id
    const deleteClinic = await payload.create({
      collection: 'clinics',
      data: {
        name: `${prefix}-delete`,
        slug: `${prefix}-delete`,
        status: 'approved',
        participationStatus: 'approved',
        address: {
          country: typeof city.country === 'number' ? city.country : city.country.id,
          city: city.id,
          street: 'Fixture Street',
          houseNumber: '1',
          zipCode: '10000',
        },
        contact: { email: `${prefix}-delete@example.com`, phoneNumber: '+10000000000' },
        internalPrimaryContact: {
          firstName: 'Native',
          lastName: 'Delete',
          email: `${prefix}-delete@example.com`,
          role: 'Clinic Management',
        },
        supportedLanguages: ['english'],
      },
    })
    deleteClinicId = deleteClinic.id
    await payload.update({
      collection: 'clinics',
      id: clinicId,
      data: { participationStatus: 'approved', status: 'approved' },
      overrideAccess: true,
    })
    const principal = await createClinicTestUser(payload, { emailPrefix: prefix, createdStaffIds: staffIds })
    const staff = await createLocalReq({ user: await asClinicScopedPayloadUser(payload, principal, clinicId) }, payload)
    const group = await payload.create({ collection: 'clinicGroups', data: { name: `${prefix}-group` }, req: operator })
    groupIds.push(group.id)
    const draft = await payload.create({
      collection: 'clinicProfileDrafts',
      req: operator,
      data: {
        clinic: clinicId,
        revision: 1,
        basePublishedRevision: 0,
        name: `${prefix}-draft`,
        address: { country: typeof city.country === 'number' ? city.country : city.country.id },
      },
    })
    draftId = draft.id
    const master = (await payload.find({ collection: 'treatments', limit: 1, overrideAccess: true })).docs[0]!
    const offering = await payload.create({
      collection: 'clinictreatments',
      req: operator,
      data: { clinic: clinicId, treatment: master.id, price: 100, active: true },
    })
    const inquiry = await submitGuestClinicInquiry(await createLocalReq({}, payload), {
      clinicId,
      doctorId,
      consent: true,
      email: `${prefix}@example.com`,
      fullName: 'Native final guard fixture',
      message: 'Synthetic final authorization fixture.',
      phoneNumber: '+10000000000',
    })
    const patient = await createPatientTestUser(payload, {
      emailPrefix: `${prefix}-patient`,
      createdPatientIds: patientIds,
    })
    const review = await payload.create({
      collection: 'reviews',
      req: operator,
      overrideAccess: true,
      data: {
        clinic: clinicId,
        doctor: doctorId,
        treatment: master.id,
        patient: patient.id,
        status: 'pending',
        starRating: 5,
        comment: 'Synthetic final review guard fixture.',
        authorVisibility: 'anonymous',
      } as Review,
    })
    reviewId = review.id
    targets.push(
      { collection: 'clinicGroups', id: group.id, data: { name: `${prefix}-rejected` }, req: operator },
      { collection: 'clinics', id: clinicId, data: { name: `${prefix}-rejected` }, req: staff },
      { collection: 'clinicStaff', id: principal.id, data: { firstName: 'Rejected' }, req: operator },
      { collection: 'clinicProfileDrafts', id: draft.id, data: { name: `${prefix}-rejected` }, req: operator },
      { collection: 'doctors', id: doctorId, data: { firstName: 'Rejected' }, req: staff },
      { collection: 'clinictreatments', id: offering.id, data: { price: 999 }, req: staff },
      // Re-submit the stored clinic without changing immutable submission evidence.
      { collection: 'patientClinicInquiries', id: inquiry.id, data: { clinic: clinicId }, req: operator },
      { collection: 'reviews', id: review.id, data: { status: 'approved' }, req: operator },
    )
  }, 60000)

  afterAll(async () => {
    if (!payload) return
    if (reviewId)
      await payload.delete({ collection: 'reviews', id: reviewId, trash: true, req: operator, overrideAccess: true })
    if (clinicId) {
      await cleanupTestEntities(payload, 'patientClinicInquiries', prefix)
      await cleanupTestEntities(payload, 'clinictreatments', prefix)
    }
    if (draftId) await payload.delete({ collection: 'clinicProfileDrafts', id: draftId, req: operator })
    for (const id of groupIds)
      if (await payload.findByID({ collection: 'clinicGroups', id, disableErrors: true, overrideAccess: true }))
        await payload.delete({ collection: 'clinicGroups', id, req: operator, overrideAccess: false })
    for (const id of tagIds) await payload.delete({ collection: 'tags', id, overrideAccess: true })
    await cleanupTrackedUsers(payload, { staffIds, patientIds })
    if (doctorId) await payload.delete({ collection: 'doctors', id: doctorId, overrideAccess: true })
    if (deleteDoctorId) await payload.delete({ collection: 'doctors', id: deleteDoctorId, overrideAccess: true })
    if (clinicId) await payload.delete({ collection: 'clinics', id: clinicId, overrideAccess: true })
    if (deleteClinicId) await payload.delete({ collection: 'clinics', id: deleteClinicId, overrideAccess: true })
  })

  async function heldForeignOwner() {
    let release!: () => void
    let reached!: () => void
    const ready = new Promise<void>((resolve) => {
      reached = resolve
    })
    const proceed = new Promise<void>((resolve) => {
      release = resolve
    })
    let owner: string | number | undefined
    let session: unknown
    const hooks = payload.collections.tags.config.hooks
    const original = hooks.beforeChange ?? []
    const slug = `${prefix}-foreign-${tagIds.length}`
    hooks.beforeChange = [
      ...original,
      async ({ req, data }) => {
        if (data.slug === slug) {
          owner = await req.transactionID
          if (owner === undefined) throw new Error('Expected the held foreign native owner')
          session = payload.db.sessions?.[owner]
          reached()
          await proceed
        }
        return data
      },
    ]
    const writing = payload.create({ collection: 'tags', data: { name: slug, slug }, overrideAccess: true })
    const completed = writing.catch((error) => {
      reached()
      throw error
    })
    await ready
    return {
      owner,
      session,
      finish: async () => {
        release()
        try {
          const stored = await completed
          tagIds.push(stored.id)
          return stored
        } finally {
          hooks.beforeChange = original
        }
      },
    }
  }

  const collections = [
    'clinicGroups',
    'clinics',
    'clinicStaff',
    'clinicProfileDrafts',
    'doctors',
    'clinictreatments',
    'patientClinicInquiries',
    'reviews',
  ] as const
  const cases = collections.flatMap((collection) =>
    (collection === 'patientClinicInquiries'
      ? (['updateByID'] as const)
      : (['updateByID', 'deleteByID'] as const)
    ).flatMap((operation) =>
      (['missing', 'replacement'] as const).map((fault) => [collection, operation, fault] as const),
    ),
  )
  it.each(cases)(
    '%s %s rejects a %s owner at its real final dispatch and rolls back',
    async (collection, operation, fault) => {
      const source = targets.find((entry) => entry.collection === collection)!
      const target =
        operation !== 'deleteByID'
          ? source
          : collection === 'clinics'
            ? { ...source, id: deleteClinicId }
            : collection === 'doctors'
              ? { ...source, id: deleteDoctorId }
              : source
      const before = await payload.findByID({ collection, id: target.id, depth: 0, overrideAccess: true })
      const foreign = fault === 'replacement' ? await heldForeignOwner() : undefined
      const hooks = payload.collections[collection].config.hooks
      const original = hooks.afterOperation ?? []
      let dispatched = 0
      let owner: PayloadRequest['transactionID']
      hooks.afterOperation = original.map((hook) => async (args) => {
        if (args.operation !== operation || !('id' in args.args) || String(args.args.id) !== String(target.id))
          return hook(args)
        dispatched++
        owner = args.req.transactionID
        if (fault === 'missing') delete args.req.transactionID
        else args.req.transactionID = foreign!.owner
        try {
          return await hook(args)
        } finally {
          // Restore only for Payload's original outer error cleanup, never to resume the rejected write.
          args.req.transactionID = owner
        }
      })
      const rollback = vi.spyOn(payload.db, 'rollbackTransaction')
      try {
        const writing =
          operation === 'updateByID'
            ? payload.update({ collection, id: target.id, data: target.data, req: target.req, overrideAccess: true })
            : payload.delete({ collection, id: target.id, req: operator, overrideAccess: true })
        await expect(writing).rejects.toThrow(
          collection === 'reviews'
            ? 'Review notification source transaction changed before completion.'
            : fault === 'replacement'
              ? 'original active native transaction session'
              : 'active native transaction session',
        )
        expect(dispatched).toBe(1)
        expect(rollback).toHaveBeenCalledExactlyOnceWith(owner)
        expect(await rollback.mock.results[0]!.value).toBeDefined()
        expect(await payload.findByID({ collection, id: target.id, depth: 0, overrideAccess: true })).toEqual(before)
        if (foreign) expect(payload.db.sessions?.[foreign.owner!]).toBe(foreign.session)
      } finally {
        hooks.afterOperation = original
        rollback.mockRestore()
        if (foreign) {
          const stored = await foreign.finish()
          expect((await payload.findByID({ collection: 'tags', id: stored.id, overrideAccess: true })).id).toBe(
            stored.id,
          )
        }
      }
    },
    30000,
  )

  it('retains native bulk update/delete dispatch and confirmed commits', async () => {
    const ids = []
    for (const suffix of ['one', 'two']) {
      const group = await payload.create({
        collection: 'clinicGroups',
        data: { name: `${prefix}-${suffix}` },
        req: operator,
      })
      ids.push(group.id)
      groupIds.push(group.id)
    }
    const hooks = payload.collections.clinicGroups.config.hooks
    const original = hooks.afterOperation ?? []
    const dispatches: string[] = []
    hooks.afterOperation = [
      ...original,
      ({ result, operation }) => {
        if (operation === 'update' || operation === 'delete') dispatches.push(operation)
        return result
      },
    ]
    try {
      const updated = await payload.update({
        collection: 'clinicGroups',
        where: { id: { in: ids } },
        data: { name: `${prefix}-bulk` },
        req: operator,
      })
      expect(updated.docs).toHaveLength(2)
      expect(updated.errors).toEqual([])
      const removed = await payload.delete({ collection: 'clinicGroups', where: { id: { in: ids } }, req: operator })
      expect(removed.docs).toHaveLength(2)
      expect(removed.errors).toEqual([])
      expect(dispatches).toEqual(['update', 'delete'])
    } finally {
      hooks.afterOperation = original
    }
    expect(
      (await payload.find({ collection: 'clinicGroups', where: { id: { in: ids } }, overrideAccess: true })).docs,
    ).toEqual([])
  })

  it('does not replay an uncertain native commit and reads back the committed write', async () => {
    const target = targets.find((entry) => entry.collection === 'clinicGroups')!
    const nativeCommit = payload.db.commitTransaction.bind(payload.db)
    const commit = vi.spyOn(payload.db, 'commitTransaction').mockImplementationOnce(async (id) => {
      await nativeCommit(id)
      throw new Error('Synthetic lost native commit confirmation')
    })
    try {
      await expect(
        payload.update({
          collection: 'clinicGroups',
          id: target.id,
          data: { name: `${prefix}-committed` },
          req: operator,
        }),
      ).rejects.toThrow('Synthetic lost native commit confirmation')
      expect(commit).toHaveBeenCalledTimes(1)
    } finally {
      commit.mockRestore()
    }
    expect((await payload.findByID({ collection: 'clinicGroups', id: target.id, overrideAccess: true })).name).toBe(
      `${prefix}-committed`,
    )
  })

  it('rechecks the explicit clinic target after the final native owner check', async () => {
    const target = targets.find((entry) => entry.collection === 'clinics')!
    const before = await payload.findByID({ collection: 'clinics', id: clinicId, depth: 0, overrideAccess: true })
    const hooks = payload.collections.clinics.config.hooks
    const original = hooks.afterOperation ?? []
    let dispatched = 0
    hooks.afterOperation = original.map((hook) => async (args) => {
      if (args.operation !== 'updateByID' || args.args.id !== clinicId) return hook(args)
      const routes = args.req.routeParams
      args.req.routeParams = { clinicId: String(deleteClinicId) }
      dispatched++
      try {
        return await hook(args)
      } finally {
        args.req.routeParams = routes
      }
    })
    try {
      await expect(
        payload.update({
          collection: 'clinics',
          id: clinicId,
          data: { name: `${prefix}-wrong-target` },
          req: target.req,
          overrideAccess: false,
        }),
      ).rejects.toMatchObject({ status: 403 })
      expect(dispatched).toBe(1)
    } finally {
      hooks.afterOperation = original
    }
    expect(await payload.findByID({ collection: 'clinics', id: clinicId, depth: 0, overrideAccess: true })).toEqual(
      before,
    )
  })
})

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import {
  createClinicTreatment,
  readClinicTreatmentSnapshot,
  updateClinicTreatment,
} from '@/features/clinicDashboard/treatments/service'
import { replaceClinicStaffAssignment } from '@/features/clinicGroups/staffAssignments'
import { changeClinicGroup } from '@/features/clinicGroups/membership'
import { readClinicTargetAccess } from '@/auth/utilities/clinicPrincipalAccess'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import {
  asClinicScopedPayloadUser,
  asPayloadStaffUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPlatformTestUser,
} from '../fixtures/testUsers'
import { testSlug } from '../fixtures/testSlug'

describe('Current clinic treatment ownership and native ordering', () => {
  let payload: Payload
  let operator: PayloadRequest
  let cityId: number
  let masterId: number
  const clinics: number[] = []
  const doctors: number[] = []
  const groups: number[] = []
  const offerings: number[] = []
  const staff: Array<number | string> = []
  const operators: Array<number | string> = []
  const prefix = testSlug('clinicTreatmentScope.lifecycle.test.ts')
  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    cityId = (await payload.find({ collection: 'cities', limit: 1, depth: 0, overrideAccess: true })).docs[0]!.id
    masterId = (await payload.find({ collection: 'treatments', limit: 1, depth: 0, overrideAccess: true })).docs[0]!.id
    const principal = await createPlatformTestUser(payload, { emailPrefix: prefix, createdStaffIds: operators })
    operator = await createLocalReq({ user: asPayloadStaffUser(principal) }, payload)
  })
  afterAll(async () => {
    await cleanupTrackedUsers(payload, { staffIds: operators })
  })
  afterEach(async () => {
    for (const id of offerings.splice(0))
      await payload.delete({ collection: 'clinictreatments', id, overrideAccess: true })
    await cleanupTrackedUsers(payload, { staffIds: staff })
    for (const id of doctors.splice(0)) await payload.delete({ collection: 'doctors', id, overrideAccess: true })
    for (const id of clinics.splice(0)) await payload.delete({ collection: 'clinics', id, overrideAccess: true })
    for (const id of groups.splice(0))
      await payload.delete({ collection: 'clinicGroups', id, req: operator, overrideAccess: false })
  })
  async function fixture() {
    const group = await payload.create({
      collection: 'clinicGroups',
      data: { name: 'Treatment network' },
      req: operator,
      overrideAccess: false,
    })
    groups.push(group.id)
    async function clinic(suffix: string, grouped: boolean) {
      const item = await createClinicFixture(payload, cityId, { slugPrefix: `${prefix}-${suffix}` })
      clinics.push(item.clinic.id)
      doctors.push(item.doctor.id)
      await payload.update({
        collection: 'clinics',
        id: item.clinic.id,
        data: { participationStatus: 'approved', ...(grouped ? { group: group.id } : {}) },
        req: grouped ? operator : undefined,
        overrideAccess: true,
      })
      const offering = await payload.create({
        collection: 'clinictreatments',
        data: { clinic: item.clinic.id, treatment: masterId, price: grouped ? 100 : 900, active: false },
        depth: 0,
        overrideAccess: true,
      })
      offerings.push(offering.id)
      return { ...item, offering }
    }
    const first = await clinic('first', true)
    const second = await clinic('second', true)
    const foreign = await clinic('foreign', false)
    const principal = await createClinicTestUser(payload, { emailPrefix: prefix, createdStaffIds: staff })
    const user = await asClinicScopedPayloadUser(payload, principal, first.clinic.id)
    const request = (id: number, context?: Record<string, unknown>) =>
      createLocalReq({ user, context, req: { routeParams: { clinicId: String(id) } } }, payload)
    return { first, second, foreign, group, principal, user, request }
  }
  it('uses current local/group ownership, original targets and record IDs independently from public status', async () => {
    const f = await fixture()
    const local = await readClinicTreatmentSnapshot(await f.request(f.first.clinic.id), f.first.clinic.id)
    expect(local.offerings.map(({ id }) => id)).toEqual([String(f.first.offering.id)])
    await expect(
      readClinicTreatmentSnapshot(await f.request(f.second.clinic.id), f.second.clinic.id),
    ).rejects.toMatchObject({ status: 403 })
    await replaceClinicStaffAssignment(operator, f.principal.id, { scope: 'group', groupId: f.group.id })
    await payload.update({
      collection: 'clinics',
      id: f.second.clinic.id,
      data: { status: 'pending' },
      req: operator,
      overrideAccess: true,
    })
    expect(
      (await readClinicTreatmentSnapshot(await f.request(f.second.clinic.id), f.second.clinic.id)).offerings.map(
        ({ id }) => id,
      ),
    ).toEqual([String(f.second.offering.id)])
    const updated = await updateClinicTreatment(await f.request(f.second.clinic.id), f.second.clinic.id, {
      offeringId: String(f.second.offering.id),
      expectedRevision: f.second.offering.updatedAt,
      active: true,
      priceEUR: 250,
    })
    expect(updated).toMatchObject({ active: true, priceEUR: 250 })
    await expect(
      updateClinicTreatment(await f.request(f.first.clinic.id), f.first.clinic.id, {
        offeringId: String(f.second.offering.id),
        expectedRevision: updated.revision,
        active: false,
        priceEUR: 1,
      }),
    ).rejects.toMatchObject({ kind: 'not-found' })
    await expect(
      readClinicTreatmentSnapshot(await f.request(f.first.clinic.id), f.second.clinic.id),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      readClinicTreatmentSnapshot(await f.request(f.foreign.clinic.id), f.foreign.clinic.id),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload.update({
        collection: 'clinictreatments',
        id: f.foreign.offering.id,
        data: { price: 1 },
        req: await f.request(f.first.clinic.id),
        overrideAccess: true,
      }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload.update({
        collection: 'clinictreatments',
        id: f.first.offering.id,
        data: { clinic: f.second.clinic.id },
        req: await f.request(f.first.clinic.id),
        overrideAccess: true,
      }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload.delete({
        collection: 'clinictreatments',
        id: f.first.offering.id,
        req: await f.request(f.first.clinic.id),
        overrideAccess: true,
      }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload.update({
        collection: 'treatments',
        id: masterId,
        data: { name: 'Untrusted master change' },
        req: await f.request(f.first.clinic.id),
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 })
    await payload.update({
      collection: 'clinics',
      id: f.second.clinic.id,
      data: { participationStatus: 'disabled' },
      req: operator,
      overrideAccess: true,
    })
    await expect(
      readClinicTreatmentSnapshot(await f.request(f.second.clinic.id), f.second.clinic.id),
    ).rejects.toMatchObject({ status: 403 })
    await replaceClinicStaffAssignment(operator, f.principal.id, { scope: 'unassigned' })
    await expect(
      readClinicTreatmentSnapshot(await f.request(f.first.clinic.id), f.first.clinic.id),
    ).rejects.toMatchObject({ status: 403 })
    expect(
      (await payload.findByID({ collection: 'clinictreatments', id: f.foreign.offering.id, overrideAccess: true }))
        .price,
    ).toBe(900)
  })
  it('creates only inactive offerings for existing masters and rejects missing native owners', async () => {
    const f = await fixture()
    const master = (
      await payload.find({
        collection: 'treatments',
        where: { id: { not_equals: masterId } },
        depth: 0,
        limit: 1,
        overrideAccess: true,
      })
    ).docs[0]!
    await replaceClinicStaffAssignment(operator, f.principal.id, { scope: 'group', groupId: f.group.id })
    const created = await createClinicTreatment(await f.request(f.second.clinic.id), f.second.clinic.id, {
      treatmentId: String(master.id),
      priceEUR: 12.34,
    })
    offerings.push(Number(created.id))
    expect(created).toMatchObject({ active: false, priceEUR: 12.34, treatment: { id: String(master.id) } })
    await expect(
      createClinicTreatment(await f.request(f.foreign.clinic.id), f.foreign.clinic.id, {
        treatmentId: String(master.id),
        priceEUR: 0,
      }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      createClinicTreatment(await f.request(f.first.clinic.id), f.first.clinic.id, {
        treatmentId: '2147483647',
        priceEUR: 0,
      }),
    ).rejects.toMatchObject({ kind: 'invalid-input' })
    await expect(
      payload.update({
        collection: 'clinictreatments',
        id: f.first.offering.id,
        data: { price: 1 },
        req: await f.request(f.first.clinic.id),
        overrideAccess: false,
        disableTransaction: true,
      }),
    ).rejects.toThrow(/active native transaction/)
  })
  it.each([
    ['business-first', 'revoke'],
    ['access-first', 'revoke'],
    ['business-first', 'move'],
    ['access-first', 'move'],
  ] as const)('orders treatment %s against %s through the final native commit', async (order, change) => {
    const f = await fixture()
    await replaceClinicStaffAssignment(operator, f.principal.id, { scope: 'group', groupId: f.group.id })
    const destination =
      change === 'move'
        ? await payload.create({
            collection: 'clinicGroups',
            data: { name: 'Destination treatment network' },
            req: operator,
            overrideAccess: false,
          })
        : null
    if (destination) groups.push(destination.id)
    const before = await payload.findByID({
      collection: 'clinicStaff',
      id: f.principal.id,
      depth: 0,
      overrideAccess: true,
    })
    let entered!: () => void
    let release!: () => void
    let opponentEntered!: () => void
    const paused = new Promise<void>((resolve) => {
      entered = resolve
    })
    const released = new Promise<void>((resolve) => {
      release = resolve
    })
    const opponentPaused = new Promise<void>((resolve) => {
      opponentEntered = resolve
    })
    async function waitFor(promise: Promise<void>) {
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          promise,
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Treatment ordering checkpoint timed out.')), 5000)
          }),
        ])
      } finally {
        clearTimeout(timer)
      }
    }
    const businessHooks = payload.collections.clinictreatments.config.hooks
    const accessHooks = payload.collections[change === 'move' ? 'clinics' : 'clinicStaff'].config.hooks
    const controls = payload.collections.clinicNotificationControls.config.hooks
    const oldBusiness = businessHooks.afterChange
    const oldAccess = accessHooks.afterChange
    const oldControl = controls.beforeChange
    const pause = async ({ doc, req }: { doc: unknown; req: PayloadRequest }) => {
      if (req.context.treatmentRace === 'first') {
        entered()
        await released
      }
      return doc
    }
    businessHooks.afterChange = [...(oldBusiness ?? []), pause]
    accessHooks.afterChange = [...(oldAccess ?? []), pause]
    controls.beforeChange = [
      ...(oldControl ?? []),
      ({ data, originalDoc, req }) => {
        if (
          req.context.treatmentRace === 'second' &&
          (data.key ?? originalDoc?.key) ===
            (change === 'move'
              ? `notification-authorization:clinic:${f.first.clinic.id}`
              : `notification-authorization:staff:${f.principal.id}`)
        )
          opponentEntered()
        return data
      },
    ]
    const business = async (position: string) =>
      updateClinicTreatment(await f.request(f.first.clinic.id, { treatmentRace: position }), f.first.clinic.id, {
        offeringId: String(f.first.offering.id),
        expectedRevision: f.first.offering.updatedAt,
        active: true,
        priceEUR: 321,
      })
    const revoke = async (position: string) => {
      const req = await createLocalReq({ user: operator.user!, context: { treatmentRace: position } }, payload)
      return destination
        ? changeClinicGroup(req, f.first.clinic.id, { fromGroupId: f.group.id, toGroupId: destination.id })
        : replaceClinicStaffAssignment(req, f.principal.id, { scope: 'unassigned' })
    }
    const settle = (promise: Promise<unknown>) =>
      promise.then(
        (value) => ({ value, error: undefined }),
        (error: unknown) => ({ value: undefined, error }),
      )
    const first = settle(order === 'business-first' ? business('first') : revoke('first'))
    let second: ReturnType<typeof settle> | undefined
    try {
      await waitFor(paused)
      second = settle(order === 'business-first' ? revoke('second') : business('second'))
      await waitFor(opponentPaused)
      release()
      expect((await first).error).toBeUndefined()
      if (order === 'access-first') expect((await second).error).toMatchObject({ status: 403 })
      else expect((await second).error).toBeUndefined()
      const stored = await payload.findByID({
        collection: 'clinictreatments',
        id: f.first.offering.id,
        depth: 0,
        overrideAccess: true,
      })
      expect(stored.price).toBe(order === 'business-first' ? 321 : 100)
      expect(stored.active).toBe(order === 'business-first')
      expect(await readClinicTargetAccess(payload, f.principal.id, f.first.clinic.id)).toBeNull()
      const current = await payload.findByID({
        collection: 'clinicStaff',
        id: f.principal.id,
        depth: 0,
        overrideAccess: true,
      })
      expect(current.activationReadiness).toEqual(before.activationReadiness)
      expect(current.accountCompletion).toEqual(before.accountCompletion)
    } finally {
      release()
      await first
      await second
      businessHooks.afterChange = oldBusiness
      accessHooks.afterChange = oldAccess
      controls.beforeChange = oldControl
    }
  })
})

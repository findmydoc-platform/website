import {
  up as addStaffGroupSchema,
  down as removeStaffGroupSchema,
} from '@/migrations/20261017_091316_clinic_staff_group_assignment'
import { afterEach, afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import {
  asPayloadStaffUser,
  createPlatformTestUser,
  createClinicTestUser,
  asClinicScopedPayloadUser,
  cleanupTrackedUsers,
} from '../fixtures/testUsers'
import { testSlug } from '../fixtures/testSlug'
import type { PostgresAdapter } from '@payloadcms/db-postgres'
import {
  up as addGroupSchema,
  down as removeGroupSchema,
} from '@/migrations/20261017_085356_clinic_groups_initial_membership'
import { readClinicAccessState } from '@/auth/utilities/clinicAccessState'

describe('clinic group back office and initial membership', () => {
  let payload: Payload
  let operator: PayloadRequest
  let cityId: number
  const clinicIds: number[] = []
  const doctorIds: number[] = []
  const groupIds: number[] = []
  const staffIds: Array<number | string> = []
  const prefix = testSlug('clinicGroups.lifecycle.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    cityId = (await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })).docs[0]!.id
    operator = await createLocalReq(
      { user: asPayloadStaffUser(await createPlatformTestUser(payload, { emailPrefix: prefix })) },
      payload,
    )
  })

  afterAll(async () => {
    await cleanupTrackedUsers(payload, { staffIds: [`platform:${operator.user!.id}`] })
  })

  afterEach(async () => {
    await cleanupTrackedUsers(payload, { staffIds })
    for (const id of doctorIds.splice(0)) await payload.delete({ collection: 'doctors', id, overrideAccess: true })
    for (const id of clinicIds.splice(0)) await payload.delete({ collection: 'clinics', id, overrideAccess: true })
    for (const id of groupIds.splice(0))
      await payload.delete({ collection: 'clinicGroups', id, overrideAccess: false, req: operator })
  })

  const group = async () => {
    const created = await payload.create({
      collection: 'clinicGroups',
      data: { name: 'Test network' },
      overrideAccess: false,
      req: operator,
    })
    groupIds.push(created.id)
    return created
  }
  const clinic = async () => {
    const result = await createClinicFixture(payload, cityId, { slugPrefix: prefix })
    clinicIds.push(result.clinic.id)
    doctorIds.push(result.doctor.id)
    return result.clinic
  }

  it('lets a trusted operator create, rename and initially attach an independent clinic', async () => {
    // Keep this no-center scenario independent from notification suites that activate the shared test database.
    const center = (
      await payload.find({
        collection: 'clinicNotificationControls',
        overrideAccess: true,
        where: { key: { equals: 'notification-center' } },
      })
    ).docs[0]
    if (center)
      await payload.update({
        collection: 'clinicNotificationControls',
        id: center.id,
        overrideAccess: true,
        context: { clinicNotificationCommand: true },
        data: { key: `isolated-center-${center.id}` },
      })
    try {
      const network = await group()
      const independent = await clinic()
      expect(independent.group).toBeFalsy()
      const keys = [
        `notification-authorization:clinic:${independent.id}`,
        `notification-authorization:group:${network.id}`,
      ]
      expect(
        (
          await payload.find({
            collection: 'clinicNotificationControls',
            overrideAccess: true,
            where: { key: { in: keys } },
          })
        ).docs,
      ).toHaveLength(0)
      expect(
        (
          await payload.find({
            collection: 'clinicNotificationControls',
            overrideAccess: true,
            where: { key: { equals: 'notification-center' } },
          })
        ).docs,
      ).toHaveLength(0)
      const attached = await payload.update({
        collection: 'clinics',
        id: independent.id,
        data: { group: network.id },
        overrideAccess: false,
        req: operator,
        depth: 0,
      })
      expect(attached.group).toBe(network.id)
      expect(
        (
          await payload.find({
            collection: 'clinicNotificationControls',
            overrideAccess: true,
            where: { key: { in: keys } },
          })
        ).docs,
      ).toHaveLength(2)
      await payload.update({
        collection: 'clinicGroups',
        id: network.id,
        data: { name: 'Renamed network' },
        overrideAccess: false,
        req: operator,
      })
      expect(attached.id).toBe(independent.id)
      expect(attached.participationStatus).toBe(independent.participationStatus)
      expect(attached.status).toBe(independent.status)
      await expect(
        payload.delete({ collection: 'clinicGroups', id: network.id, overrideAccess: false, req: operator }),
      ).rejects.toMatchObject({ status: 409 })
      await payload.update({
        collection: 'clinics',
        id: independent.id,
        data: { deletedAt: new Date().toISOString() },
        overrideAccess: true,
      })
      await expect(
        payload.delete({ collection: 'clinicGroups', id: network.id, overrideAccess: false, req: operator }),
      ).rejects.toMatchObject({ status: 409 })
      await payload.update({
        collection: 'clinics',
        id: independent.id,
        data: { deletedAt: null },
        trash: true,
        overrideAccess: true,
      })
    } finally {
      if (center)
        await payload.update({
          collection: 'clinicNotificationControls',
          id: center.id,
          overrideAccess: true,
          context: { clinicNotificationCommand: true },
          data: { key: 'notification-center' },
        })
    }
  })
  it('denies local staff and a stale platform role claim without changing local access', async () => {
    const network = await group()
    const independent = await clinic()
    const staff = await createClinicTestUser(payload, { emailPrefix: prefix, createdStaffIds: staffIds })
    const local = await createLocalReq(
      { user: await asClinicScopedPayloadUser(payload, staff, independent.id) },
      payload,
    )
    for (const req of [local, await createLocalReq({}, payload)]) {
      await expect(
        payload.create({ collection: 'clinicGroups', data: { name: 'Forbidden group' }, req, overrideAccess: false }),
      ).rejects.toMatchObject({ status: 403 })
      await expect(
        payload.update({
          collection: 'clinics',
          id: independent.id,
          data: { group: network.id },
          req,
          overrideAccess: false,
        }),
      ).rejects.toMatchObject({ status: 403 })
      await expect(
        payload.findByID({ collection: 'clinicGroups', id: network.id, req, overrideAccess: false }),
      ).rejects.toMatchObject({ status: 403 })
      await expect(
        payload.update({
          collection: 'clinicGroups',
          id: network.id,
          data: { name: 'Forbidden rename' },
          req,
          overrideAccess: false,
        }),
      ).rejects.toMatchObject({ status: 403 })
      await expect(
        payload.delete({ collection: 'clinicGroups', id: network.id, req, overrideAccess: false }),
      ).rejects.toMatchObject({ status: 403 })
    }
    await expect(
      payload.create({
        collection: 'clinicGroups',
        data: { name: 'Forged seed group' },
        overrideAccess: true,
        context: { seed: true, trustedPlatformStaffOps: true },
      }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload.update({
        collection: 'clinics',
        id: independent.id,
        data: { group: network.id },
        overrideAccess: true,
        context: { seed: true, trustedPlatformStaffOps: true },
      }),
    ).rejects.toMatchObject({ status: 403 })
    const content = await createPlatformTestUser(payload, {
      emailPrefix: `${prefix}-content`,
      createdStaffIds: staffIds,
    })
    await payload.update({
      collection: 'platformStaff',
      id: content.id,
      data: { role: 'content-manager' },
      context: { trustedPlatformStaffOps: true },
      overrideAccess: true,
    })
    const stale = await createLocalReq({ user: asPayloadStaffUser(content) }, payload)
    await expect(
      payload.create({
        collection: 'clinicGroups',
        data: { name: 'Forbidden group' },
        req: stale,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 })
    await payload.update({
      collection: 'clinics',
      id: independent.id,
      data: { group: network.id },
      req: operator,
      overrideAccess: false,
    })
    expect((await readClinicAccessState(payload, staff.id))?.clinic.id).toBe(independent.id)
    expect(
      (
        await payload.findByID({
          collection: 'clinics',
          id: independent.id,
          req: local,
          overrideAccess: false,
          depth: 0,
        })
      ).group,
    ).toBeUndefined()
  })

  it('allows a new clinic with one initial group and rejects later transfer or detachment', async () => {
    const network = await group()
    const foreign = await group()
    const template = await clinic()
    const created = await payload.create({
      collection: 'clinics',
      data: {
        name: 'New grouped clinic',
        slug: `${prefix}-new-grouped`,
        address: template.address,
        contact: template.contact,
        internalPrimaryContact: template.internalPrimaryContact,
        supportedLanguages: template.supportedLanguages,
        status: 'draft',
        group: network.id,
      },
      overrideAccess: false,
      req: operator,
      depth: 0,
    })
    clinicIds.push(created.id)
    expect(created.group).toBe(network.id)
    await payload.update({
      collection: 'clinics',
      id: created.id,
      data: { group: network.id },
      overrideAccess: false,
      req: operator,
    })
    for (const destination of [foreign.id, null])
      await expect(
        payload.update({
          collection: 'clinics',
          id: created.id,
          data: { group: destination },
          overrideAccess: false,
          req: operator,
        }),
      ).rejects.toMatchObject({ status: 409 })
    expect(
      (await payload.findByID({ collection: 'clinics', id: created.id, overrideAccess: true, depth: 0 })).group,
    ).toBe(network.id)
  })

  it('fails closed when a membership write disables its native transaction', async () => {
    const network = await group()
    const independent = await clinic()
    await expect(
      payload.update({
        collection: 'clinics',
        id: independent.id,
        data: { group: network.id },
        req: operator,
        overrideAccess: false,
        disableTransaction: true,
      }),
    ).rejects.toThrow('active native transaction')
    expect(
      (await payload.findByID({ collection: 'clinics', id: independent.id, overrideAccess: true, depth: 0 })).group,
    ).toBeFalsy()
  })

  it.each(['attachment-first', 'deletion-first', 'membership-before-business', 'business-before-membership'] as const)(
    'orders initial membership and its conflicting native writer: %s',
    async (order) => {
      const network = await group()
      const independent = await clinic()
      const businessOrder = order.includes('business')
      const attachmentFirst = order === 'attachment-first' || order === 'membership-before-business'
      const localStaff = businessOrder
        ? await createClinicTestUser(payload, { emailPrefix: prefix, createdStaffIds: staffIds })
        : undefined
      const localUser = localStaff ? await asClinicScopedPayloadUser(payload, localStaff, independent.id) : undefined
      let entered!: () => void
      let proceed!: () => void
      let opponentEntered!: () => void
      const paused = new Promise<void>((resolve) => {
        entered = resolve
      })
      const released = new Promise<void>((resolve) => {
        proceed = resolve
      })
      const opponentPaused = new Promise<void>((resolve) => {
        opponentEntered = resolve
      })
      const waitFor = async (promise: Promise<void>) => {
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
          await Promise.race([
            promise,
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error('Native ordering checkpoint timed out.')), 5000)
            }),
          ])
        } finally {
          clearTimeout(timer)
        }
      }
      const clinicHooks = payload.collections.clinics.config.hooks
      const groupHooks = payload.collections.clinicGroups.config.hooks
      const controlHooks = payload.collections.clinicNotificationControls.config.hooks
      const previousClinic = clinicHooks.afterChange
      const previousGroup = groupHooks.afterDelete
      const previousControl = controlHooks.beforeChange
      clinicHooks.afterChange = [
        ...(previousClinic ?? []),
        async ({ doc, req }) => {
          if (req.context.groupOrdering === 'first') {
            entered()
            await released
          }
          return doc
        },
      ]
      groupHooks.afterDelete = [
        ...(previousGroup ?? []),
        async ({ doc, req }) => {
          if (req.context.groupOrdering === 'first') {
            entered()
            await released
          }
          return doc
        },
      ]
      controlHooks.beforeChange = [
        ...(previousControl ?? []),
        ({ data, req }) => {
          if (
            req.context.groupOrdering === 'second' &&
            data.key ===
              (businessOrder
                ? `notification-authorization:clinic:${independent.id}`
                : `notification-authorization:group:${network.id}`)
          )
            opponentEntered()
          return data
        },
      ]
      const request = (position: string) =>
        createLocalReq({ user: operator.user!, context: { groupOrdering: position } }, payload)
      const attach = async (position: string) =>
        payload.update({
          collection: 'clinics',
          id: independent.id,
          data: { group: network.id },
          overrideAccess: false,
          req: await request(position),
        })
      const remove = async (position: string) =>
        payload.delete({
          collection: 'clinicGroups',
          id: network.id,
          overrideAccess: false,
          req: await request(position),
        })
      const business = async (position: string) =>
        payload.update({
          collection: 'clinics',
          id: independent.id,
          data: { name: 'Authorized local edit' },
          overrideAccess: false,
          req: await createLocalReq({ user: localUser!, context: { groupOrdering: position } }, payload),
        })
      const other = (position: string) => (businessOrder ? business(position) : remove(position))
      const settled = <T>(promise: Promise<T>) =>
        promise.then(
          (value) => ({ value, error: undefined }),
          (error: unknown) => ({ value: undefined, error }),
        )
      const first = settled(attachmentFirst ? attach('first') : other('first'))
      let second: ReturnType<typeof settled> | undefined
      try {
        await waitFor(paused)
        second = settled(attachmentFirst ? other('second') : attach('second'))
        await waitFor(opponentPaused)
        proceed()
        expect((await first).error).toBeUndefined()
        if (businessOrder) expect((await second).error).toBeUndefined()
        else expect((await second).error).toBeDefined()
        const stored = await payload.findByID({
          collection: 'clinics',
          id: independent.id,
          overrideAccess: true,
          depth: 0,
        })
        if (businessOrder) {
          expect(stored.group).toBe(network.id)
          expect(stored.name).toBe('Authorized local edit')
          expect((await readClinicAccessState(payload, localStaff!.id))?.clinic.id).toBe(independent.id)
        } else if (attachmentFirst) {
          expect(stored.group).toBe(network.id)
          expect(
            (await payload.findByID({ collection: 'clinicGroups', id: network.id, overrideAccess: true })).id,
          ).toBe(network.id)
        } else {
          groupIds.splice(groupIds.indexOf(network.id), 1)
          expect(stored.group).toBeFalsy()
          expect(
            (
              await payload.find({
                collection: 'clinicGroups',
                where: { id: { equals: network.id } },
                overrideAccess: true,
              })
            ).docs,
          ).toHaveLength(0)
        }
      } finally {
        proceed()
        await first
        await second
        clinicHooks.afterChange = previousClinic
        groupHooks.afterDelete = previousGroup
        controlHooks.beforeChange = previousControl
      }
    },
  )

  it('replays the additive schema after rollback while retaining an independent clinic', async () => {
    const independent = await clinic()
    const req = await createLocalReq({}, payload)
    const args = { db: (payload.db as unknown as PostgresAdapter).drizzle, payload, req }
    await removeStaffGroupSchema(args)
    await removeGroupSchema(args)
    await addGroupSchema(args)
    await addStaffGroupSchema(args)
    const retained = await payload.findByID({
      collection: 'clinics',
      id: independent.id,
      overrideAccess: true,
      depth: 0,
    })
    expect(retained).toMatchObject({
      id: independent.id,
      name: independent.name,
      status: independent.status,
      participationStatus: independent.participationStatus,
    })
    expect(retained.group).toBeFalsy()
    const network = await group()
    await payload.update({
      collection: 'clinics',
      id: independent.id,
      data: { group: network.id },
      overrideAccess: false,
      req: operator,
    })
    expect(
      (await payload.findByID({ collection: 'clinics', id: independent.id, overrideAccess: true, depth: 0 })).group,
    ).toBe(network.id)
  })
})

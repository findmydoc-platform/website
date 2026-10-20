import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
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
import { replaceClinicStaffAssignment } from '@/features/clinicGroups/staffAssignments'
import { readClinicTargetAccess } from '@/auth/utilities/clinicPrincipalAccess'
import { changeClinicGroup, clinicGroupMembershipEndpoint } from '@/features/clinicGroups/membership'

describe('trusted current clinic group movement', () => {
  let payload: Payload
  let operator: PayloadRequest
  let cityId: number
  const clinicIds: number[] = []
  const doctorIds: number[] = []
  const groupIds: number[] = []
  const staffIds: Array<number | string> = []
  const prefix = testSlug('clinicGroupTransfers.lifecycle.test.ts')
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
    const result = await payload.create({
      collection: 'clinicGroups',
      data: { name: 'Movement network' },
      req: operator,
      overrideAccess: false,
    })
    groupIds.push(result.id)
    return result
  }
  const clinic = async (groupId?: number) => {
    const result = await createClinicFixture(payload, cityId, { slugPrefix: `${prefix}-${clinicIds.length}` })
    clinicIds.push(result.clinic.id)
    doctorIds.push(result.doctor.id)
    return payload.update({
      collection: 'clinics',
      id: result.clinic.id,
      data: { participationStatus: 'approved', ...(groupId ? { group: groupId } : {}) },
      req: operator,
      overrideAccess: false,
      depth: 0,
    })
  }
  const person = async (clinicId: number, groupId?: number) => {
    const staff = await createClinicTestUser(payload, { emailPrefix: prefix, createdStaffIds: staffIds })
    const user = await asClinicScopedPayloadUser(payload, staff, clinicId)
    if (groupId) await replaceClinicStaffAssignment(operator, staff.id, { scope: 'group', groupId })
    return { id: staff.id, user, req: await createLocalReq({ user }, payload) }
  }

  it('transfers and detaches a clinic while current managers change and local identity and history remain intact', async () => {
    const oldGroup = await group()
    const newGroup = await group()
    const source = await clinic(oldGroup.id)
    const foreign = await clinic()
    const local = await person(source.id)
    const former = await person(source.id, oldGroup.id)
    const incoming = await person(foreign.id, newGroup.id)
    await payload.update({
      collection: 'clinics',
      id: source.id,
      data: { status: 'draft' },
      req: operator,
      overrideAccess: false,
    })
    const before = await payload.findByID({ collection: 'clinicStaff', id: local.id, depth: 0, overrideAccess: true })
    const historicalDoctor = await payload.findByID({
      collection: 'doctors',
      id: doctorIds[0]!,
      depth: 0,
      overrideAccess: true,
    })
    expect(await readClinicTargetAccess(payload, former.id, source.id, former.req)).not.toBeNull()
    expect(await readClinicTargetAccess(payload, incoming.id, source.id, incoming.req)).toBeNull()
    const moved = await changeClinicGroup(operator, source.id, { fromGroupId: oldGroup.id, toGroupId: newGroup.id })
    expect(moved).toMatchObject({
      id: source.id,
      group: newGroup.id,
      status: 'draft',
      participationStatus: source.participationStatus,
    })
    await expect(
      payload.findByID({ collection: 'clinics', id: source.id, req: former.req, overrideAccess: false }),
    ).rejects.toMatchObject({ status: 403 })
    expect(
      (await payload.findByID({ collection: 'clinics', id: source.id, req: incoming.req, overrideAccess: false })).name,
    ).toBe(source.name)
    expect(await readClinicTargetAccess(payload, local.id, source.id, local.req)).not.toBeNull()
    expect(await readClinicTargetAccess(payload, incoming.id, foreign.id, incoming.req)).toBeNull()
    expect(
      await payload.findByID({ collection: 'doctors', id: historicalDoctor.id, depth: 0, overrideAccess: true }),
    ).toEqual(historicalDoctor)
    expect(await payload.findByID({ collection: 'clinicStaff', id: local.id, depth: 0, overrideAccess: true })).toEqual(
      before,
    )
    const independent = await changeClinicGroup(operator, source.id, { fromGroupId: newGroup.id, toGroupId: null })
    expect(independent.group).toBeNull()
    expect(await readClinicTargetAccess(payload, incoming.id, source.id, incoming.req)).toBeNull()
    expect(await readClinicTargetAccess(payload, former.id, source.id, former.req)).toBeNull()
    expect(await readClinicTargetAccess(payload, local.id, source.id, local.req)).not.toBeNull()
    expect(await payload.findByID({ collection: 'clinicStaff', id: local.id, depth: 0, overrideAccess: true })).toEqual(
      before,
    )
  })
  it('requires the current persisted operator, an exact expected membership and a valid native command', async () => {
    const oldGroup = await group()
    const newGroup = await group()
    const source = await clinic(oldGroup.id)
    const local = await person(source.id)
    await expect(
      changeClinicGroup(local.req, source.id, { fromGroupId: oldGroup.id, toGroupId: newGroup.id }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      changeClinicGroup(operator, source.id, { fromGroupId: newGroup.id, toGroupId: null }),
    ).rejects.toMatchObject({ status: 409 })
    await expect(
      payload.update({
        collection: 'clinics',
        id: source.id,
        data: { group: newGroup.id },
        req: operator,
        overrideAccess: true,
        context: { clinicGroupMembershipCapability: {}, seed: true },
      }),
    ).rejects.toMatchObject({ status: 409 })
    await expect(
      changeClinicGroup(operator, source.id, { fromGroupId: oldGroup.id, toGroupId: 2147483647 }),
    ).rejects.toThrow()
    const endpoint = clinicGroupMembershipEndpoint.handler
    const req = await createLocalReq({ user: operator.user! }, payload)
    req.routeParams = { id: String(source.id) }
    req.json = async () => ({ fromGroupId: oldGroup.id, toGroupId: newGroup.id })
    const response = await endpoint(req)
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('Vary')).toBe('Authorization, Cookie')
    expect(await response.json()).toEqual({ id: source.id, group: newGroup.id })
    await expect(
      changeClinicGroup(operator, source.id, { fromGroupId: oldGroup.id, toGroupId: newGroup.id }),
    ).rejects.toMatchObject({ status: 409 })
    req.json = async () => ({ fromGroupId: newGroup.id, toGroupId: null, clinic: 99 })
    await expect(endpoint(req)).rejects.toMatchObject({ status: 400 })
    const stored = await payload.findByID({ collection: 'clinics', id: source.id, depth: 0, overrideAccess: true })
    expect(stored.group).toBe(newGroup.id)
  })

  it.each([
    ['business-first', 'detach'],
    ['move-first', 'detach'],
    ['business-first', 'transfer'],
    ['move-first', 'transfer'],
  ] as const)('orders %s %s against a real clinic business mutation', async (order, destination) => {
    const network = await group()
    const foreign = await group()
    const source = await clinic(network.id)
    const { id: staffId, user } = await person(source.id)
    await replaceClinicStaffAssignment(operator, staffId, { scope: 'group', groupId: network.id })
    const original = await payload.findByID({
      collection: 'clinicStaff',
      id: staffId,
      overrideAccess: true,
      depth: 0,
    })
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
            timer = setTimeout(() => reject(new Error('Native assignment ordering checkpoint timed out.')), 5000)
          }),
        ])
      } finally {
        clearTimeout(timer)
      }
    }
    const clinicHooks = payload.collections.clinics.config.hooks
    const controlHooks = payload.collections.clinicNotificationControls.config.hooks
    const previousClinic = clinicHooks.afterChange
    const previousControl = controlHooks.beforeChange
    clinicHooks.afterChange = [
      ...(previousClinic ?? []),
      async ({ doc, req }) => {
        if (req.context.assignmentRace === 'first') {
          entered()
          await released
        }
        return doc
      },
    ]
    controlHooks.beforeChange = [
      ...(previousControl ?? []),
      ({ data, req }) => {
        if (req.context.assignmentRace === 'second' && data.key === `notification-authorization:clinic:${source.id}`)
          opponentEntered()
        return data
      },
    ]
    const business = async (position: string) =>
      payload.update({
        collection: 'clinics',
        id: source.id,
        data: { name: 'Committed authorized profile' },
        overrideAccess: false,
        req: await createLocalReq({ user, context: { assignmentRace: position } }, payload),
      })
    const movement = async (position: string) =>
      changeClinicGroup(
        await createLocalReq({ user: operator.user!, context: { assignmentRace: position } }, payload),
        source.id,
        { fromGroupId: network.id, toGroupId: destination === 'transfer' ? foreign.id : null },
      )
    const settled = (promise: Promise<unknown>) =>
      promise.then(
        (value) => ({ value, error: undefined }),
        (error: unknown) => ({ value: undefined, error }),
      )
    const first = settled(order === 'business-first' ? business('first') : movement('first'))
    let second: ReturnType<typeof settled> | undefined
    try {
      await waitFor(paused)
      second = settled(order === 'business-first' ? movement('second') : business('second'))
      await waitFor(opponentPaused)
      proceed()
      expect((await first).error).toBeUndefined()
      if (order === 'move-first') expect((await second).error).toMatchObject({ status: 403 })
      else expect((await second).error).toBeUndefined()
      const stored = await payload.findByID({ collection: 'clinics', id: source.id, overrideAccess: true, depth: 0 })
      expect(stored.name).toBe(order === 'business-first' ? 'Committed authorized profile' : source.name)
      expect(stored.group).toBe(destination === 'transfer' ? foreign.id : null)
      const finalStaff = await payload.findByID({
        collection: 'clinicStaff',
        id: staffId,
        overrideAccess: true,
        depth: 0,
      })
      expect(finalStaff.activationReadiness).toEqual(original.activationReadiness)
      expect(finalStaff.accountCompletion).toEqual(original.accountCompletion)
      expect(finalStaff.assignmentScope).toBe('group')
      expect(finalStaff.group).toBe(network.id)
      expect(await readClinicTargetAccess(payload, staffId, source.id)).toBeNull()
    } finally {
      proceed()
      await first
      await second
      clinicHooks.afterChange = previousClinic
      controlHooks.beforeChange = previousControl
    }
  })
})

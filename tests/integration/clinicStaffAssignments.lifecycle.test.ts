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
import { replaceClinicStaffAssignment, revokeResetClinicAssignment } from '@/features/clinicGroups/staffAssignments'
import { readClinicPrincipalAccess, readClinicTargetAccess } from '@/auth/utilities/clinicPrincipalAccess'
import { isClinicUserApproved } from '@/auth/utilities/userLookup'
import { readClinicAccessState } from '@/auth/utilities/clinicAccessState'

describe('existing personal clinic and group assignments', () => {
  let payload: Payload
  let operator: PayloadRequest
  let cityId: number
  const clinicIds: number[] = []
  const doctorIds: number[] = []
  const groupIds: number[] = []
  const staffIds: Array<number | string> = []
  const prefix = testSlug('clinicStaffAssignments.lifecycle.test.ts')
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
      data: { name: 'Assigned network' },
      overrideAccess: false,
      req: operator,
    })
    groupIds.push(created.id)
    return created
  }
  const clinic = async (suffix: string, groupId?: number) => {
    const result = await createClinicFixture(payload, cityId, { slugPrefix: `${prefix}-${suffix}` })
    clinicIds.push(result.clinic.id)
    doctorIds.push(result.doctor.id)
    return payload.update({
      collection: 'clinics',
      id: result.clinic.id,
      data: { participationStatus: 'approved', ...(groupId ? { group: groupId } : {}) },
      overrideAccess: true,
      req: groupId ? operator : undefined,
      depth: 0,
    })
  }
  const person = async (clinicId: number) => {
    const staff = await createClinicTestUser(payload, { emailPrefix: prefix, createdStaffIds: staffIds })
    const user = await asClinicScopedPayloadUser(payload, staff, clinicId)
    return { staff, user, req: await createLocalReq({ user }, payload) }
  }

  it('preserves personal activation through local, group, explicit local and revoked scopes', async () => {
    const network = await group()
    const first = await clinic('first', network.id)
    const second = await clinic('second', network.id)
    const foreign = await clinic('foreign')
    const { staff, req } = await person(first.id)
    const before = await payload.findByID({ collection: 'clinicStaff', id: staff.id, overrideAccess: true, depth: 0 })
    await replaceClinicStaffAssignment(operator, staff.id, { scope: 'group', groupId: network.id })
    const access = await readClinicPrincipalAccess(payload, staff.id, req)
    expect(access?.clinics.map(({ id }) => id).sort()).toEqual([first.id, second.id].sort())
    expect(await readClinicTargetAccess(payload, staff.id, foreign.id, req)).toBeNull()
    expect(await readClinicAccessState(payload, staff.id, req)).toBeNull()
    const grouped = await payload.findByID({ collection: 'clinicStaff', id: staff.id, overrideAccess: true, depth: 0 })
    expect(grouped).toMatchObject({
      id: before.id,
      supabaseUserId: before.supabaseUserId,
      status: before.status,
      accountCompletion: before.accountCompletion,
      activationReadiness: before.activationReadiness,
    })
    expect(grouped.clinic).toBeNull()
    await expect(
      payload.delete({ collection: 'clinicGroups', id: network.id, req: operator, overrideAccess: false }),
    ).rejects.toMatchObject({ status: 409 })
    await replaceClinicStaffAssignment(operator, staff.id, { scope: 'local', clinicId: second.id })
    expect((await readClinicPrincipalAccess(payload, staff.id, req))?.clinics.map(({ id }) => id)).toEqual([second.id])
    await replaceClinicStaffAssignment(operator, staff.id, { scope: 'unassigned' })
    expect((await readClinicPrincipalAccess(payload, staff.id, req))?.clinics).toEqual([])
    expect(await readClinicTargetAccess(payload, staff.id, second.id, req)).toBeNull()
    expect(
      (await payload.findByID({ collection: 'clinicStaff', id: staff.id, overrideAccess: true })).activationReadiness,
    ).toEqual(before.activationReadiness)
  })
  it('authorizes direct source reads and writes only within the current eligible clinic set', async () => {
    const network = await group()
    const first = await clinic('first', network.id)
    const second = await clinic('second', network.id)
    const foreign = await clinic('foreign')
    const { staff, req } = await person(first.id)
    await replaceClinicStaffAssignment(operator, staff.id, { scope: 'group', groupId: network.id })
    expect((await payload.findByID({ collection: 'clinics', id: second.id, req, overrideAccess: false })).id).toBe(
      second.id,
    )
    await payload.update({
      collection: 'clinics',
      id: second.id,
      data: { name: 'Managed second clinic' },
      req,
      overrideAccess: false,
    })
    expect((await payload.findByID({ collection: 'clinics', id: second.id, overrideAccess: true })).name).toBe(
      'Managed second clinic',
    )
    await expect(
      payload.findByID({ collection: 'clinics', id: foreign.id, req, overrideAccess: false }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload.update({
        collection: 'clinics',
        id: foreign.id,
        data: { name: 'Forbidden' },
        req,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 })
    const mismatch = await createLocalReq(
      { user: req.user!, req: { routeParams: { clinicId: String(first.id) } } },
      payload,
    )
    await expect(
      payload.update({
        collection: 'clinics',
        id: second.id,
        data: { name: 'Wrong source' },
        req: mismatch,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload.create({ collection: 'clinicGroups', data: { name: 'Forbidden admin' }, req, overrideAccess: false }),
    ).rejects.toMatchObject({ status: 403 })
    await payload.update({
      collection: 'clinics',
      id: second.id,
      data: { participationStatus: 'disabled' },
      req: operator,
      overrideAccess: true,
    })
    expect(await readClinicTargetAccess(payload, staff.id, second.id, req)).toBeNull()
    await expect(
      payload.findByID({ collection: 'clinics', id: second.id, req, overrideAccess: false }),
    ).rejects.toMatchObject({ status: 403 })
    expect((await readClinicPrincipalAccess(payload, staff.id, req))?.clinics.map(({ id }) => id)).toEqual([first.id])
  })

  it('keeps identity eligibility with zero clinics while protecting the personal group reference', async () => {
    const empty = await group()
    const first = await clinic('local')
    const { staff, req } = await person(first.id)
    await replaceClinicStaffAssignment(operator, staff.id, { scope: 'group', groupId: empty.id })
    expect((await readClinicPrincipalAccess(payload, staff.id, req))?.clinics).toEqual([])
    expect(await isClinicUserApproved(payload, String(staff.id), req)).toBe(true)
    await expect(
      payload.delete({ collection: 'clinicGroups', id: empty.id, req: operator, overrideAccess: false }),
    ).rejects.toMatchObject({ status: 409 })
    await payload.update({
      collection: 'clinicStaff',
      id: staff.id,
      data: { status: 'disabled' },
      overrideAccess: true,
      context: { skipClinicStaffAuthSync: true },
    })
    expect(await readClinicPrincipalAccess(payload, staff.id, req)).toBeNull()
    await payload.update({
      collection: 'clinicStaff',
      id: staff.id,
      data: { status: 'approved' },
      overrideAccess: true,
      context: { skipClinicStaffAuthSync: true },
    })
    await replaceClinicStaffAssignment(operator, staff.id, { scope: 'unassigned' })
    expect(await isClinicUserApproved(payload, String(staff.id), req)).toBe(true)
    expect(await readClinicTargetAccess(payload, staff.id, first.id, req)).toBeNull()
    await payload.delete({ collection: 'clinicGroups', id: empty.id, req: operator, overrideAccess: false })
    groupIds.splice(groupIds.indexOf(empty.id), 1)
  })

  it('rejects partial, contradictory and untrusted replacements without altering evidence or access', async () => {
    const network = await group()
    const first = await clinic('first')
    const { staff, req } = await person(first.id)
    await expect(
      payload.update({
        collection: 'clinicStaff',
        id: staff.id,
        data: { assignmentScope: 'group' },
        req: operator,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      payload.update({
        collection: 'clinicStaff',
        id: staff.id,
        data: { assignmentScope: 'group', clinic: first.id, group: network.id },
        req: operator,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      replaceClinicStaffAssignment(req, staff.id, { scope: 'group', groupId: network.id }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload.update({
        collection: 'clinicStaff',
        id: staff.id,
        data: { assignmentScope: 'group', clinic: null, group: network.id },
        overrideAccess: true,
        context: { seed: true, trustedPlatformStaffOps: true },
      }),
    ).rejects.toMatchObject({ status: 403 })
    expect((await readClinicPrincipalAccess(payload, staff.id, req))?.clinics.map(({ id }) => id)).toEqual([first.id])
  })

  it('keeps a changed assignment when reset expected another clinic and never turns reset context into authority', async () => {
    const first = await clinic('reset-first')
    const other = await clinic('reset-other')
    const network = await group()
    const { staff, req } = await person(first.id)
    const original = await payload.findByID({ collection: 'clinicStaff', id: staff.id, depth: 0, overrideAccess: true })
    await expect(revokeResetClinicAssignment(req, staff.id, other.id)).rejects.toMatchObject({ status: 409 })
    await expect(
      payload.update({
        collection: 'clinicStaff',
        id: staff.id,
        data: { assignmentScope: 'unassigned', clinic: null, group: null },
        overrideAccess: true,
        req,
        context: { seedReset: true, skipHooks: true, clinicResetAssignmentCapability: {} },
      }),
    ).rejects.toMatchObject({ status: 403 })
    await replaceClinicStaffAssignment(operator, staff.id, { scope: 'group', groupId: network.id })
    await expect(revokeResetClinicAssignment(req, staff.id, first.id)).rejects.toMatchObject({ status: 409 })
    const current = await payload.findByID({ collection: 'clinicStaff', id: staff.id, depth: 0, overrideAccess: true })
    expect(current).toMatchObject({
      assignmentScope: 'group',
      group: network.id,
      clinic: null,
      activationReadiness: original.activationReadiness,
      accountCompletion: original.accountCompletion,
    })
  })

  it.each([
    ['business-first', 'unassigned'],
    ['assignment-first', 'unassigned'],
    ['business-first', 'group'],
    ['assignment-first', 'group'],
  ] as const)(
    'orders a clinic mutation and %s %s replacement using persisted authority',
    async (order, destination) => {
      const network = await group()
      const foreign = await group()
      const source = await clinic('source', network.id)
      const { staff, user } = await person(source.id)
      await replaceClinicStaffAssignment(operator, staff.id, { scope: 'group', groupId: network.id })
      const original = await payload.findByID({
        collection: 'clinicStaff',
        id: staff.id,
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
      const staffHooks = payload.collections.clinicStaff.config.hooks
      const controlHooks = payload.collections.clinicNotificationControls.config.hooks
      const previousClinic = clinicHooks.afterChange
      const previousStaff = staffHooks.afterChange
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
      staffHooks.afterChange = [
        ...(previousStaff ?? []),
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
          if (req.context.assignmentRace === 'second' && data.key === `notification-authorization:staff:${staff.id}`)
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
      const assignment = async (position: string) =>
        replaceClinicStaffAssignment(
          await createLocalReq({ user: operator.user!, context: { assignmentRace: position } }, payload),
          staff.id,
          destination === 'group' ? { scope: 'group', groupId: foreign.id } : { scope: 'unassigned' },
        )
      const settled = (promise: Promise<unknown>) =>
        promise.then(
          (value) => ({ value, error: undefined }),
          (error: unknown) => ({ value: undefined, error }),
        )
      const first = settled(order === 'business-first' ? business('first') : assignment('first'))
      let second: ReturnType<typeof settled> | undefined
      try {
        await waitFor(paused)
        second = settled(order === 'business-first' ? assignment('second') : business('second'))
        await waitFor(opponentPaused)
        proceed()
        expect((await first).error).toBeUndefined()
        if (order === 'assignment-first') expect((await second).error).toMatchObject({ status: 403 })
        else expect((await second).error).toBeUndefined()
        const stored = await payload.findByID({ collection: 'clinics', id: source.id, overrideAccess: true, depth: 0 })
        expect(stored.name).toBe(order === 'business-first' ? 'Committed authorized profile' : source.name)
        expect(stored.group).toBe(network.id)
        const finalStaff = await payload.findByID({
          collection: 'clinicStaff',
          id: staff.id,
          overrideAccess: true,
          depth: 0,
        })
        expect(finalStaff.activationReadiness).toEqual(original.activationReadiness)
        expect(finalStaff.accountCompletion).toEqual(original.accountCompletion)
        expect(finalStaff.assignmentScope).toBe(destination)
        expect(await readClinicTargetAccess(payload, staff.id, source.id)).toBeNull()
      } finally {
        proceed()
        await first
        await second
        clinicHooks.afterChange = previousClinic
        staffHooks.afterChange = previousStaff
        controlHooks.beforeChange = previousControl
      }
    },
  )
})

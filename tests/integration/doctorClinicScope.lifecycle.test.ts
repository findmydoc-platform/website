import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { createTinyPngFile } from '../fixtures/mediaFile'
import {
  asPayloadStaffUser,
  createPlatformTestUser,
  createClinicTestUser,
  asClinicScopedPayloadUser,
  cleanupTrackedUsers,
} from '../fixtures/testUsers'
import { testSlug } from '../fixtures/testSlug'
import { replaceClinicStaffAssignment } from '@/features/clinicGroups/staffAssignments'
import { changeClinicGroup } from '@/features/clinicGroups/membership'
import { readClinicTargetAccess } from '@/auth/utilities/clinicPrincipalAccess'

describe('Current clinic doctor source permissions and native ordering', () => {
  let payload: Payload
  let operator: PayloadRequest
  let cityId: number
  const clinics: number[] = []
  const doctors: number[] = []
  const groups: number[] = []
  const media: number[] = []
  const specialties: number[] = []
  const treatments: number[] = []
  const staff: Array<number | string> = []
  const prefix = testSlug('doctorClinicScope.lifecycle.test.ts')
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
    await cleanupTrackedUsers(payload, { staffIds: staff })
    for (const id of media.splice(0)) await payload.delete({ collection: 'doctorMedia', id, overrideAccess: true })
    for (const id of specialties.splice(0))
      await payload.delete({ collection: 'doctorspecialties', id, overrideAccess: true })
    for (const id of treatments.splice(0))
      await payload.delete({ collection: 'doctortreatments', id, overrideAccess: true })
    for (const id of doctors.splice(0)) await payload.delete({ collection: 'doctors', id, overrideAccess: true })
    for (const id of clinics.splice(0)) await payload.delete({ collection: 'clinics', id, overrideAccess: true })
    for (const id of groups.splice(0))
      await payload.delete({ collection: 'clinicGroups', id, req: operator, overrideAccess: false })
  })
  async function fixtures() {
    const group = await payload.create({
      collection: 'clinicGroups',
      data: { name: 'Doctor network' },
      req: operator,
      overrideAccess: false,
    })
    groups.push(group.id)
    async function clinic(suffix: string, grouped: boolean) {
      const result = await createClinicFixture(payload, cityId, { slugPrefix: `${prefix}-${suffix}` })
      clinics.push(result.clinic.id)
      doctors.push(result.doctor.id)
      await payload.update({
        collection: 'clinics',
        id: result.clinic.id,
        data: { participationStatus: 'approved', ...(grouped ? { group: group.id } : {}) },
        req: grouped ? operator : undefined,
        overrideAccess: true,
      })
      return result
    }
    const first = await clinic('first', true)
    const second = await clinic('second', true)
    const foreign = await clinic('foreign', false)
    const principal = await createClinicTestUser(payload, { emailPrefix: prefix, createdStaffIds: staff })
    const user = await asClinicScopedPayloadUser(payload, principal, first.clinic.id)
    const request = (clinicId: number) =>
      createLocalReq({ user, req: { routeParams: { clinicId: String(clinicId) } } }, payload)
    return { group, first, second, foreign, principal, user, request }
  }
  async function specialty(doctorId: number) {
    const master = (await payload.find({ collection: 'medical-specialties', limit: 1, overrideAccess: true })).docs[0]!
    const result = await payload.create({
      collection: 'doctorspecialties',
      data: { doctor: doctorId, medicalSpecialty: master.id, specializationLevel: 'beginner' },
      req: operator,
      overrideAccess: false,
    })
    specialties.push(result.id)
    return result
  }
  async function image(doctorId: number) {
    const result = await payload.create({
      collection: 'doctorMedia',
      data: { alt: 'Original portrait', doctor: doctorId } as import('@/payload-types').DoctorMedia,
      file: createTinyPngFile(`${prefix}-${doctorId}.png`),
      req: operator,
      overrideAccess: false,
    })
    media.push(result.id)
    return result
  }
  it('permits local and group doctors, denies foreign and explicit record/clinic mismatch, and preserves participation semantics', async () => {
    const f = await fixtures()
    const own = await f.request(f.first.clinic.id)
    await payload.update({
      collection: 'doctors',
      id: f.first.doctor.id,
      data: { biography: 'Local edit' },
      req: own,
      overrideAccess: false,
    })
    await expect(
      payload.findByID({ collection: 'doctors', id: f.second.doctor.id, req: own, overrideAccess: false }),
    ).rejects.toMatchObject({ status: 403 })
    await replaceClinicStaffAssignment(operator, f.principal.id, { scope: 'group', groupId: f.group.id })
    const second = await f.request(f.second.clinic.id)
    await payload.update({
      collection: 'clinics',
      id: f.second.clinic.id,
      data: { status: 'pending' },
      req: operator,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'doctors',
      id: f.second.doctor.id,
      data: { biography: 'Group edit in unpublished clinic' },
      req: second,
      overrideAccess: false,
    })
    await expect(
      payload.update({
        collection: 'doctors',
        id: f.second.doctor.id,
        data: { biography: 'Wrong target' },
        req: own,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload.findByID({ collection: 'doctors', id: f.foreign.doctor.id, req: second, overrideAccess: false }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload.update({
        collection: 'doctors',
        id: f.first.doctor.id,
        data: { clinic: f.second.clinic.id },
        req: own,
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
      payload.update({
        collection: 'doctors',
        id: f.second.doctor.id,
        data: { biography: 'Disabled clinic' },
        req: second,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 })
    expect(
      (await payload.findByID({ collection: 'doctors', id: f.second.doctor.id, overrideAccess: true })).biography,
    ).toBe('Group edit in unpublished clinic')
  })
  it('creates only in the current explicit group target and denies missing or empty scope', async () => {
    const f = await fixtures()
    await replaceClinicStaffAssignment(operator, f.principal.id, { scope: 'group', groupId: f.group.id })
    const data = {
      firstName: 'Synthetic',
      lastName: 'Doctor',
      gender: 'female' as const,
      qualifications: ['MD'],
      languages: ['english' as const],
    } as import('payload').RequiredDataFromCollectionSlug<'doctors'>
    const created = await payload.create({
      collection: 'doctors',
      data,
      req: await f.request(f.second.clinic.id),
      overrideAccess: false,
    })
    doctors.push(created.id)
    expect(created.clinic).toBe(f.second.clinic.id)
    await payload.update({
      collection: 'clinics',
      id: f.first.clinic.id,
      data: { participationStatus: 'disabled' },
      req: operator,
      overrideAccess: true,
    })
    await expect(
      payload.create({
        collection: 'doctors',
        data,
        req: await createLocalReq({ user: f.user }, payload),
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 })
    await replaceClinicStaffAssignment(operator, f.principal.id, { scope: 'unassigned' })
    await expect(
      payload.create({ collection: 'doctors', data, req: await f.request(f.second.clinic.id), overrideAccess: false }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload.find({
        collection: 'doctors',
        req: await f.request(f.second.clinic.id),
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 })
  })
  it('retains doctor, specialty, treatment and image ownership through direct collection writes', async () => {
    const f = await fixtures()
    await replaceClinicStaffAssignment(operator, f.principal.id, { scope: 'group', groupId: f.group.id })
    const req = await f.request(f.first.clinic.id)
    const assignment = await specialty(f.first.doctor.id)
    await payload.update({
      collection: 'doctorspecialties',
      id: assignment.id,
      data: { specializationLevel: 'expert' },
      req,
      overrideAccess: false,
    })
    await expect(
      payload.update({
        collection: 'doctorspecialties',
        id: assignment.id,
        data: { doctor: f.second.doctor.id },
        req,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 })
    const master = (await payload.find({ collection: 'treatments', limit: 1, overrideAccess: true })).docs[0]!
    const treatment = await payload.create({
      collection: 'doctortreatments',
      data: { doctor: f.first.doctor.id, treatment: master.id, specializationLevel: 'general_practice' },
      req,
      overrideAccess: false,
    })
    treatments.push(treatment.id)
    await expect(
      payload.update({
        collection: 'doctortreatments',
        id: treatment.id,
        data: { doctor: f.foreign.doctor.id },
        req,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload.update({
        collection: 'doctorspecialties',
        id: assignment.id,
        data: { medicalSpecialty: 2147483647 },
        req,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 400 })
    const ownImage = await image(f.first.doctor.id)
    const foreignImage = await image(f.second.doctor.id)
    await payload.update({
      collection: 'doctorMedia',
      id: ownImage.id,
      data: { alt: 'Updated portrait' },
      req,
      overrideAccess: false,
    })
    await payload.update({
      collection: 'doctors',
      id: f.first.doctor.id,
      data: { profileImage: ownImage.id },
      req,
      overrideAccess: false,
    })
    await expect(
      payload.update({
        collection: 'doctors',
        id: f.first.doctor.id,
        data: { profileImage: foreignImage.id },
        req,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      payload.update({
        collection: 'doctorMedia',
        id: foreignImage.id,
        data: { alt: 'Wrong media' },
        req,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload.update({
        collection: 'doctorMedia',
        id: ownImage.id,
        data: { doctor: f.second.doctor.id },
        req,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 })
  })
  it.each(['doctors', 'doctorspecialties', 'doctorMedia'] as const)(
    'fails closed without a native transaction owner for %s',
    async (collection) => {
      const f = await fixtures()
      const record =
        collection === 'doctors'
          ? f.first.doctor
          : collection === 'doctorspecialties'
            ? await specialty(f.first.doctor.id)
            : await image(f.first.doctor.id)
      await expect(
        payload.update({
          collection,
          id: record.id,
          data:
            collection === 'doctors'
              ? { biography: 'Missing transaction' }
              : collection === 'doctorspecialties'
                ? { specializationLevel: 'expert' }
                : { alt: 'Missing transaction' },
          req: await f.request(f.first.clinic.id),
          overrideAccess: false,
          disableTransaction: true,
        }),
      ).rejects.toThrow(/active native transaction/)
    },
  )
  it.each([
    ['doctors', 'business-first', 'revoke'],
    ['doctors', 'access-first', 'revoke'],
    ['doctorspecialties', 'business-first', 'revoke'],
    ['doctorspecialties', 'access-first', 'revoke'],
    ['doctorMedia', 'business-first', 'revoke'],
    ['doctorMedia', 'access-first', 'revoke'],
    ['doctors', 'business-first', 'move'],
    ['doctors', 'access-first', 'move'],
    ['doctorMedia', 'business-first', 'move'],
    ['doctorMedia', 'access-first', 'move'],
  ] as const)('orders %s with %s against %s under real commit ownership', async (collection, order, accessChange) => {
    const f = await fixtures()
    await replaceClinicStaffAssignment(operator, f.principal.id, { scope: 'group', groupId: f.group.id })
    const destination =
      accessChange === 'move'
        ? await payload.create({
            collection: 'clinicGroups',
            data: { name: 'Destination network' },
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
    const record =
      collection === 'doctors'
        ? f.first.doctor
        : collection === 'doctorspecialties'
          ? await specialty(f.first.doctor.id)
          : await image(f.first.doctor.id)
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
            timer = setTimeout(() => reject(new Error('Doctor ordering checkpoint timed out.')), 5000)
          }),
        ])
      } finally {
        clearTimeout(timer)
      }
    }
    const businessHooks = payload.collections[collection].config.hooks
    const staffHooks = payload.collections[accessChange === 'move' ? 'clinics' : 'clinicStaff'].config.hooks
    const controls = payload.collections.clinicNotificationControls.config.hooks
    const oldBusiness = businessHooks.afterChange
    const oldStaff = staffHooks.afterChange
    const oldControl = controls.beforeChange
    const pause = async ({ doc, req }: { doc: unknown; req: PayloadRequest }) => {
      if (req.context.doctorRace === 'first') {
        entered()
        await released
      }
      return doc
    }
    businessHooks.afterChange = [...(oldBusiness ?? []), pause]
    staffHooks.afterChange = [...(oldStaff ?? []), pause]
    controls.beforeChange = [
      ...(oldControl ?? []),
      ({ data, req }) => {
        if (
          req.context.doctorRace === 'second' &&
          data.key ===
            (accessChange === 'move'
              ? `notification-authorization:clinic:${f.first.clinic.id}`
              : `notification-authorization:staff:${f.principal.id}`)
        )
          opponentEntered()
        return data
      },
    ]
    const business = async (position: string) =>
      payload.update({
        collection,
        id: record.id,
        data:
          collection === 'doctors'
            ? { biography: 'Committed doctor edit' }
            : collection === 'doctorspecialties'
              ? { specializationLevel: 'expert' }
              : { alt: 'Committed portrait edit' },
        req: await createLocalReq(
          {
            user: f.user,
            context: { doctorRace: position },
            req: { routeParams: { clinicId: String(f.first.clinic.id) } },
          },
          payload,
        ),
        overrideAccess: false,
      })
    const revoke = async (position: string) => {
      const req = await createLocalReq({ user: operator.user!, context: { doctorRace: position } }, payload)
      return destination
        ? changeClinicGroup(req, f.first.clinic.id, { fromGroupId: f.group.id, toGroupId: destination.id })
        : replaceClinicStaffAssignment(req, f.principal.id, { scope: 'unassigned' })
    }
    const settled = (promise: Promise<unknown>) =>
      promise.then(
        (value) => ({ value, error: undefined }),
        (error: unknown) => ({ value: undefined, error }),
      )
    const first = settled(order === 'business-first' ? business('first') : revoke('first'))
    let second: ReturnType<typeof settled> | undefined
    try {
      await waitFor(paused)
      second = settled(order === 'business-first' ? revoke('second') : business('second'))
      await waitFor(opponentPaused)
      release()
      expect((await first).error).toBeUndefined()
      if (order === 'access-first') expect((await second).error).toMatchObject({ status: 403 })
      else expect((await second).error).toBeUndefined()
      const stored = await payload.findByID({ collection, id: record.id, overrideAccess: true, depth: 0 })
      if (collection === 'doctors')
        expect('biography' in stored && stored.biography).toBe(
          order === 'business-first' ? 'Committed doctor edit' : f.first.doctor.biography,
        )
      if (collection === 'doctorspecialties')
        expect('specializationLevel' in stored && stored.specializationLevel).toBe(
          order === 'business-first' ? 'expert' : 'beginner',
        )
      if (collection === 'doctorMedia')
        expect('alt' in stored && stored.alt).toBe(
          order === 'business-first' ? 'Committed portrait edit' : 'Original portrait',
        )
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
      staffHooks.afterChange = oldStaff
      controls.beforeChange = oldControl
    }
  })
})

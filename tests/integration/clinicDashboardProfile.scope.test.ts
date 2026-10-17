import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import { changeClinicGroup } from '@/features/clinicGroups/membership'
import { replaceClinicStaffAssignment } from '@/features/clinicGroups/staffAssignments'
import { readClinicTargetAccess } from '@/auth/utilities/clinicPrincipalAccess'
import {
  createClinicProfileDraft,
  discardClinicProfileDraft,
  publishClinicProfileDraft,
  readClinicProfileSnapshot,
  saveClinicProfileDraft,
} from '@/features/clinicDashboard/profile/service'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import {
  asClinicScopedPayloadUser,
  asPayloadStaffUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPlatformTestUser,
} from '../fixtures/testUsers'

vi.mock('@payloadcms/storage-s3', () => ({ s3Storage: () => (incomingConfig: unknown) => incomingConfig }))

describe('clinic profile current source scope', () => {
  let payload: Payload
  let clinicId: number
  let secondClinicId: number
  let groupId: number
  let staff: PayloadRequest
  let operator: PayloadRequest
  const staffIds: Array<number | string> = []
  const slugPrefix = testSlug('clinicDashboardProfile.scope.test.ts')
  const draftFor = async (id: number) =>
    (
      await payload.find({
        collection: 'clinicProfileDrafts',
        where: { clinic: { equals: id } },
        depth: 0,
        overrideAccess: true,
      })
    ).docs[0]
  const clearDraft = async (id: number) => {
    const draft = await draftFor(id)
    if (draft)
      await payload.delete({ collection: 'clinicProfileDrafts', id: draft.id, req: operator, overrideAccess: true })
  }
  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    operator = await createLocalReq(
      {
        user: asPayloadStaffUser(
          await createPlatformTestUser(payload, { createdStaffIds: staffIds, emailPrefix: `${slugPrefix}-operator` }),
        ),
      },
      payload,
    )
    const city = (await payload.find({ collection: 'cities', limit: 1, depth: 0, overrideAccess: true })).docs[0]!
    clinicId = (await createClinicFixture(payload, city.id, { slugPrefix })).clinic.id
    secondClinicId = (await createClinicFixture(payload, city.id, { slugPrefix: `${slugPrefix}-second` })).clinic.id
    groupId = (
      await payload.create({
        collection: 'clinicGroups',
        data: { name: `${slugPrefix}-group` },
        req: operator,
        overrideAccess: false,
      })
    ).id
    for (const id of [clinicId, secondClinicId]) {
      await payload.update({
        collection: 'clinics',
        id,
        data: { group: groupId, status: 'approved', participationStatus: 'approved' },
        req: operator,
        overrideAccess: true,
      })
    }
    const principal = await createClinicTestUser(payload, {
      createdStaffIds: staffIds,
      emailPrefix: `${slugPrefix}-staff`,
    })
    staff = await createLocalReq({ user: await asClinicScopedPayloadUser(payload, principal, clinicId) }, payload)
  }, 60000)
  afterAll(async () => {
    if (!payload) return
    await clearDraft(clinicId)
    await clearDraft(secondClinicId)
    await replaceClinicStaffAssignment(operator, staff.user!.id, { scope: 'unassigned' })
    for (const id of [clinicId, secondClinicId]) {
      const clinic = await payload.findByID({ collection: 'clinics', id, depth: 0, overrideAccess: true })
      if (clinic.group === groupId) await changeClinicGroup(operator, id, { fromGroupId: groupId, toGroupId: null })
    }
    await payload.delete({ collection: 'clinicGroups', id: groupId, req: operator, overrideAccess: false })
    await cleanupTrackedUsers(payload, { staffIds })
    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })
  it('keeps local snapshots and draft creation on their explicit target and rejects foreign records', async () => {
    const initial = await readClinicProfileSnapshot(staff, clinicId)
    expect(initial.published.name).toContain(slugPrefix)
    await expect(readClinicProfileSnapshot(staff, secondClinicId)).rejects.toMatchObject({ status: 403 })
    await expect(
      createClinicProfileDraft(staff, secondClinicId, { expectedPublishedRevision: 0 }),
    ).rejects.toMatchObject({ status: 403 })
    const draft = await createClinicProfileDraft(staff, clinicId, {
      expectedPublishedRevision: initial.published.revision,
    })
    expect((await draftFor(clinicId))?.clinic).toBe(clinicId)
    const mismatch = await createLocalReq(
      { user: staff.user!, context: { clinicProfileTargetId: String(secondClinicId) } },
      payload,
    )
    await expect(
      discardClinicProfileDraft(mismatch, clinicId, { expectedDraftRevision: draft.draft!.revision }),
    ).rejects.toMatchObject({ status: 403 })
    await clearDraft(clinicId)
  })
  it('uses current group access without moving a draft or granting a detached clinic', async () => {
    await replaceClinicStaffAssignment(operator, staff.user!.id, { scope: 'group', groupId })
    try {
      const second = await readClinicProfileSnapshot(staff, secondClinicId)
      await createClinicProfileDraft(staff, secondClinicId, { expectedPublishedRevision: second.published.revision })
      const draft = (await draftFor(secondClinicId))!
      await expect(
        payload.update({
          collection: 'clinicProfileDrafts',
          id: draft.id,
          data: { clinic: clinicId },
          req: staff,
          overrideAccess: true,
        }),
      ).rejects.toMatchObject({ status: 403 })
      await changeClinicGroup(operator, secondClinicId, { fromGroupId: groupId, toGroupId: null })
      await expect(readClinicProfileSnapshot(staff, secondClinicId)).rejects.toMatchObject({ status: 403 })
      await expect(
        payload.update({
          collection: 'clinicProfileDrafts',
          id: draft.id,
          data: { name: 'Late change' },
          req: staff,
          overrideAccess: true,
        }),
      ).rejects.toThrow()
      expect((await draftFor(secondClinicId))?.clinic).toBe(secondClinicId)
    } finally {
      await clearDraft(secondClinicId)
      await payload.update({
        collection: 'clinics',
        id: secondClinicId,
        data: { group: groupId },
        req: operator,
        overrideAccess: true,
      })
      await replaceClinicStaffAssignment(operator, staff.user!.id, { scope: 'local', clinicId })
    }
  })
  it.each([
    ['business-first', 'assignment', 'publication'],
    ['access-first', 'assignment', 'publication'],
    ['business-first', 'membership', 'publication'],
    ['access-first', 'membership', 'publication'],
    ['business-first', 'assignment', 'native-draft'],
    ['access-first', 'assignment', 'native-draft'],
    ['business-first', 'membership', 'native-draft'],
    ['access-first', 'membership', 'native-draft'],
  ] as const)('orders %s against %s for %s through the actual outer commit', async (order, change, writer) => {
    await replaceClinicStaffAssignment(operator, staff.user!.id, { scope: 'group', groupId })
    const initial = await readClinicProfileSnapshot(staff, clinicId)
    const created = await createClinicProfileDraft(staff, clinicId, {
      expectedPublishedRevision: initial.published.revision,
    })
    const fields = created.draft!
    const publicationName = `Authorized ${order} ${change} ${writer}`
    await saveClinicProfileDraft(staff, clinicId, {
      expectedDraftRevision: created.draft!.revision,
      expectedPublishedRevision: initial.published.revision,
      draft: {
        name: publicationName,
        descriptionText: fields.descriptionText,
        supportedLanguages: fields.supportedLanguages,
        openingHours: fields.openingHours,
        address: {
          street: fields.address.street,
          houseNumber: fields.address.houseNumber,
          zipCode: fields.address.zipCode,
          cityId: fields.address.city!.id,
        },
      },
    })
    const saved = (await draftFor(clinicId))!
    let enter!: () => void
    let release!: () => void
    let oppose!: () => void
    const entered = new Promise<void>((resolve) => {
      enter = resolve
    })
    const released = new Promise<void>((resolve) => {
      release = resolve
    })
    const opposed = new Promise<void>((resolve) => {
      oppose = resolve
    })
    const clinics = payload.collections.clinics.config.hooks
    const drafts = payload.collections.clinicProfileDrafts.config.hooks
    const principals = payload.collections.clinicStaff.config.hooks
    const controls = payload.collections.clinicNotificationControls.config.hooks
    const previous = {
      clinic: clinics.afterChange,
      draft: drafts.afterChange,
      staff: principals.afterChange,
      control: controls.beforeChange,
    }
    const pause = async ({ doc, req }: { doc: unknown; req: PayloadRequest }) => {
      if (req.context.profileRace === 'first') {
        enter()
        await released
      }
      return doc
    }
    clinics.afterChange = [...(previous.clinic ?? []), pause as never]
    drafts.afterChange = [...(previous.draft ?? []), pause as never]
    principals.afterChange = [...(previous.staff ?? []), pause as never]
    controls.beforeChange = [
      ...(previous.control ?? []),
      ({ data, originalDoc, req }) => {
        if (
          req.context.profileRace === 'second' &&
          (data.key ?? originalDoc?.key) ===
            `notification-authorization:${change === 'assignment' ? `staff:${staff.user!.id}` : `clinic:${clinicId}`}`
        )
          oppose()
        return data
      },
    ]
    const business = async (position: string) => {
      const req = await createLocalReq(
        { user: staff.user!, context: { profileRace: position, clinicProfileTargetId: String(clinicId) } },
        payload,
      )
      return writer === 'publication'
        ? publishClinicProfileDraft(req, clinicId, {
            expectedDraftRevision: saved.revision,
            expectedPublishedRevision: initial.published.revision,
          })
        : payload.update({
            collection: 'clinicProfileDrafts',
            id: saved.id,
            data: { name: 'Native authorized before revocation' },
            req,
            overrideAccess: true,
          })
    }
    const revoke = async (position: string) => {
      const req = await createLocalReq({ user: operator.user!, context: { profileRace: position } }, payload)
      return change === 'assignment'
        ? replaceClinicStaffAssignment(req, staff.user!.id, { scope: 'unassigned' })
        : changeClinicGroup(req, clinicId, { fromGroupId: groupId, toGroupId: null })
    }
    const settle = (promise: Promise<unknown>) =>
      promise.then(
        (value) => ({ value, error: undefined }),
        (error: unknown) => ({ value: undefined, error }),
      )
    const first = settle(order === 'business-first' ? business('first') : revoke('first'))
    let second: ReturnType<typeof settle> | undefined
    const wait = async (checkpoint: Promise<void>, command: ReturnType<typeof settle>) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          checkpoint,
          command.then(({ error }) => {
            if (error) throw error
            throw new Error('Profile command completed before its ordering checkpoint.')
          }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Profile authorization ordering checkpoint timed out.')), 5000)
          }),
        ])
      } finally {
        clearTimeout(timer)
      }
    }
    try {
      await wait(entered, first)
      second = settle(order === 'business-first' ? revoke('second') : business('second'))
      await wait(opposed, second)
      release()
      const firstOutcome = await first
      expect(firstOutcome.error).toBeUndefined()
      const outcome = await second
      if (order === 'business-first') expect(outcome.error).toBeUndefined()
      else expect(outcome.error).toBeDefined()
      expect(await readClinicTargetAccess(payload, staff.user!.id, clinicId)).toBeNull()
      const clinic = await payload.findByID({ collection: 'clinics', id: clinicId, depth: 0, overrideAccess: true })
      const draft = await draftFor(clinicId)
      if (writer === 'publication') {
        if (change === 'membership') {
          // The last clinic writer is the membership command, including its existing revision hooks.
          const revoked = (order === 'business-first' ? outcome.value : firstOutcome.value) as {
            profileRevision: number
          }
          expect(revoked.profileRevision).toEqual(expect.any(Number))
          expect(clinic.profileRevision).toBe(revoked.profileRevision)
        } else expect(clinic.profileRevision).toBe(initial.published.revision + (order === 'business-first' ? 1 : 0))
        expect(clinic.name).toBe(order === 'business-first' ? publicationName : initial.published.name)
        expect(draft === undefined).toBe(order === 'business-first')
      } else
        expect(draft?.name).toBe(order === 'business-first' ? 'Native authorized before revocation' : publicationName)
    } finally {
      release()
      await first
      await second
      clinics.afterChange = previous.clinic
      drafts.afterChange = previous.draft
      principals.afterChange = previous.staff
      controls.beforeChange = previous.control
      await replaceClinicStaffAssignment(operator, staff.user!.id, { scope: 'local', clinicId })
      const clinic = await payload.findByID({ collection: 'clinics', id: clinicId, depth: 0, overrideAccess: true })
      if (clinic.group === null)
        await payload.update({
          collection: 'clinics',
          id: clinicId,
          data: { group: groupId },
          req: operator,
          overrideAccess: true,
        })
      await clearDraft(clinicId)
    }
  })
})

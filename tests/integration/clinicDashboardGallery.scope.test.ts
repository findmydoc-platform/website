import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import { changeClinicGroup } from '@/features/clinicGroups/membership'
import { replaceClinicStaffAssignment } from '@/features/clinicGroups/staffAssignments'
import { readClinicTargetAccess } from '@/auth/utilities/clinicPrincipalAccess'
import {
  discardClinicGalleryDrafts,
  readClinicGalleryImageSource,
  readClinicGallerySnapshot,
  saveClinicGallery,
  uploadClinicGalleryDraft,
} from '@/features/clinicDashboard/gallery/service'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { createTinyPngFile } from '../fixtures/mediaFile'
import { testSlug } from '../fixtures/testSlug'
import {
  asClinicScopedPayloadUser,
  asPayloadStaffUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPlatformTestUser,
} from '../fixtures/testUsers'

vi.mock('@payloadcms/storage-s3', () => ({ s3Storage: () => (incomingConfig: unknown) => incomingConfig }))

describe('clinic gallery current source scope', () => {
  let payload: Payload
  let clinicId: number
  let foreignClinicId: number
  let clinicReqA: PayloadRequest
  let operator: PayloadRequest
  const mediaIds: number[] = []
  const staffIds: Array<number | string> = []
  const slugPrefix = testSlug('clinicDashboardGallery.scope.test.ts')
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
    const city = (await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })).docs[0]!
    clinicId = (await createClinicFixture(payload, city.id, { slugPrefix })).clinic.id
    foreignClinicId = (await createClinicFixture(payload, city.id, { slugPrefix: `${slugPrefix}-foreign` })).clinic.id
    const staff = await createClinicTestUser(payload, { createdStaffIds: staffIds, emailPrefix: `${slugPrefix}-staff` })
    clinicReqA = await createLocalReq({ user: await asClinicScopedPayloadUser(payload, staff, clinicId) }, payload)
  }, 60000)
  afterAll(async () => {
    if (!payload) return
    for (const id of mediaIds) await payload.delete({ collection: 'clinicMedia', id, overrideAccess: true })
    await cleanupTrackedUsers(payload, { staffIds })
    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })
  it('keeps local uploads owned and rejects a foreign target, media ID, and discard', async () => {
    const media = await uploadClinicGalleryDraft(clinicReqA, clinicId, {}, createTinyPngFile(`${slugPrefix}-local.png`))
    mediaIds.push(Number(media.id))
    expect(new URL(media.url).pathname).toBe(
      `/api/clinic-dashboard/clinics/${clinicId}/gallery/media/${media.id}/image`,
    )
    const stored = await payload.findByID({ collection: 'clinicMedia', id: media.id, overrideAccess: true })
    expect(stored.clinic).toBe(clinicId)
    expect(stored.createdBy).toEqual({ relationTo: 'clinicStaff', value: clinicReqA.user!.id })
    expect(stored.storagePath).toContain(`clinics/${clinicId}-`)
    await expect(readClinicGallerySnapshot(clinicReqA, foreignClinicId)).rejects.toMatchObject({ status: 403 })
    const foreign = await uploadClinicGalleryDraft(
      operator,
      foreignClinicId,
      {},
      createTinyPngFile(`${slugPrefix}-foreign.png`),
    )
    mediaIds.push(Number(foreign.id))
    const revision = (await readClinicGallerySnapshot(clinicReqA, clinicId)).snapshot.revision
    await expect(
      saveClinicGallery(clinicReqA, clinicId, {
        expectedRevision: revision,
        items: [{ mediaId: foreign.id, alt: 'Foreign' }],
      }),
    ).rejects.toMatchObject({ kind: 'not-found' })
    await expect(discardClinicGalleryDrafts(clinicReqA, clinicId, { mediaIds: [foreign.id] })).rejects.toMatchObject({
      kind: 'not-found',
    })
    await expect(readClinicGalleryImageSource(clinicReqA, clinicId, foreign.id, 'original')).rejects.toMatchObject({
      kind: 'not-found',
    })
    const mismatch = await createLocalReq(
      { user: clinicReqA.user!, context: { clinicGalleryTargetId: String(foreignClinicId) } },
      payload,
    )
    await expect(
      saveClinicGallery(mismatch, clinicId, { expectedRevision: revision, items: [] }),
    ).rejects.toMatchObject({ status: 403 })
  })
  it('uses current group membership for upload, private media and publication without transferring ownership', async () => {
    const group = await payload.create({
      collection: 'clinicGroups',
      data: { name: `${slugPrefix}-group` },
      req: operator,
      overrideAccess: false,
    })
    await payload.update({
      collection: 'clinics',
      id: foreignClinicId,
      data: { status: 'approved', participationStatus: 'approved' },
      req: operator,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'clinics',
      id: clinicId,
      data: { group: group.id },
      req: operator,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'clinics',
      id: foreignClinicId,
      data: { group: group.id },
      req: operator,
      overrideAccess: true,
    })
    await replaceClinicStaffAssignment(operator, clinicReqA.user!.id, { scope: 'group', groupId: group.id })
    try {
      const media = await uploadClinicGalleryDraft(
        clinicReqA,
        foreignClinicId,
        {},
        createTinyPngFile(`${slugPrefix}-group.png`),
      )
      mediaIds.push(Number(media.id))
      expect(await readClinicGalleryImageSource(clinicReqA, foreignClinicId, media.id, 'original')).toContain(
        '/api/clinicMedia/file/',
      )
      expect(
        (
          await payload.find({
            collection: 'clinicMedia',
            where: { id: { equals: media.id } },
            req: clinicReqA,
            overrideAccess: false,
          })
        ).docs.map((item) => item.id),
      ).toEqual([Number(media.id)])
      await expect(
        payload.update({
          collection: 'clinicMedia',
          id: media.id,
          data: { clinic: clinicId },
          req: clinicReqA,
          overrideAccess: true,
        }),
      ).rejects.toMatchObject({ status: 403 })
      const revision = (await readClinicGallerySnapshot(clinicReqA, foreignClinicId)).snapshot.revision
      const saved = await saveClinicGallery(clinicReqA, foreignClinicId, {
        expectedRevision: revision,
        items: [{ mediaId: media.id, alt: 'Group reception' }],
      })
      expect(saved.snapshot.items.map((item) => item.id)).toEqual([media.id])
      await expect(
        payload.delete({
          collection: 'clinicMedia',
          id: media.id,
          overrideAccess: true,
          context: { clinicGalleryCleanupTarget: String(foreignClinicId) },
        }),
      ).rejects.toMatchObject({ status: 409 })
      await changeClinicGroup(operator, foreignClinicId, { fromGroupId: group.id, toGroupId: null })
      await expect(
        readClinicGalleryImageSource(clinicReqA, foreignClinicId, media.id, 'original'),
      ).rejects.toMatchObject({ status: 403 })
      await expect(
        payload.update({
          collection: 'clinicMedia',
          id: media.id,
          data: { alt: 'Late change after detachment' },
          req: clinicReqA,
          overrideAccess: true,
        }),
      ).rejects.toMatchObject({ status: 403 })
      expect(
        (
          await payload.find({
            collection: 'clinicMedia',
            where: { id: { equals: media.id } },
            req: clinicReqA,
            overrideAccess: false,
          })
        ).docs,
      ).toEqual([])
      const stored = await payload.findByID({ collection: 'clinicMedia', id: media.id, overrideAccess: true })
      expect(stored.clinic).toBe(foreignClinicId)
      expect(stored.storagePath).toContain(`clinics/${foreignClinicId}-`)
      await saveClinicGallery(operator, foreignClinicId, { expectedRevision: saved.snapshot.revision, items: [] })
    } finally {
      await replaceClinicStaffAssignment(operator, clinicReqA.user!.id, { scope: 'local', clinicId })
      await changeClinicGroup(operator, clinicId, { fromGroupId: group.id, toGroupId: null })
      const current = await payload.findByID({ collection: 'clinics', id: foreignClinicId, overrideAccess: true })
      if (current.group) await changeClinicGroup(operator, foreignClinicId, { fromGroupId: group.id, toGroupId: null })
      await payload.delete({ collection: 'clinicGroups', id: group.id, req: operator, overrideAccess: false })
    }
  })
  it.each([
    ['business-first', 'assignment', 'publication'],
    ['access-first', 'assignment', 'publication'],
    ['business-first', 'membership', 'publication'],
    ['access-first', 'membership', 'publication'],
    ['business-first', 'assignment', 'native-media'],
    ['access-first', 'assignment', 'native-media'],
    ['business-first', 'membership', 'native-media'],
    ['access-first', 'membership', 'native-media'],
  ] as const)('orders %s against %s changes for %s in the native database', async (order, change, writer) => {
    const media = await uploadClinicGalleryDraft(
      clinicReqA,
      clinicId,
      {},
      createTinyPngFile(`${slugPrefix}-${order}-${change}-${writer}.png`),
    )
    mediaIds.push(Number(media.id))
    const revision = (await readClinicGallerySnapshot(clinicReqA, clinicId)).snapshot.revision
    const group = await payload.create({
      collection: 'clinicGroups',
      data: { name: `Gallery group ${order}` },
      req: operator,
      overrideAccess: false,
    })
    const staffId = Number(clinicReqA.user!.id)
    await payload.update({
      collection: 'clinics',
      id: clinicId,
      data: { group: group.id },
      req: operator,
      overrideAccess: true,
    })
    await replaceClinicStaffAssignment(operator, staffId, { scope: 'group', groupId: group.id })
    let enter!: () => void
    let release!: () => void
    let opponent!: () => void
    const entered = new Promise<void>((resolve) => {
      enter = resolve
    })
    const released = new Promise<void>((resolve) => {
      release = resolve
    })
    const opposed = new Promise<void>((resolve) => {
      opponent = resolve
    })
    const mediaHooks = payload.collections.clinicMedia.config.hooks
    const staffHooks = payload.collections.clinicStaff.config.hooks
    const controlHooks = payload.collections.clinicNotificationControls.config.hooks
    const previousMedia = mediaHooks.afterChange
    const clinicHooks = payload.collections.clinics.config.hooks
    const previousClinic = clinicHooks.afterChange
    const previousStaff = staffHooks.afterChange
    const previousControl = controlHooks.beforeChange
    const pause = async ({ doc, req }: { doc: unknown; req: PayloadRequest }) => {
      if (req.context.galleryRace === 'first') {
        enter()
        await released
      }
      return doc
    }
    clinicHooks.afterChange = [...(previousClinic ?? []), pause as never]
    mediaHooks.afterChange = [...(previousMedia ?? []), pause as never]
    staffHooks.afterChange = [...(previousStaff ?? []), pause as never]
    controlHooks.beforeChange = [
      ...(previousControl ?? []),
      ({ data, req }) => {
        if (
          req.context.galleryRace === 'second' &&
          data.key ===
            `notification-authorization:${change === 'assignment' ? `staff:${staffId}` : `clinic:${clinicId}`}`
        )
          opponent()
        return data
      },
    ]
    const business = async (position: string) => {
      const req = await createLocalReq(
        { user: clinicReqA.user!, context: { galleryRace: position, clinicGalleryTargetId: String(clinicId) } },
        payload,
      )
      return writer === 'publication'
        ? saveClinicGallery(req, clinicId, {
            expectedRevision: revision,
            items: [{ mediaId: media.id, alt: 'Authorized group gallery image.' }],
          })
        : payload.update({
            collection: 'clinicMedia',
            id: media.id,
            data: { alt: 'Authorized native image.', status: 'published' },
            req,
            overrideAccess: true,
          })
    }
    const revoke = async (position: string) => {
      const req = await createLocalReq({ user: operator.user!, context: { galleryRace: position } }, payload)
      return change === 'assignment'
        ? replaceClinicStaffAssignment(req, staffId, { scope: 'unassigned' })
        : changeClinicGroup(req, clinicId, { fromGroupId: group.id, toGroupId: null })
    }
    const settle = (promise: Promise<unknown>) =>
      promise.then(
        (value) => ({ value, error: undefined }),
        (error: unknown) => ({ value: undefined, error }),
      )
    const first = settle(order === 'business-first' ? business('first') : revoke('first'))
    let second: ReturnType<typeof settle> | undefined
    const wait = async (promise: Promise<void>) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          promise,
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Gallery authorization ordering checkpoint timed out.')), 5000)
          }),
        ])
      } finally {
        clearTimeout(timer)
      }
    }
    try {
      await wait(entered)
      second = settle(order === 'business-first' ? revoke('second') : business('second'))
      await wait(opposed)
      release()
      expect((await first).error).toBeUndefined()
      const secondResult = await second
      if (order === 'access-first') {
        if (writer === 'publication') expect(secondResult.error).toMatchObject({ status: 403 })
        else expect(secondResult.error).toBeDefined()
      } else expect(secondResult.error).toBeUndefined()
      expect(await readClinicTargetAccess(payload, staffId, clinicId)).toBeNull()
      const stored = await payload.findByID({ collection: 'clinicMedia', id: media.id, overrideAccess: true })
      expect(stored.clinic).toBe(clinicId)
      expect(stored.status).toBe(order === 'business-first' ? 'published' : 'draft')
      const gallery = await readClinicGallerySnapshot(operator, clinicId)
      expect(gallery.snapshot.items.some((item) => item.id === media.id)).toBe(
        order === 'business-first' && writer === 'publication',
      )
    } finally {
      release()
      await first
      await second
      mediaHooks.afterChange = previousMedia
      staffHooks.afterChange = previousStaff
      clinicHooks.afterChange = previousClinic
      controlHooks.beforeChange = previousControl
      await replaceClinicStaffAssignment(operator, staffId, { scope: 'local', clinicId })
      if (change === 'assignment')
        await changeClinicGroup(operator, clinicId, { fromGroupId: group.id, toGroupId: null })
      const current = await readClinicGallerySnapshot(operator, clinicId)
      await saveClinicGallery(operator, clinicId, { expectedRevision: current.snapshot.revision, items: [] })
      await payload.delete({ collection: 'clinicGroups', id: group.id, req: operator, overrideAccess: false })
    }
  })
})

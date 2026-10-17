import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import type { Review } from '@/payload-types'
import { clinicDashboardInquiryDetailGetHandler } from '@/endpoints/clinicDashboardInquiries'
import { clinicDashboardReviewGetHandler } from '@/endpoints/clinicDashboardReviews'
import { readClinicInquiryQueue, submitGuestClinicInquiry } from '@/features/inquiryCommunication/service'
import { readClinicReviewPage } from '@/features/clinicDashboard/reviews/operations'
import {
  activateClinicNotificationsForTest,
  readClinicNotifications,
  markClinicNotificationsRead,
} from '@/features/clinicNotifications/service'
import { replaceClinicStaffAssignment } from '@/features/clinicGroups/staffAssignments'
import { changeClinicGroup } from '@/features/clinicGroups/membership'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import {
  asClinicScopedPayloadUser,
  asPayloadStaffUser,
  createClinicTestUser,
  createPlatformTestUser,
  createPatientTestUser,
} from '../fixtures/testUsers'
import { testSlug } from '../fixtures/testSlug'

const identity = vi.hoisted(() => ({ validate: vi.fn() }))
// External Bearer identity is isolated; current principal, clinic rights and receipts use native Payload/Postgres.
vi.mock('@/auth/utilities/jwtValidation', async (original) => ({
  ...(await original<typeof import('@/auth/utilities/jwtValidation')>()),
  validateSupabaseBearerToken: identity.validate,
}))

vi.mock('@payloadcms/storage-s3', () => ({ s3Storage: () => (incomingConfig: unknown) => incomingConfig }))

describe('personal notifications across current clinic assignments', () => {
  let payload: Payload
  let operator: PayloadRequest
  let manager: PayloadRequest
  let local: PayloadRequest
  let network: number
  let foreignGroup: number
  let first: number
  let second: number
  let foreign: number
  let serial = 0
  const doctors = new Map<number, number>()
  const prefix = testSlug('clinicNotifications.personalScope.test.ts')
  const page = async (req = manager, view: 'unread' | 'all' = 'all') => {
    const result = await readClinicNotifications(req, { mode: 'page', view })
    if (result.mode !== 'page' || !('unreadCount' in result))
      throw new Error('Expected initial personal notification page')
    return result
  }
  const createInquiry = async (clinicId: number) =>
    submitGuestClinicInquiry(await createLocalReq({}, payload), {
      clinicId,
      doctorId: doctors.get(clinicId),
      consent: true,
      email: `${prefix}-${++serial}@example.invalid`,
      fullName: `Synthetic source ${serial}`,
      message: 'Synthetic private notification source.',
      phoneNumber: '+493000003237',
    })
  const selectionFor = async (ids: string[]) =>
    (await page()).items
      .filter((item) => item.destination.kind === 'inquiry' && ids.includes(item.destination.inquiryId))
      .flatMap((item) => item.members.map((member) => member.notificationId))

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    operator = await createLocalReq(
      { user: asPayloadStaffUser(await createPlatformTestUser(payload, { emailPrefix: prefix })) },
      payload,
    )
    network = (
      await payload.create({
        collection: 'clinicGroups',
        data: { name: 'Notification network' },
        req: operator,
        overrideAccess: false,
      })
    ).id
    foreignGroup = (
      await payload.create({
        collection: 'clinicGroups',
        data: { name: 'Foreign network' },
        req: operator,
        overrideAccess: false,
      })
    ).id
    const city = (await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })).docs[0]!
    const clinic = async (name: string, group: number) => {
      const fixture = await createClinicFixture(payload, city.id, { slugPrefix: `${prefix}-${name}` })
      doctors.set(fixture.clinic.id, fixture.doctor.id)
      return (
        await payload.update({
          collection: 'clinics',
          id: fixture.clinic.id,
          data: { name, participationStatus: 'approved', group },
          req: operator,
          overrideAccess: true,
          depth: 0,
        })
      ).id
    }
    first = await clinic('Alpha source', network)
    second = await clinic('Beta source', network)
    foreign = await clinic('Foreign source', foreignGroup)
    const managerStaff = await createClinicTestUser(payload, { emailPrefix: `${prefix}-manager` })
    manager = await createLocalReq({ user: await asClinicScopedPayloadUser(payload, managerStaff, first) }, payload)
    await replaceClinicStaffAssignment(operator, Number(manager.user!.id), { scope: 'group', groupId: network })
    const localStaff = await createClinicTestUser(payload, { emailPrefix: `${prefix}-local` })
    local = await createLocalReq({ user: await asClinicScopedPayloadUser(payload, localStaff, first) }, payload)
    await activateClinicNotificationsForTest(await createLocalReq({}, payload))
  }, 60_000)

  afterAll(async () => {
    await payload?.db.destroy?.()
  })

  it('projects only the current local/group union with current source clinic names and keeps storage private', async () => {
    const a = await createInquiry(first)
    const b = await createInquiry(second)
    const excluded = await createInquiry(foreign)
    const feed = await page()
    expect(feed.unreadCount).toBe(2)
    expect(feed.items.map((item) => item.clinic)).toEqual([
      { id: String(second), name: 'Beta source' },
      { id: String(first), name: 'Alpha source' },
    ])
    expect(
      feed.items.map((item) => (item.destination.kind === 'inquiry' ? item.destination.inquiryId : null)),
    ).not.toContain(excluded.id)
    expect((await page(local)).items.map((item) => item.clinic.id)).toEqual([String(first)])
    await payload.update({
      collection: 'clinics',
      id: first,
      data: { name: 'Alpha renamed' },
      req: operator,
      overrideAccess: true,
    })
    expect((await page()).items.find((item) => item.clinic.id === String(first))?.clinic.name).toBe('Alpha renamed')
    expect(await selectionFor([a.id, b.id])).toHaveLength(2)
    await expect(
      payload.find({ collection: 'clinicNotificationOccurrences', req: manager, overrideAccess: false }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload.find({ collection: 'clinicNotificationReadReceipts', req: manager, overrideAccess: false }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('atomically marks a fixed cross-clinic selection and preserves first-read receipts through reassignment', async () => {
    const selected = (await page()).items.flatMap((item) => item.members.map((member) => member.notificationId))
    const beforeLocal = await page(local)
    await markClinicNotificationsRead(manager, { notificationIds: [...selected, 'missing-notification'] })
    const firstRead = await page()
    expect(firstRead.unreadCount).toBe(0)
    expect(firstRead.items.every((item) => item.members[0]!.readAt !== null)).toBe(true)
    await markClinicNotificationsRead(manager, { notificationIds: selected })
    expect((await page()).items).toEqual(firstRead.items)
    expect((await page(local)).items).toEqual(beforeLocal.items)
    await replaceClinicStaffAssignment(operator, Number(manager.user!.id), { scope: 'local', clinicId: second })
    expect((await page()).items.map((item) => item.clinic.id)).toEqual([String(second)])
    await replaceClinicStaffAssignment(operator, Number(manager.user!.id), { scope: 'group', groupId: network })
    expect((await page()).items).toEqual(firstRead.items)
    await replaceClinicStaffAssignment(operator, Number(manager.user!.id), { scope: 'unassigned' })
    expect(await page()).toMatchObject({ items: [], unreadCount: 0 })
    await expect(markClinicNotificationsRead(manager, { notificationIds: selected })).rejects.toMatchObject({
      code: 'CLINIC_ACCESS_DENIED',
      writeOutcome: 'not_committed',
    })
    await replaceClinicStaffAssignment(operator, Number(manager.user!.id), { scope: 'group', groupId: network })
  })

  it('rolls back the complete cross-clinic selection when the second eligible receipt cannot be stored', async () => {
    const selected = await selectionFor([(await createInquiry(first)).id, (await createInquiry(second)).id])
    const hooks = payload.collections.clinicNotificationReadReceipts.config.hooks
    const previous = hooks.beforeChange
    let writes = 0
    hooks.beforeChange = [
      ...(previous ?? []),
      (args) => {
        if (args.req.context.personalSelectionFailure && ++writes === 2)
          throw new Error('Synthetic second-clinic receipt failure')
        return args.data
      },
    ]
    try {
      const req = await createLocalReq({ user: manager.user!, context: { personalSelectionFailure: true } }, payload)
      await expect(markClinicNotificationsRead(req, { notificationIds: selected })).rejects.toMatchObject({
        writeOutcome: 'not_committed',
      })
      expect(writes).toBe(2)
    } finally {
      hooks.beforeChange = previous
    }
    const stillUnread = (await page(manager, 'unread')).items.flatMap((item) =>
      item.members.map((member) => member.notificationId),
    )
    expect(stillUnread).toEqual(expect.arrayContaining(selected))
  })

  it.each(['receipt-first', 'membership-first'] as const)(
    'orders %s against a clinic leaving the group without partial or stale receipts',
    async (order) => {
      const selected = await selectionFor([(await createInquiry(first)).id, (await createInquiry(second)).id])
      let enter!: () => void
      let release!: () => void
      let contender!: () => void
      const paused = new Promise<void>((resolve) => {
        enter = resolve
      })
      const released = new Promise<void>((resolve) => {
        release = resolve
      })
      const contended = new Promise<void>((resolve) => {
        contender = resolve
      })
      const wait = async (promise: Promise<void>) => {
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
          await Promise.race([
            promise,
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error('Notification scope ordering checkpoint timed out.')), 5000)
            }),
          ])
        } finally {
          clearTimeout(timer)
        }
      }
      const receipts = payload.collections.clinicNotificationReadReceipts.config.hooks
      const clinics = payload.collections.clinics.config.hooks
      const controls = payload.collections.clinicNotificationControls.config.hooks
      const previousReceipt = receipts.afterChange
      const previousClinic = clinics.afterChange
      const previousControl = controls.beforeChange
      const pause = async ({ doc, req }: { doc: unknown; req: PayloadRequest }) => {
        if (req.context.personalNotificationRace === 'first') {
          enter()
          await released
        }
        return doc
      }
      receipts.afterChange = [...(previousReceipt ?? []), pause]
      clinics.afterChange = [...(previousClinic ?? []), pause]
      controls.beforeChange = [
        ...(previousControl ?? []),
        ({ data, req }) => {
          if (
            req.context.personalNotificationRace === 'second' &&
            data.key === `notification-authorization:clinic:${first}`
          )
            contender()
          return data
        },
      ]
      const marking = async (position: string) =>
        markClinicNotificationsRead(
          await createLocalReq({ user: manager.user!, context: { personalNotificationRace: position } }, payload),
          { notificationIds: selected },
        )
      const moving = async (position: string) =>
        changeClinicGroup(
          await createLocalReq({ user: operator.user!, context: { personalNotificationRace: position } }, payload),
          first,
          { fromGroupId: network, toGroupId: foreignGroup },
        )
      const settle = (promise: Promise<unknown>) =>
        promise.then(
          (value) => ({ value, error: undefined }),
          (error: unknown) => ({ value: undefined, error }),
        )
      const firstOperation = settle(order === 'receipt-first' ? marking('first') : moving('first'))
      let secondOperation: ReturnType<typeof settle> | undefined
      try {
        await wait(paused)
        secondOperation = settle(order === 'receipt-first' ? moving('second') : marking('second'))
        await wait(contended)
        release()
        expect((await firstOperation).error).toBeUndefined()
        const outcome = await secondOperation
        if (order === 'membership-first') expect(outcome.error).toMatchObject({ writeOutcome: 'not_committed' })
        else expect(outcome.error).toBeUndefined()
        expect((await page(local)).items.some((item) => item.clinic.id === String(first))).toBe(true)
        expect((await page()).items.every((item) => item.clinic.id === String(second))).toBe(true)
        if (order === 'membership-first') await markClinicNotificationsRead(manager, { notificationIds: selected })
      } finally {
        release()
        await firstOperation
        await secondOperation
        receipts.afterChange = previousReceipt
        clinics.afterChange = previousClinic
        controls.beforeChange = previousControl
        const current = await payload.findByID({ collection: 'clinics', id: first, depth: 0, overrideAccess: true })
        if (current.group === foreignGroup)
          await changeClinicGroup(operator, first, { fromGroupId: foreignGroup, toGroupId: network })
      }
      const returned = (await page()).items
        .flatMap((item) => item.members)
        .filter((member) => selected.includes(member.notificationId))
      expect(returned).toHaveLength(2)
      expect(returned.filter((member) => member.readAt === null)).toHaveLength(order === 'receipt-first' ? 0 : 1)
    },
  )

  it.each(['inquiry', 'review'] as const)(
    'opens an exact cross-clinic %s independently, then rechecks current rights for its separate fixed receipt',
    async (kind) => {
      const createSource = async (clinicId: number) => {
        if (kind === 'inquiry') return (await createInquiry(clinicId)).id
        const patient = await createPatientTestUser(payload, { emailPrefix: `${prefix}-exact-${++serial}` })
        const treatment = (await payload.find({ collection: 'treatments', limit: 1, overrideAccess: true })).docs[0]!
        const source = await payload.create({
          collection: 'reviews',
          req: operator,
          overrideAccess: false,
          depth: 0,
          data: {
            patient: patient.id,
            clinic: clinicId,
            doctor: doctors.get(clinicId)!,
            treatment: treatment.id,
            status: 'approved',
            starRating: 5,
            comment: 'Synthetic exact notification target.',
            authorVisibility: 'anonymous',
          } as Review,
        })
        return String(source.id)
      }
      const exactId = await createSource(second)
      const foreignId = await createSource(foreign)
      const fixed = (await page()).items.find(
        (item) => item.destination.kind === kind && item.members.some((member) => member.sourceRecord.id === exactId),
      )!
      expect(fixed.clinic.id).toBe(String(second))
      const selection = fixed.members.map((member) => member.notificationId)
      const personalPrincipal = manager.user
      if (personalPrincipal?.collection !== 'clinicStaff' || !personalPrincipal.supabaseUserId?.trim())
        throw new Error('Expected a clinic staff personal identity')
      const personalBearer = randomUUID()
      const foreignBearer = randomUUID()
      const foreignSubject = randomUUID()
      identity.validate.mockImplementation(async ({ token }: { token: string }) =>
        token === personalBearer || token === foreignBearer
          ? {
              status: 'authenticated',
              authData: {
                userType: 'clinic',
                supabaseUserId: token === personalBearer ? personalPrincipal.supabaseUserId : foreignSubject,
              },
            }
          : { status: 'invalid' },
      )
      const detail = async (clinicId: number, recordId: string, bearer: string | null = personalBearer) => {
        const request = await createLocalReq(
          {
            user: personalPrincipal,
            req: {
              headers: new Headers({
                ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
                'X-Findmydoc-Clinic-Scope-Contract': 'clinic-scope-v1',
                'X-Findmydoc-Clinic-Dashboard-Contract': 'inquiry-communication-v2',
              }),
              routeParams: { clinicId: String(clinicId), id: recordId },
            },
          },
          payload,
        )
        Object.defineProperty(request, 'url', {
          configurable: true,
          value:
            kind === 'inquiry' ? `http://localhost:3000/detail?inquiryId=${recordId}` : 'http://localhost:3000/detail',
        })
        return kind === 'inquiry'
          ? clinicDashboardInquiryDetailGetHandler(request)
          : clinicDashboardReviewGetHandler(request)
      }
      const filteredRequest = await createLocalReq(
        { user: manager.user!, context: { inquiryClinicTargetId: String(second) } },
        payload,
      )
      if (kind === 'inquiry') {
        const filtered = await readClinicInquiryQueue(filteredRequest, {
          lifecycle: 'open',
          limit: 25,
          unreadOnly: false,
          query: 'No matching exact synthetic patient',
        })
        expect(filtered.items.map((item) => item.id)).not.toContain(exactId)
      } else {
        Object.defineProperty(filteredRequest, 'url', {
          value: 'http://localhost:3000/reviews?where[starRating][equals]=1',
        })
        const filtered = await readClinicReviewPage(filteredRequest, String(second))
        expect(filtered.docs.map((item) => item.id)).not.toContain(exactId)
      }
      // A local Payload user never substitutes for the endpoint's independently verified personal identity.
      for (const bearer of [null, foreignBearer]) {
        const denied = await detail(second, exactId, bearer)
        expect(denied.status).toBe(401)
        expect(denied.headers.get('Cache-Control')).toContain('no-store')
      }
      const opened = await detail(second, exactId)
      expect(opened.status).toBe(200)
      expect(opened.headers.get('Cache-Control')).toContain('no-store')
      const body = await opened.json()
      expect(kind === 'inquiry' ? body.inquiry.id : body.data.id).toBe(exactId)
      // Browser selection and an authorized fetch do not create notification receipts.
      expect(
        (await page()).items
          .find((item) => item.presentationId === fixed.presentationId)
          ?.members.every((member) => member.readAt === null),
      ).toBe(true)
      expect((await detail(first, exactId)).status).toBe(404)
      expect((await detail(second, foreignId)).status).toBe(404)
      expect((await detail(second, '999999999')).status).toBe(404)
      await replaceClinicStaffAssignment(operator, Number(manager.user!.id), { scope: 'local', clinicId: first })
      try {
        expect((await detail(second, exactId)).status).toBe(403)
        await expect(markClinicNotificationsRead(manager, { notificationIds: selection })).rejects.toMatchObject({
          writeOutcome: 'not_committed',
        })
      } finally {
        await replaceClinicStaffAssignment(operator, Number(manager.user!.id), { scope: 'group', groupId: network })
      }
      expect(
        (await page()).items
          .find((item) => item.presentationId === fixed.presentationId)
          ?.members.every((member) => member.readAt === null),
      ).toBe(true)
      await markClinicNotificationsRead(manager, { notificationIds: selection })
      expect(
        (await page()).items
          .find((item) => item.presentationId === fixed.presentationId)
          ?.members.every((member) => member.readAt !== null),
      ).toBe(true)
    },
  )
})

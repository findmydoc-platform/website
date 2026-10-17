import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import type { Review, ReviewAppeal, ReviewResponse } from '@/payload-types'
import { readClinicReviewDetail } from '@/features/clinicDashboard/reviews/service'
import {
  readClinicReviewPage,
  readClinicReviewWorkflows,
  readClinicReviewWorkflowVersions,
  createClinicReviewWorkflow,
  updateClinicReviewResponse,
} from '@/features/clinicDashboard/reviews/operations'
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
vi.mock('@payloadcms/storage-s3', () => ({ s3Storage: () => (incomingConfig: unknown) => incomingConfig }))

describe('current clinic review source and native workflow authorization', () => {
  let payload: Payload
  let operator: PayloadRequest
  let manager: PayloadRequest
  let local: PayloadRequest
  let group: number
  let foreignGroup: number
  let first: number
  let second: number
  let foreign: number
  let treatment: number
  let serial = 0
  const doctors = new Map<number, number>()
  const prefix = testSlug('clinicDashboard.reviewsScope.test.ts')
  const req = async (clinicId: number, query = '', context?: Record<string, unknown>) => {
    const value = await createLocalReq({ user: manager.user!, context }, payload)
    value.routeParams = { clinicId: String(clinicId) }
    Object.defineProperty(value, 'url', { value: `http://localhost:3000/reviews${query}`, configurable: true })
    return value
  }
  const review = async (clinicId: number) => {
    const patient = await createPatientTestUser(payload, { emailPrefix: `${prefix}-${++serial}` })
    return payload.create({
      collection: 'reviews',
      overrideAccess: false,
      req: await createLocalReq({ user: operator.user! }, payload),
      depth: 0,
      data: {
        patient: patient.id,
        clinic: clinicId,
        doctor: doctors.get(clinicId)!,
        treatment,
        status: 'approved',
        starRating: 5,
        comment: 'Synthetic clinic-scoped public review.',
        authorVisibility: 'anonymous',
      } as Review,
    })
  }
  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    operator = await createLocalReq(
      { user: asPayloadStaffUser(await createPlatformTestUser(payload, { emailPrefix: prefix })) },
      payload,
    )
    group = (
      await payload.create({
        collection: 'clinicGroups',
        req: operator,
        overrideAccess: false,
        data: { name: 'Review network' },
      })
    ).id
    foreignGroup = (
      await payload.create({
        collection: 'clinicGroups',
        req: operator,
        overrideAccess: false,
        data: { name: 'Foreign review network' },
      })
    ).id
    const city = (await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })).docs[0]!.id
    treatment = (await payload.find({ collection: 'treatments', limit: 1, overrideAccess: true })).docs[0]!.id
    const clinic = async (name: string, network: number) => {
      const fixture = await createClinicFixture(payload, city, { slugPrefix: `${prefix}-${name}` })
      doctors.set(fixture.clinic.id, fixture.doctor.id)
      return (
        await payload.update({
          collection: 'clinics',
          id: fixture.clinic.id,
          req: operator,
          overrideAccess: true,
          depth: 0,
          data: { name, group: network, participationStatus: 'approved' },
        })
      ).id
    }
    first = await clinic('First review clinic', group)
    second = await clinic('Second review clinic', group)
    foreign = await clinic('Foreign review clinic', foreignGroup)
    manager = await createLocalReq(
      {
        user: await asClinicScopedPayloadUser(
          payload,
          await createClinicTestUser(payload, { emailPrefix: `${prefix}-manager` }),
          first,
        ),
      },
      payload,
    )
    await replaceClinicStaffAssignment(operator, Number(manager.user!.id), { scope: 'group', groupId: group })
    local = await createLocalReq(
      {
        user: await asClinicScopedPayloadUser(
          payload,
          await createClinicTestUser(payload, { emailPrefix: `${prefix}-local` }),
          first,
        ),
      },
      payload,
    )
  }, 60000)
  afterAll(async () => {
    await payload?.db.destroy?.()
  })
  it('intersects current group and local access with exact source ownership independently of list filters', async () => {
    const a = await review(first)
    const b = await review(second)
    const excluded = await review(foreign)
    const page = await readClinicReviewPage(
      await req(second, '?depth=1&limit=10&page=1&sort=-reviewDate'),
      String(second),
    )
    expect(page.docs.map(({ id }) => id)).toContain(String(b.id))
    expect(page.docs.map(({ id }) => id)).not.toContain(String(a.id))
    expect(page.docs.map(({ id }) => id)).not.toContain(String(excluded.id))
    expect(await readClinicReviewDetail(await req(second), String(b.id), String(second))).toMatchObject({
      id: String(b.id),
    })
    expect(await readClinicReviewDetail(await req(first), String(b.id), String(first))).toBeNull()
    expect(await readClinicReviewDetail(local, String(b.id), String(second))).toBeNull()
    await expect(readClinicReviewPage(await req(foreign), String(foreign))).rejects.toMatchObject({ status: 403 })
  })
  it('creates and revises only own current response and appeal workflows with native versions', async () => {
    const source = await review(second)
    const target = await req(second)
    const response = await createClinicReviewWorkflow(target, String(second), 'reviewResponses', {
      review: source.id,
      pendingResponse: { body: 'Synthetic first clinic response.' },
    })
    expect(response.doc).toMatchObject({ review: String(source.id), moderationStatus: 'pending' })
    await updateClinicReviewResponse(await req(second), String(second), response.doc.id, {
      pendingResponse: { body: 'Synthetic revised clinic response.' },
    })
    const appeal = await createClinicReviewWorkflow(await req(second), String(second), 'reviewAppeals', {
      review: source.id,
      reason: 'other',
      details: 'Synthetic specific review objection.',
    })
    expect(appeal.doc).toMatchObject({ review: String(source.id), status: 'submitted' })
    const flows = await readClinicReviewWorkflows(
      await req(second, `?depth=0&limit=1&pagination=false&where[review][in]=${source.id}`),
      String(second),
      'reviewResponses',
    )
    expect(flows.docs[0]).toMatchObject({ pendingResponse: { body: 'Synthetic revised clinic response.' } })
    const versions = await readClinicReviewWorkflowVersions(
      await req(
        second,
        `?depth=0&limit=1000&pagination=false&sort=-createdAt&where[version.review][equals]=${source.id}`,
      ),
      String(second),
      'reviewResponses',
    )
    expect(versions.docs.length).toBeGreaterThanOrEqual(2)
    await expect(
      updateClinicReviewResponse(await req(first), String(first), response.doc.id, {
        pendingResponse: { body: 'Foreign workflow must remain unchanged.' },
      }),
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      payload.create({
        collection: 'reviewAppeals',
        req: await req(first),
        overrideAccess: false,
        data: { review: source.id, reason: 'other', details: 'Wrong explicit clinic target.' } as ReviewAppeal,
      }),
    ).rejects.toMatchObject({ status: 403 })
  })
  it('denies stale browser selection and native writes after current group assignment is removed', async () => {
    const source = await review(second)
    await replaceClinicStaffAssignment(operator, Number(manager.user!.id), { scope: 'local', clinicId: first })
    try {
      expect(await readClinicReviewDetail(await req(second), String(source.id), String(second))).toBeNull()
      await expect(
        payload.create({
          collection: 'reviewResponses',
          overrideAccess: false,
          req: await req(second),
          data: { review: source.id, pendingResponse: { body: 'A stale selected-clinic response.' } } as ReviewResponse,
        }),
      ).rejects.toMatchObject({ status: 403 })
    } finally {
      await replaceClinicStaffAssignment(operator, Number(manager.user!.id), { scope: 'group', groupId: group })
    }
  })
  it.each([
    { collection: 'reviewResponses', order: 'workflow-first' },
    { collection: 'reviewResponses', order: 'membership-first' },
    { collection: 'reviewAppeals', order: 'workflow-first' },
    { collection: 'reviewAppeals', order: 'membership-first' },
  ] as const)(
    'serializes $collection $order at the actual clinic barrier through native commit',
    async ({ collection, order }) => {
      const source = await review(first)
      let enter!: () => void
      let release!: () => void
      let contender!: () => void
      const paused = new Promise<void>((r) => {
        enter = r
      })
      const released = new Promise<void>((r) => {
        release = r
      })
      const contended = new Promise<void>((r) => {
        contender = r
      })
      const wait = async (promise: Promise<void>) => {
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
          await Promise.race([
            promise,
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error('Review ordering checkpoint timed out.')), 5000)
            }),
          ])
        } finally {
          clearTimeout(timer)
        }
      }
      const responses = payload.collections[collection].config.hooks
      const clinics = payload.collections.clinics.config.hooks
      const controls = payload.collections.clinicNotificationControls.config.hooks
      const previousResponse = responses.afterChange
      const previousClinic = clinics.afterChange
      const previousControl = controls.beforeChange
      const pause = async ({ doc, req }: { doc: unknown; req: PayloadRequest }) => {
        if (req.context.reviewScopeRace === 'first') {
          enter()
          await released
        }
        return doc
      }
      responses.afterChange = [...(previousResponse ?? []), pause]
      clinics.afterChange = [...(previousClinic ?? []), pause]
      controls.beforeChange = [
        ...(previousControl ?? []),
        ({ data, req }) => {
          if (req.context.reviewScopeRace === 'second' && data.key === `notification-authorization:clinic:${first}`)
            contender()
          return data
        },
      ]
      const writing = async (position: string) =>
        payload.create({
          collection,
          overrideAccess: false,
          req: await req(first, '', { reviewScopeRace: position }),
          data: (collection === 'reviewResponses'
            ? {
                review: source.id,
                pendingResponse: { body: 'Synthetic ordered clinic response.' },
              }
            : { review: source.id, reason: 'other', details: 'Synthetic ordered review objection.' }) as never,
        })
      const moving = async (position: string) =>
        changeClinicGroup(
          await createLocalReq({ user: operator.user!, context: { reviewScopeRace: position } }, payload),
          first,
          { fromGroupId: group, toGroupId: foreignGroup },
        )
      const settle = (promise: Promise<unknown>) =>
        promise.then(
          (value) => ({ value, error: undefined }),
          (error: unknown) => ({ value: undefined, error }),
        )
      const leading = settle(order === 'workflow-first' ? writing('first') : moving('first'))
      let trailing: ReturnType<typeof settle> | undefined
      try {
        await wait(paused)
        trailing = settle(order === 'workflow-first' ? moving('second') : writing('second'))
        await wait(contended)
        release()
        expect((await leading).error).toBeUndefined()
        const result = await trailing
        if (order === 'membership-first') expect(result.error).toMatchObject({ status: 403 })
        else expect(result.error).toBeUndefined()
        const persisted = await payload.find({
          collection,
          overrideAccess: true,
          where: { review: { equals: source.id } },
        })
        expect(persisted.totalDocs).toBe(order === 'workflow-first' ? 1 : 0)
      } finally {
        release()
        await leading
        await trailing
        responses.afterChange = previousResponse
        clinics.afterChange = previousClinic
        controls.beforeChange = previousControl
        const current = await payload.findByID({ collection: 'clinics', id: first, overrideAccess: true, depth: 0 })
        if (current.group === foreignGroup)
          await changeClinicGroup(operator, first, { fromGroupId: foreignGroup, toGroupId: group })
      }
    },
  )
})

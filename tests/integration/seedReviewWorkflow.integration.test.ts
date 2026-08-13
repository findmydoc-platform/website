import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'

import { projectPublicReviewText } from '@/collections/reviews/publicProjection'
import { runDemoSeeds } from '@/endpoints/seed/demo/run-demo'
import type { Review, ReviewAppeal, ReviewResponse } from '@/payload-types'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import {
  asClinicScopedPayloadUser,
  asPayloadStaffUser,
  cleanupTrackedUsers,
  createClinicTestUser,
} from '../fixtures/testUsers'
import { cleanupTrackedDocs } from '../fixtures/cleanupTrackedDocs'
import { testSlug } from '../fixtures/testSlug'

const CENTRAL_CLINIC_STABLE_ID = 'seed-clinic-izmir-coast'
const CENTRAL_REVIEW_IDS = [
  'seed-review-10',
  'seed-review-11',
  'seed-review-izmir-coast-03',
  'seed-review-izmir-coast-04',
  'seed-review-izmir-coast-05',
  'seed-review-izmir-coast-06',
  'seed-review-izmir-coast-07',
  'seed-review-izmir-coast-08',
  'seed-review-izmir-coast-09',
  'seed-review-izmir-coast-10',
] as const
const CENTRAL_APPROVED_REVIEW_IDS = CENTRAL_REVIEW_IDS.filter(
  (stableId) => stableId !== 'seed-review-10' && stableId !== 'seed-review-11',
)
const CENTRAL_PUBLIC_REVIEW_IDS = [
  'seed-review-izmir-coast-03',
  'seed-review-izmir-coast-04',
  'seed-review-izmir-coast-05',
  'seed-review-izmir-coast-06',
  'seed-review-izmir-coast-09',
  'seed-review-izmir-coast-10',
] as const
const CENTRAL_RESPONSE_IDS = [
  'seed-review-response-izmir-coast-03',
  'seed-review-response-izmir-coast-04',
  'seed-review-response-izmir-coast-05',
  'seed-review-response-izmir-coast-06',
  'seed-review-response-izmir-coast-08',
  'seed-review-response-izmir-coast-09',
] as const
const CENTRAL_PUBLIC_RESPONSE_IDS = [
  'seed-review-response-izmir-coast-03',
  'seed-review-response-izmir-coast-04',
  'seed-review-response-izmir-coast-05',
] as const
const CENTRAL_APPEAL_IDS = [
  'seed-review-appeal-izmir-coast-03',
  'seed-review-appeal-izmir-coast-04',
  'seed-review-appeal-izmir-coast-05',
  'seed-review-appeal-izmir-coast-09',
  'seed-review-appeal-izmir-coast-10',
] as const

type WorkflowHistorySnapshot = {
  appeal03: Array<Pick<ReviewAppeal, 'status' | 'decidedAt'>>
  appeal05: Array<Pick<ReviewAppeal, 'status' | 'decidedAt'>>
  appealStates: Array<Pick<ReviewAppeal, 'stableId' | 'status'>>
  centralAppealVersions: Record<string, ReviewAppeal[]>
  centralAppeals: Array<Pick<ReviewAppeal, 'stableId' | 'status'>>
  centralResponseVersions: Record<string, ReviewResponse[]>
  centralResponses: Array<Pick<ReviewResponse, 'stableId' | 'moderationStatus'>>
  centralReviewVersions: Record<string, Review[]>
  centralReviews: Array<Pick<Review, 'stableId' | 'status' | 'publicMeasure' | 'withdrawalState'>>
  coast05Appeal: Array<Pick<ReviewAppeal, 'status' | 'decidedAt'>>
  coast05Review: Array<Pick<Review, 'publicMeasure' | 'moderatedAt' | 'withdrawalState'>>
  coast08Review: Array<Pick<Review, 'publicMeasure' | 'withdrawnAt' | 'withdrawalState' | 'comment' | 'starRating'>>
  coast09Appeal: Array<Pick<ReviewAppeal, 'status' | 'decidedAt'>>
  coast09Review: Array<Pick<Review, 'publicMeasure' | 'moderatedAt' | 'status' | 'withdrawalState'>>
  responseStates: Array<Pick<ReviewResponse, 'stableId' | 'moderationStatus'>>
  reviewMeasures: Array<Pick<Review, 'stableId' | 'publicMeasure'>>
  review06: Array<Pick<Review, 'publicMeasure' | 'moderatedAt' | 'withdrawalState'>>
  review08: Array<Pick<Review, 'publicMeasure' | 'moderatedAt' | 'withdrawalState'>>
  review09: Array<Pick<Review, 'publicMeasure' | 'withdrawnAt' | 'withdrawalState'>>
}

const relationId = (value: unknown): string | number | null => {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    return relationId((value as { id?: unknown }).id)
  }
  return null
}

const stableIds = <T extends { stableId?: string | null }>(docs: T[]): string[] =>
  docs.map(({ stableId }) => String(stableId)).sort()

const cleanupSeedReviewWorkflow = async (payload: Payload): Promise<void> => {
  const tasks = await Promise.all(
    (['reviewAppeals', 'reviewResponses', 'reviews'] as const).map(async (collection) => {
      const result = await payload.find({
        collection,
        depth: 0,
        overrideAccess: true,
        pagination: false,
        where: { stableId: { like: 'seed-review-' } },
      })

      return { collection, ids: result.docs.map(({ id }) => id) }
    }),
  )

  await cleanupTrackedDocs(payload, tasks)
}

const findSeedId = async (
  payload: Payload,
  collection: 'reviewAppeals' | 'reviewResponses' | 'reviews',
  stableId: string,
): Promise<string | number> => {
  const result = await payload.find({
    collection,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { stableId: { equals: stableId } },
  })
  const doc = result.docs[0]
  if (!doc) throw new Error(`Missing ${collection}:${stableId}`)
  return doc.id
}

const readCentralReviewVersions = async (payload: Payload, docs: Review[]): Promise<Record<string, Review[]>> =>
  Object.fromEntries(
    await Promise.all(
      docs.map(async (review) => {
        const versions = await payload.findVersions({
          collection: 'reviews',
          depth: 0,
          overrideAccess: true,
          pagination: false,
          where: { parent: { equals: review.id } },
        })

        return [String(review.stableId), versions.docs.map(({ version }) => version)]
      }),
    ),
  )

const readCentralResponseVersions = async (
  payload: Payload,
  docs: ReviewResponse[],
): Promise<Record<string, ReviewResponse[]>> =>
  Object.fromEntries(
    await Promise.all(
      docs.map(async (response) => {
        const versions = await payload.findVersions({
          collection: 'reviewResponses',
          depth: 0,
          overrideAccess: true,
          pagination: false,
          where: { parent: { equals: response.id } },
        })

        return [String(response.stableId), versions.docs.map(({ version }) => version)]
      }),
    ),
  )

const readCentralAppealVersions = async (
  payload: Payload,
  docs: ReviewAppeal[],
): Promise<Record<string, ReviewAppeal[]>> =>
  Object.fromEntries(
    await Promise.all(
      docs.map(async (appeal) => {
        const versions = await payload.findVersions({
          collection: 'reviewAppeals',
          depth: 0,
          overrideAccess: true,
          pagination: false,
          where: { parent: { equals: appeal.id } },
        })

        return [String(appeal.stableId), versions.docs.map(({ version }) => version)]
      }),
    ),
  )

const readWorkflowHistory = async (payload: Payload): Promise<WorkflowHistorySnapshot> => {
  const [
    review06Id,
    review08Id,
    review09Id,
    coast05ReviewId,
    coast08ReviewId,
    coast09ReviewId,
    appeal03Id,
    appeal05Id,
    coast05AppealId,
    coast09AppealId,
    responseStates,
    appealStates,
    reviewMeasures,
    centralReviews,
    centralResponses,
    centralAppeals,
  ] = await Promise.all([
    findSeedId(payload, 'reviews', 'seed-review-06'),
    findSeedId(payload, 'reviews', 'seed-review-08'),
    findSeedId(payload, 'reviews', 'seed-review-09'),
    findSeedId(payload, 'reviews', 'seed-review-izmir-coast-05'),
    findSeedId(payload, 'reviews', 'seed-review-izmir-coast-08'),
    findSeedId(payload, 'reviews', 'seed-review-izmir-coast-09'),
    findSeedId(payload, 'reviewAppeals', 'seed-review-appeal-03'),
    findSeedId(payload, 'reviewAppeals', 'seed-review-appeal-05'),
    findSeedId(payload, 'reviewAppeals', 'seed-review-appeal-izmir-coast-05'),
    findSeedId(payload, 'reviewAppeals', 'seed-review-appeal-izmir-coast-09'),
    payload.find({
      collection: 'reviewResponses',
      depth: 0,
      overrideAccess: true,
      pagination: false,
      sort: 'stableId',
      where: { stableId: { like: 'seed-review-response-' } },
    }),
    payload.find({
      collection: 'reviewAppeals',
      depth: 0,
      overrideAccess: true,
      pagination: false,
      sort: 'stableId',
      where: { stableId: { like: 'seed-review-appeal-' } },
    }),
    payload.find({
      collection: 'reviews',
      depth: 0,
      overrideAccess: true,
      pagination: false,
      sort: 'stableId',
      where: { stableId: { like: 'seed-review-' } },
    }),
    payload.find({
      collection: 'reviews',
      depth: 0,
      overrideAccess: true,
      pagination: false,
      sort: 'stableId',
      where: { stableId: { in: [...CENTRAL_REVIEW_IDS] } },
    }),
    payload.find({
      collection: 'reviewResponses',
      depth: 0,
      overrideAccess: true,
      pagination: false,
      sort: 'stableId',
      where: { stableId: { in: [...CENTRAL_RESPONSE_IDS] } },
    }),
    payload.find({
      collection: 'reviewAppeals',
      depth: 0,
      overrideAccess: true,
      pagination: false,
      sort: 'stableId',
      where: { stableId: { in: [...CENTRAL_APPEAL_IDS] } },
    }),
  ])

  const [
    review06,
    review08,
    review09,
    coast05Review,
    coast08Review,
    coast09Review,
    appeal03,
    appeal05,
    coast05Appeal,
    coast09Appeal,
    centralReviewVersions,
    centralResponseVersions,
    centralAppealVersions,
  ] = await Promise.all([
    payload.findVersions({
      collection: 'reviews',
      depth: 0,
      overrideAccess: true,
      pagination: false,
      where: { parent: { equals: review06Id } },
    }),
    payload.findVersions({
      collection: 'reviews',
      depth: 0,
      overrideAccess: true,
      pagination: false,
      where: { parent: { equals: review08Id } },
    }),
    payload.findVersions({
      collection: 'reviews',
      depth: 0,
      overrideAccess: true,
      pagination: false,
      where: { parent: { equals: review09Id } },
    }),
    payload.findVersions({
      collection: 'reviews',
      depth: 0,
      overrideAccess: true,
      pagination: false,
      where: { parent: { equals: coast05ReviewId } },
    }),
    payload.findVersions({
      collection: 'reviews',
      depth: 0,
      overrideAccess: true,
      pagination: false,
      where: { parent: { equals: coast08ReviewId } },
    }),
    payload.findVersions({
      collection: 'reviews',
      depth: 0,
      overrideAccess: true,
      pagination: false,
      where: { parent: { equals: coast09ReviewId } },
    }),
    payload.findVersions({
      collection: 'reviewAppeals',
      depth: 0,
      overrideAccess: true,
      pagination: false,
      where: { parent: { equals: appeal03Id } },
    }),
    payload.findVersions({
      collection: 'reviewAppeals',
      depth: 0,
      overrideAccess: true,
      pagination: false,
      where: { parent: { equals: appeal05Id } },
    }),
    payload.findVersions({
      collection: 'reviewAppeals',
      depth: 0,
      overrideAccess: true,
      pagination: false,
      where: { parent: { equals: coast05AppealId } },
    }),
    payload.findVersions({
      collection: 'reviewAppeals',
      depth: 0,
      overrideAccess: true,
      pagination: false,
      where: { parent: { equals: coast09AppealId } },
    }),
    readCentralReviewVersions(payload, centralReviews.docs),
    readCentralResponseVersions(payload, centralResponses.docs),
    readCentralAppealVersions(payload, centralAppeals.docs),
  ])

  return {
    review06: review06.docs.map(({ version }) => ({
      publicMeasure: version.publicMeasure,
      moderatedAt: version.moderatedAt,
      withdrawalState: version.withdrawalState,
    })),
    review08: review08.docs.map(({ version }) => ({
      publicMeasure: version.publicMeasure,
      moderatedAt: version.moderatedAt,
      withdrawalState: version.withdrawalState,
    })),
    review09: review09.docs.map(({ version }) => ({
      publicMeasure: version.publicMeasure,
      withdrawnAt: version.withdrawnAt,
      withdrawalState: version.withdrawalState,
    })),
    coast05Review: coast05Review.docs.map(({ version }) => ({
      publicMeasure: version.publicMeasure,
      moderatedAt: version.moderatedAt,
      withdrawalState: version.withdrawalState,
    })),
    coast08Review: coast08Review.docs.map(({ version }) => ({
      publicMeasure: version.publicMeasure,
      withdrawnAt: version.withdrawnAt,
      withdrawalState: version.withdrawalState,
      comment: version.comment,
      starRating: version.starRating,
    })),
    coast09Review: coast09Review.docs.map(({ version }) => ({
      publicMeasure: version.publicMeasure,
      moderatedAt: version.moderatedAt,
      status: version.status,
      withdrawalState: version.withdrawalState,
    })),
    appeal03: appeal03.docs.map(({ version }) => ({
      status: version.status,
      decidedAt: version.decidedAt,
    })),
    appeal05: appeal05.docs.map(({ version }) => ({
      status: version.status,
      decidedAt: version.decidedAt,
    })),
    coast05Appeal: coast05Appeal.docs.map(({ version }) => ({
      status: version.status,
      decidedAt: version.decidedAt,
    })),
    coast09Appeal: coast09Appeal.docs.map(({ version }) => ({
      status: version.status,
      decidedAt: version.decidedAt,
    })),
    appealStates: appealStates.docs.map((appeal) => ({
      stableId: appeal.stableId,
      status: appeal.status,
    })),
    responseStates: responseStates.docs.map((response) => ({
      stableId: response.stableId,
      moderationStatus: response.moderationStatus,
    })),
    reviewMeasures: reviewMeasures.docs.map((review) => ({
      stableId: review.stableId,
      publicMeasure: review.publicMeasure,
    })),
    centralReviews: centralReviews.docs.map((review) => ({
      stableId: review.stableId,
      status: review.status,
      publicMeasure: review.publicMeasure,
      withdrawalState: review.withdrawalState,
    })),
    centralResponses: centralResponses.docs.map((response) => ({
      stableId: response.stableId,
      moderationStatus: response.moderationStatus,
    })),
    centralAppeals: centralAppeals.docs.map((appeal) => ({
      stableId: appeal.stableId,
      status: appeal.status,
    })),
    centralReviewVersions,
    centralResponseVersions,
    centralAppealVersions,
  }
}

describe.sequential('demo review workflow seed integration', () => {
  let payload: Payload
  let firstHistory: WorkflowHistorySnapshot
  let centralClinicId: number
  let clinicStaffId: number | string
  let clinicUser: Awaited<ReturnType<typeof asClinicScopedPayloadUser>>
  const createdStaffIds: Array<number | string> = []
  const slugPrefix = testSlug('seedReviewWorkflow.integration.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  }, 120_000)

  afterAll(async () => {
    try {
      await cleanupSeedReviewWorkflow(payload)
    } finally {
      await cleanupTrackedUsers(payload, { staffIds: createdStaffIds })
    }
  }, 120_000)

  it('runs the complete demo plan and persists the central workflow matrix', async () => {
    const result = await runDemoSeeds(payload)

    expect(result.failures).toEqual([])
    firstHistory = await readWorkflowHistory(payload)

    expect(stableIds(firstHistory.centralReviews)).toEqual([...CENTRAL_REVIEW_IDS].sort())
    expect(stableIds(firstHistory.centralResponses)).toEqual([...CENTRAL_RESPONSE_IDS].sort())
    expect(stableIds(firstHistory.centralAppeals)).toEqual([...CENTRAL_APPEAL_IDS].sort())
    expect([...new Set(firstHistory.responseStates.map(({ moderationStatus }) => moderationStatus))].sort()).toEqual([
      'approved',
      'blocked',
      'pending',
      'rejected',
    ])
    expect([...new Set(firstHistory.appealStates.map(({ status }) => status))].sort()).toEqual([
      'dismissed',
      'submitted',
      'under_review',
      'upheld',
    ])
    expect([...new Set(firstHistory.reviewMeasures.map(({ publicMeasure }) => publicMeasure))].sort()).toEqual([
      'context',
      'none',
      'placeholder',
      'redaction',
      'removed',
    ])
    expect(firstHistory.review06.map(({ publicMeasure }) => publicMeasure)).toEqual([
      'redaction',
      'placeholder',
      'none',
    ])
    expect(firstHistory.review08.map(({ moderatedAt }) => moderatedAt)).toEqual(['2026-02-03T09:30:00.000Z', null])
    expect(firstHistory.appeal03.map(({ status }) => status)).toEqual(['upheld', 'submitted'])
    expect(firstHistory.appeal05.map(({ status }) => status)).toEqual(['upheld', 'submitted'])
    expect(firstHistory.review09.filter(({ withdrawalState }) => withdrawalState === 'withdrawn')).toHaveLength(1)

    expect(firstHistory.coast05Review.map(({ publicMeasure }) => publicMeasure)).toEqual([
      'redaction',
      'placeholder',
      'none',
    ])
    expect(firstHistory.coast05Review.map(({ moderatedAt }) => moderatedAt)).toEqual([
      '2026-02-04T10:00:00.000Z',
      '2026-02-04T09:30:00.000Z',
      null,
    ])
    expect(firstHistory.coast05Appeal.map(({ status }) => status)).toEqual(['upheld', 'submitted'])
    expect(firstHistory.coast09Review.map(({ publicMeasure }) => publicMeasure)).toEqual(['none', 'none'])
    expect(firstHistory.coast09Review.map(({ moderatedAt }) => moderatedAt)).toEqual(['2026-02-05T09:30:00.000Z', null])
    expect(firstHistory.coast09Review.every(({ status }) => status === 'approved')).toBe(true)
    expect(firstHistory.coast09Appeal.map(({ status }) => status)).toEqual(['upheld', 'submitted'])

    const withdrawnVersions = firstHistory.coast08Review.filter(
      ({ withdrawalState }) => withdrawalState === 'withdrawn',
    )
    expect(withdrawnVersions).toHaveLength(1)
    expect(withdrawnVersions[0]).toMatchObject({
      comment: expect.any(String),
      publicMeasure: 'none',
      starRating: 5,
      withdrawnAt: '2026-02-01T10:00:00.000Z',
    })
  }, 180_000)

  it('enforces central platform, clinic, tenant, and public visibility boundaries', async () => {
    const [clinicResult, platformResult] = await Promise.all([
      payload.find({
        collection: 'clinics',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: { stableId: { equals: CENTRAL_CLINIC_STABLE_ID } },
      }),
      payload.find({
        collection: 'platformStaff',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: { stableId: { equals: 'seed-platform-admin' } },
      }),
    ])
    const clinic = clinicResult.docs[0]
    const platformStaff = platformResult.docs[0]
    if (!clinic || typeof clinic.id !== 'number' || !platformStaff) {
      throw new Error('Expected central clinic and platform staff seed records')
    }
    centralClinicId = clinic.id

    const clinicStaff = await createClinicTestUser(payload, {
      emailPrefix: `${slugPrefix}-clinic-reader`,
      firstName: 'Central',
      lastName: 'Clinic Reader',
      createdStaffIds,
    })
    clinicStaffId = clinicStaff.id
    clinicUser = await asClinicScopedPayloadUser(payload, clinicStaff, centralClinicId)
    const platformUser = asPayloadStaffUser(platformStaff)

    const [platformReviews, clinicReviews, clinicResponses, clinicAppeals, publicReviews, publicResponses] =
      await Promise.all([
        payload.find({
          collection: 'reviews',
          depth: 0,
          overrideAccess: false,
          pagination: false,
          sort: 'stableId',
          user: platformUser,
          where: { stableId: { in: [...CENTRAL_REVIEW_IDS] } },
        }),
        payload.find({
          collection: 'reviews',
          depth: 0,
          overrideAccess: false,
          pagination: false,
          sort: 'stableId',
          user: clinicUser,
        }),
        payload.find({
          collection: 'reviewResponses',
          depth: 0,
          overrideAccess: false,
          pagination: false,
          sort: 'stableId',
          user: clinicUser,
        }),
        payload.find({
          collection: 'reviewAppeals',
          depth: 0,
          overrideAccess: false,
          pagination: false,
          sort: 'stableId',
          user: clinicUser,
        }),
        payload.find({
          collection: 'reviews',
          depth: 0,
          overrideAccess: false,
          pagination: false,
          sort: 'stableId',
          where: { stableId: { in: [...CENTRAL_REVIEW_IDS] } },
        }),
        payload.find({
          collection: 'reviewResponses',
          depth: 0,
          overrideAccess: false,
          pagination: false,
          sort: 'stableId',
          where: { stableId: { in: [...CENTRAL_RESPONSE_IDS] } },
        }),
      ])

    expect(stableIds(platformReviews.docs)).toEqual([...CENTRAL_REVIEW_IDS].sort())
    expect(stableIds(clinicReviews.docs)).toEqual([...CENTRAL_APPROVED_REVIEW_IDS].sort())
    expect(clinicReviews.docs.every((review) => relationId(review.clinic) === centralClinicId)).toBe(true)
    expect(stableIds(clinicResponses.docs)).toEqual([...CENTRAL_RESPONSE_IDS].sort())
    expect(clinicResponses.docs.every((response) => relationId(response.clinic) === centralClinicId)).toBe(true)
    expect(stableIds(clinicAppeals.docs)).toEqual([...CENTRAL_APPEAL_IDS].sort())
    expect(clinicAppeals.docs.every((appeal) => relationId(appeal.clinic) === centralClinicId)).toBe(true)

    const [foreignReviews, foreignResponses, foreignAppeals] = await Promise.all([
      payload.find({
        collection: 'reviews',
        depth: 0,
        overrideAccess: false,
        user: clinicUser,
        where: { stableId: { equals: 'seed-review-01' } },
      }),
      payload.find({
        collection: 'reviewResponses',
        depth: 0,
        overrideAccess: false,
        user: clinicUser,
        where: { stableId: { equals: 'seed-review-response-01' } },
      }),
      payload.find({
        collection: 'reviewAppeals',
        depth: 0,
        overrideAccess: false,
        user: clinicUser,
        where: { stableId: { equals: 'seed-review-appeal-01' } },
      }),
    ])
    expect(foreignReviews.docs).toHaveLength(0)
    expect(foreignResponses.docs).toHaveLength(0)
    expect(foreignAppeals.docs).toHaveLength(0)

    expect(stableIds(publicReviews.docs)).toEqual([...CENTRAL_PUBLIC_REVIEW_IDS].sort())
    expect(
      Object.fromEntries(publicReviews.docs.map((review) => [review.stableId, projectPublicReviewText(review)])),
    ).toEqual({
      'seed-review-izmir-coast-03': { kind: 'text', text: expect.any(String) },
      'seed-review-izmir-coast-04': {
        kind: 'text',
        text: expect.any(String),
        notice: expect.any(String),
      },
      'seed-review-izmir-coast-05': {
        kind: 'text',
        text: 'The treatment plan was clear, and the follow-ups were reliable.',
        notice: expect.any(String),
      },
      'seed-review-izmir-coast-06': { kind: 'placeholder', notice: expect.any(String) },
      'seed-review-izmir-coast-09': { kind: 'text', text: expect.any(String) },
      'seed-review-izmir-coast-10': { kind: 'text', text: expect.any(String) },
    })
    expect(stableIds(publicResponses.docs)).toEqual([...CENTRAL_PUBLIC_RESPONSE_IDS].sort())
  }, 120_000)

  it('keeps native workflow history and the clinic assignment unchanged on a second demo run', async () => {
    const result = await runDemoSeeds(payload)

    expect(result.failures).toEqual([])
    expect(await readWorkflowHistory(payload)).toEqual(firstHistory)

    const persistedClinicStaff = await payload.findByID({
      collection: 'clinicStaff',
      id: clinicStaffId,
      depth: 0,
      overrideAccess: true,
    })
    expect(relationId(persistedClinicStaff.clinic)).toBe(centralClinicId)
  }, 180_000)
})

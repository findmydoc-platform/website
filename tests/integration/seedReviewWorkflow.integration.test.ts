import { beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'

import { runDemoSeeds } from '@/endpoints/seed/demo/run-demo'
import type { Review, ReviewAppeal, ReviewResponse } from '@/payload-types'
import { ensureBaseline } from '../fixtures/ensureBaseline'

type WorkflowHistorySnapshot = {
  appeal03: Array<Pick<ReviewAppeal, 'status' | 'decidedAt'>>
  appeal05: Array<Pick<ReviewAppeal, 'status' | 'decidedAt'>>
  appealStates: Array<Pick<ReviewAppeal, 'stableId' | 'status'>>
  responseStates: Array<Pick<ReviewResponse, 'stableId' | 'moderationStatus'>>
  reviewMeasures: Array<Pick<Review, 'stableId' | 'publicMeasure'>>
  review06: Array<Pick<Review, 'publicMeasure' | 'moderatedAt' | 'withdrawalState'>>
  review08: Array<Pick<Review, 'publicMeasure' | 'moderatedAt' | 'withdrawalState'>>
  review09: Array<Pick<Review, 'publicMeasure' | 'withdrawnAt' | 'withdrawalState'>>
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

const readWorkflowHistory = async (payload: Payload): Promise<WorkflowHistorySnapshot> => {
  const [review06Id, review08Id, review09Id, appeal03Id, appeal05Id] = await Promise.all([
    findSeedId(payload, 'reviews', 'seed-review-06'),
    findSeedId(payload, 'reviews', 'seed-review-08'),
    findSeedId(payload, 'reviews', 'seed-review-09'),
    findSeedId(payload, 'reviewAppeals', 'seed-review-appeal-03'),
    findSeedId(payload, 'reviewAppeals', 'seed-review-appeal-05'),
  ])
  const [review06, review08, review09, appeal03, appeal05, responseStates, appealStates, reviewMeasures] =
    await Promise.all([
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
    appeal03: appeal03.docs.map(({ version }) => ({
      status: version.status,
      decidedAt: version.decidedAt,
    })),
    appeal05: appeal05.docs.map(({ version }) => ({
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
  }
}

describe.sequential('demo review workflow seed integration', () => {
  let payload: Payload
  let firstHistory: WorkflowHistorySnapshot

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  }, 120_000)

  it('runs the complete demo plan and persists all four response states', async () => {
    const result = await runDemoSeeds(payload)

    expect(result.failures).toEqual([])
    firstHistory = await readWorkflowHistory(payload)
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
  }, 180_000)

  it('keeps the complete review history unchanged on a second demo run', async () => {
    const result = await runDemoSeeds(payload)

    expect(result.failures).toEqual([])
    expect(await readWorkflowHistory(payload)).toEqual(firstHistory)
  }, 180_000)
})

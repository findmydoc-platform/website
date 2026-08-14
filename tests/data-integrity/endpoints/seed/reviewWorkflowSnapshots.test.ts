import platformStaff from '@/endpoints/seed/data/demo/platformStaff.json'
import reviewAppeals from '@/endpoints/seed/data/demo/reviewAppeals.json'
import reviewAppealsInitial from '@/endpoints/seed/data/demo/reviewAppealsInitial.json'
import reviewModerations from '@/endpoints/seed/data/demo/reviewModerations.json'
import reviewModerationsInitial from '@/endpoints/seed/data/demo/reviewModerationsInitial.json'
import reviewResponses from '@/endpoints/seed/data/demo/reviewResponses.json'
import reviews from '@/endpoints/seed/data/demo/reviews.json'
import { loadSeedFile } from '@/endpoints/seed/utils/load-json'
import { demoPlan } from '@/endpoints/seed/utils/plan'
import { buildSeedQueueJobs } from '@/endpoints/seed/utils/planner'
import { describe, expect, it } from 'vitest'

type SeedRecord = Record<string, unknown> & { stableId: string }

const reviewRecords = reviews as SeedRecord[]
const appealRecords = reviewAppeals as SeedRecord[]
const initialAppealRecords = reviewAppealsInitial as SeedRecord[]
const moderationRecords = reviewModerations as SeedRecord[]
const initialModerationRecords = reviewModerationsInitial as SeedRecord[]
const responseRecords = reviewResponses as SeedRecord[]

const findRecord = (records: readonly SeedRecord[], stableId: string): SeedRecord => {
  const record = records.find((candidate) => candidate.stableId === stableId)
  if (!record) throw new Error(`Missing seed fixture ${stableId}`)
  return record
}

const timestamp = (value: unknown): number => {
  const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN
  if (!Number.isFinite(parsed)) throw new Error(`Invalid fixture timestamp: ${String(value)}`)
  return parsed
}

describe('review workflow seed plan', () => {
  it.each([
    { expected: reviewResponses, fileName: 'reviewResponses' },
    { expected: reviewAppealsInitial, fileName: 'reviewAppealsInitial' },
    { expected: reviewModerationsInitial, fileName: 'reviewModerationsInitial' },
    { expected: reviewModerations, fileName: 'reviewModerations' },
    { expected: reviewAppeals, fileName: 'reviewAppeals' },
  ])('registers the demo/$fileName fixture', async ({ expected, fileName }) => {
    expect(await loadSeedFile('demo', fileName)).toEqual(expected)
  })

  it('orders the two versioned histories after their dependencies', () => {
    const orderedSteps = [
      'reviews',
      'review-moderations-initial-history',
      'review-response-states',
      'review-appeals-initial-history',
      'review-moderations-final-state',
      'review-appeals-final-state',
    ]
    const indices = orderedSteps.map((name) => demoPlan.findIndex((step) => step.name === name))

    expect(indices.every((index) => index >= 0)).toBe(true)
    expect(indices).toEqual([...indices].sort((left, right) => left - right))
    expect(new Set(indices).size).toBe(indices.length)
  })

  it('keeps intermediate snapshots version-idempotent and terminal snapshots current', () => {
    const historySteps = [
      {
        name: 'review-appeals-initial-history',
        upsertPolicy: { reconcileByUniqueFields: ['review'], skipIfVersionMatches: true },
      },
      { name: 'review-moderations-initial-history', upsertPolicy: { skipIfVersionMatches: true } },
      { name: 'review-moderations-final-state', upsertPolicy: { skipIfCurrentMatches: true } },
      {
        name: 'review-appeals-final-state',
        upsertPolicy: { reconcileByUniqueFields: ['review'], skipIfCurrentMatches: true },
      },
    ]

    expect(historySteps.map(({ name }) => demoPlan.find((step) => step.name === name))).toEqual(
      historySteps.map(({ name, upsertPolicy }) =>
        expect.objectContaining({
          name,
          atomicGroup: 'review-moderation-history',
          upsertPolicy,
        }),
      ),
    )

    expect(demoPlan.find((step) => step.name === 'review-response-states')).toEqual(
      expect.objectContaining({
        upsertPolicy: { reconcileByUniqueFields: ['review'], skipIfCurrentMatches: true },
      }),
    )
  })

  it('propagates the atomic public history to every queued workflow job', async () => {
    const jobs = await buildSeedQueueJobs({
      runId: 'review-workflow-plan-test',
      type: 'demo',
      reset: false,
      queue: 'seed:review-workflow-plan-test',
    })
    const historyJobs = jobs.filter(({ input }) => input.atomicGroup === 'review-moderation-history')

    expect(historyJobs.map(({ input }) => input.stepName)).toEqual([
      'review-moderations-initial-history',
      'review-appeals-initial-history',
      'review-moderations-final-state',
      'review-appeals-final-state',
    ])
  })

  it.each([
    { fileName: 'reviewModerationsInitial', name: 'review-moderations-initial-history' },
    { fileName: 'reviewModerations', name: 'review-moderations-final-state' },
  ])('uses the normal Review lifecycle and platform actor for $name', ({ fileName, name }) => {
    const step = demoPlan.find((candidate) => candidate.name === name)

    expect(step).toMatchObject({
      kind: 'collection',
      collection: 'reviews',
      fileName,
      reqUserStableId: 'seed-platform-admin',
      mapping: [
        {
          sourceField: 'moderatedByStableId',
          targetField: 'moderatedBy',
          collection: 'platformStaff',
          required: true,
        },
      ],
    })
    expect(step).not.toHaveProperty('context')
  })

  it('resolves direct moderation and withdrawal actors on the initial Review step', () => {
    const step = demoPlan.find((candidate) => candidate.name === 'reviews')

    expect(step).toMatchObject({
      mapping: expect.arrayContaining([
        {
          sourceField: 'moderatedByStableId',
          targetField: 'moderatedBy',
          collection: 'platformStaff',
        },
        {
          sourceField: 'withdrawnByStableId',
          targetField: 'withdrawnBy.value',
          collection: 'platformStaff',
        },
      ]),
    })
    expect((platformStaff as SeedRecord[]).some((staff) => staff.stableId === 'seed-platform-admin')).toBe(true)
  })
})

describe('review workflow version snapshots', () => {
  it.each([
    {
      appealStableId: 'seed-review-appeal-03',
      expectedTimeline: [
        '2026-02-02T09:00:00.000Z',
        '2026-02-02T09:30:00.000Z',
        '2026-02-02T10:00:00.000Z',
        '2026-02-02T10:30:00.000Z',
      ],
      initialStatus: 'approved',
      label: 'public review to placeholder to final redaction before upheld',
      moderationSnapshots: [
        { measure: 'placeholder', records: initialModerationRecords, status: undefined },
        { measure: 'redaction', records: moderationRecords, status: undefined },
      ],
      reviewStableId: 'seed-review-06',
    },
    {
      appealStableId: 'seed-review-appeal-05',
      expectedTimeline: ['2026-02-03T09:00:00.000Z', '2026-02-03T09:30:00.000Z', '2026-02-03T10:00:00.000Z'],
      initialStatus: 'approved',
      label: 'submitted appeal to audited none before upheld',
      moderationSnapshots: [{ measure: 'none', records: initialModerationRecords, status: undefined }],
      reviewStableId: 'seed-review-08',
    },
    {
      appealStableId: 'seed-review-appeal-izmir-coast-05',
      expectedTimeline: [
        '2026-02-04T09:00:00.000Z',
        '2026-02-04T09:30:00.000Z',
        '2026-02-04T10:00:00.000Z',
        '2026-02-04T10:30:00.000Z',
      ],
      initialStatus: 'pending',
      label: 'central private source to safe placeholder to final redaction before upheld',
      moderationSnapshots: [
        { measure: 'placeholder', records: initialModerationRecords, status: 'approved' },
        { measure: 'redaction', records: moderationRecords, status: 'approved' },
      ],
      reviewStableId: 'seed-review-izmir-coast-05',
    },
    {
      appealStableId: 'seed-review-appeal-izmir-coast-09',
      expectedTimeline: ['2026-02-05T09:00:00.000Z', '2026-02-05T09:30:00.000Z', '2026-02-05T10:00:00.000Z'],
      initialStatus: 'approved',
      label: 'central submitted appeal to audited none before upheld',
      moderationSnapshots: [{ measure: 'none', records: initialModerationRecords, status: undefined }],
      reviewStableId: 'seed-review-izmir-coast-09',
    },
  ])(
    'preserves the $label history',
    ({ appealStableId, expectedTimeline, initialStatus, moderationSnapshots, reviewStableId }) => {
      const review = findRecord(reviewRecords, reviewStableId)
      const initialAppeal = findRecord(initialAppealRecords, appealStableId)
      const finalAppeal = findRecord(appealRecords, appealStableId)
      const snapshots = moderationSnapshots.map(({ measure, records, status }) => ({
        measure,
        record: findRecord(records, reviewStableId),
        status,
      }))
      const timeline = [
        timestamp(initialAppeal.createdAt),
        ...snapshots.map(({ record }) => timestamp(record.moderatedAt)),
        timestamp(finalAppeal.decidedAt),
      ]

      expect(review).toMatchObject({
        status: initialStatus,
        publicMeasure: 'none',
        withdrawalState: 'active',
      })
      expect(initialAppeal).toMatchObject({
        reviewStableId,
        status: 'submitted',
      })
      expect(finalAppeal).toMatchObject({
        reviewStableId,
        status: 'upheld',
      })
      expect(snapshots.map(({ record }) => record.publicMeasure)).toEqual(snapshots.map(({ measure }) => measure))
      expect(timeline).toEqual(expectedTimeline.map(timestamp))
      expect(timeline).toEqual([...timeline].sort((left, right) => left - right))
      expect(new Set(timeline).size).toBe(timeline.length)

      for (const { record, status } of snapshots) {
        expect(record).toMatchObject({
          moderatedByStableId: 'seed-platform-admin',
          moderationReason: expect.any(String),
        })
        expect(record).not.toHaveProperty('comment')
        expect(record).not.toHaveProperty('starRating')
        if (status) {
          expect(record.status).toBe(status)
        } else {
          expect(record).not.toHaveProperty('status')
        }
      }
    },
  )

  it('keeps the central withdrawal content and response as internal audit data', () => {
    const review = findRecord(reviewRecords, 'seed-review-izmir-coast-08')
    const response = findRecord(responseRecords, 'seed-review-response-izmir-coast-08')

    expect(review).toMatchObject({
      status: 'approved',
      publicMeasure: 'none',
      withdrawalState: 'withdrawn',
      withdrawalSource: 'platform',
      withdrawalReason: expect.any(String),
      withdrawnAt: '2026-02-01T10:00:00.000Z',
      withdrawnByStableId: 'seed-platform-admin',
      comment: expect.any(String),
      starRating: 5,
    })
    expect(response).toMatchObject({
      reviewStableId: review.stableId,
      moderationStatus: 'approved',
      publishedResponse: {
        body: expect.any(String),
        approvedAt: '2026-01-20T09:00:00.000Z',
        isBlocked: false,
      },
    })
  })
})

import platformStaff from '@/endpoints/seed/data/demo/platformStaff.json'
import reviewAppeals from '@/endpoints/seed/data/demo/reviewAppeals.json'
import reviewAppealsInitial from '@/endpoints/seed/data/demo/reviewAppealsInitial.json'
import reviewModerations from '@/endpoints/seed/data/demo/reviewModerations.json'
import reviewModerationsInitial from '@/endpoints/seed/data/demo/reviewModerationsInitial.json'
import reviewResponses from '@/endpoints/seed/data/demo/reviewResponses.json'
import reviews from '@/endpoints/seed/data/demo/reviews.json'
import { loadSeedFile } from '@/endpoints/seed/utils/load-json'
import { demoPlan } from '@/endpoints/seed/utils/plan'
import { describe, expect, it } from 'vitest'

type SeedRecord = Record<string, unknown> & { stableId: string }

const reviewRecords = reviews as SeedRecord[]
const appealRecords = reviewAppeals as SeedRecord[]
const initialAppealRecords = reviewAppealsInitial as SeedRecord[]
const moderationRecords = reviewModerations as SeedRecord[]
const initialModerationRecords = reviewModerationsInitial as SeedRecord[]

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
      'review-response-states',
      'review-appeals-initial-history',
      'review-moderations-initial-history',
      'review-moderations-final-state',
      'review-appeals-final-state',
    ]
    const indices = orderedSteps.map((name) => demoPlan.findIndex((step) => step.name === name))

    expect(indices.every((index) => index >= 0)).toBe(true)
    expect(indices).toEqual([...indices].sort((left, right) => left - right))
    expect(new Set(indices).size).toBe(indices.length)
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
      label: 'public review to placeholder to final redaction before upheld',
      moderationSnapshots: [
        { measure: 'placeholder', records: initialModerationRecords },
        { measure: 'redaction', records: moderationRecords },
      ],
      reviewStableId: 'seed-review-06',
    },
    {
      appealStableId: 'seed-review-appeal-05',
      label: 'submitted appeal to audited none before upheld',
      moderationSnapshots: [{ measure: 'none', records: initialModerationRecords }],
      reviewStableId: 'seed-review-08',
    },
  ])('preserves the $label history', ({ appealStableId, moderationSnapshots, reviewStableId }) => {
    const review = findRecord(reviewRecords, reviewStableId)
    const initialAppeal = findRecord(initialAppealRecords, appealStableId)
    const finalAppeal = findRecord(appealRecords, appealStableId)
    const snapshots = moderationSnapshots.map(({ measure, records }) => ({
      measure,
      record: findRecord(records, reviewStableId),
    }))
    const timeline = [
      timestamp(initialAppeal.createdAt),
      ...snapshots.map(({ record }) => timestamp(record.moderatedAt)),
      timestamp(finalAppeal.decidedAt),
    ]

    expect(review).toMatchObject({
      status: 'approved',
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
    expect(timeline).toEqual([...timeline].sort((left, right) => left - right))
    expect(new Set(timeline).size).toBe(timeline.length)

    for (const { record } of snapshots) {
      expect(record).toMatchObject({
        moderatedByStableId: 'seed-platform-admin',
        moderationReason: expect.any(String),
      })
      expect(record).not.toHaveProperty('comment')
      expect(record).not.toHaveProperty('starRating')
      expect(record).not.toHaveProperty('status')
    }
  })
})

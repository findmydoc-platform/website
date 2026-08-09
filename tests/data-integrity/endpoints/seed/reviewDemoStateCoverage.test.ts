import clinics from '@/endpoints/seed/data/demo/clinics.json'
import platformStaff from '@/endpoints/seed/data/demo/platformStaff.json'
import reviewAppeals from '@/endpoints/seed/data/demo/reviewAppeals.json'
import reviewAppealsInitial from '@/endpoints/seed/data/demo/reviewAppealsInitial.json'
import reviewModerations from '@/endpoints/seed/data/demo/reviewModerations.json'
import reviewModerationsInitial from '@/endpoints/seed/data/demo/reviewModerationsInitial.json'
import reviewResponses from '@/endpoints/seed/data/demo/reviewResponses.json'
import reviews from '@/endpoints/seed/data/demo/reviews.json'
import { REVIEW_PLACEHOLDER_NOTICE, REVIEW_REDACTION_NOTICE } from '@/collections/reviews/publicProjection'
import { describe, expect, it } from 'vitest'

type SeedRecord = Record<string, unknown> & { stableId: string }

const reviewRecords = reviews as SeedRecord[]
const responseRecords = reviewResponses as SeedRecord[]
const appealRecords = reviewAppeals as SeedRecord[]
const initialAppealRecords = reviewAppealsInitial as SeedRecord[]
const moderationRecords = reviewModerations as SeedRecord[]
const initialModerationRecords = reviewModerationsInitial as SeedRecord[]

const findRecord = (records: readonly SeedRecord[], stableId: string): SeedRecord => {
  const record = records.find((candidate) => candidate.stableId === stableId)
  if (!record) throw new Error(`Missing seed fixture ${stableId}`)
  return record
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const collectKeys = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(collectKeys)
  if (!value || typeof value !== 'object') return []

  return Object.entries(value).flatMap(([key, nestedValue]) => [key, ...collectKeys(nestedValue)])
}

describe('review demo fixture state coverage', () => {
  it.each([
    { label: 'pending', stableId: 'seed-review-10' },
    { label: 'approved', stableId: 'seed-review-01' },
    { label: 'rejected', stableId: 'seed-review-11' },
  ])('covers the $label review state', ({ label, stableId }) => {
    expect(findRecord(reviewRecords, stableId).status).toBe(label)
  })

  it.each([
    { label: 'none', records: reviewRecords, stableId: 'seed-review-01', field: 'publicMeasure' },
    { label: 'context', records: reviewRecords, stableId: 'seed-review-02', field: 'publicMeasure' },
    { label: 'redaction', records: reviewRecords, stableId: 'seed-review-03', field: 'publicMeasure' },
    {
      label: 'placeholder',
      records: initialModerationRecords,
      stableId: 'seed-review-06',
      field: 'publicMeasure',
    },
    { label: 'removed', records: reviewRecords, stableId: 'seed-review-04', field: 'publicMeasure' },
    { label: 'withdrawn', records: reviewRecords, stableId: 'seed-review-09', field: 'withdrawalState' },
  ])('covers the $label public review treatment', ({ field, label, records, stableId }) => {
    expect(findRecord(records, stableId)[field]).toBe(label)
  })

  it('uses the canonical placeholder and redaction projections', () => {
    const placeholder = findRecord(initialModerationRecords, 'seed-review-06')
    const redaction = findRecord(moderationRecords, 'seed-review-06')

    expect(placeholder).toMatchObject({
      publicComment: null,
      publicNotice: REVIEW_PLACEHOLDER_NOTICE,
    })
    expect(redaction).toMatchObject({
      publicComment: 'Reliable orthodontic follow-ups.',
      publicNotice: REVIEW_REDACTION_NOTICE,
    })
  })

  it.each([
    { label: 'pending', stableId: 'seed-review-response-02' },
    { label: 'approved', stableId: 'seed-review-response-01' },
    { label: 'rejected', stableId: 'seed-review-response-03' },
    { label: 'blocked', stableId: 'seed-review-response-04' },
  ])('covers the $label response state', ({ label, stableId }) => {
    expect(findRecord(responseRecords, stableId).moderationStatus).toBe(label)
  })

  it('keeps the blocked response explicitly blocked', () => {
    const response = findRecord(responseRecords, 'seed-review-response-04')

    expect(asRecord(response.publishedResponse).isBlocked).toBe(true)
    expect(response.moderationReason).toEqual(expect.any(String))
  })

  it.each([
    { label: 'submitted', stableId: 'seed-review-appeal-01' },
    { label: 'under_review', stableId: 'seed-review-appeal-02' },
    { label: 'upheld with redaction', stableId: 'seed-review-appeal-03' },
    { label: 'dismissed', stableId: 'seed-review-appeal-04' },
    { label: 'upheld with explicit none', stableId: 'seed-review-appeal-05' },
  ])('covers the $label appeal state', ({ label, stableId }) => {
    const expectedStatus = label.startsWith('upheld') ? 'upheld' : label
    expect(findRecord(appealRecords, stableId).status).toBe(expectedStatus)
  })
})

describe('review demo fixture references and audits', () => {
  const reviewIds = new Set(reviewRecords.map((record) => record.stableId))
  const platformStaffIds = new Set((platformStaff as SeedRecord[]).map((record) => record.stableId))

  it.each([
    { label: 'response', records: responseRecords },
    { label: 'appeal', records: appealRecords },
    { label: 'initial appeal', records: initialAppealRecords },
  ])('resolves every $label review reference', ({ records }) => {
    for (const record of records) {
      expect(reviewIds.has(String(record.reviewStableId))).toBe(true)
    }
  })

  it.each([
    { records: reviewRecords, source: 'reviews', stableId: 'seed-review-02' },
    { records: reviewRecords, source: 'reviews', stableId: 'seed-review-03' },
    { records: reviewRecords, source: 'reviews', stableId: 'seed-review-04' },
    { records: initialModerationRecords, source: 'reviewModerationsInitial', stableId: 'seed-review-06' },
    { records: initialModerationRecords, source: 'reviewModerationsInitial', stableId: 'seed-review-08' },
    { records: moderationRecords, source: 'reviewModerations', stableId: 'seed-review-06' },
  ])('resolves the platform moderation actor for $source:$stableId', ({ records, stableId }) => {
    const actorStableId = findRecord(records, stableId).moderatedByStableId
    expect(platformStaffIds.has(String(actorStableId))).toBe(true)
  })

  it('documents a verified author withdrawal through Platform Support without replacing the original text', () => {
    const review = findRecord(reviewRecords, 'seed-review-09')
    const response = findRecord(responseRecords, 'seed-review-response-05')

    expect(review).toMatchObject({
      status: 'approved',
      publicMeasure: 'none',
      withdrawalState: 'withdrawn',
      withdrawalSource: 'platform',
      withdrawnByStableId: 'seed-platform-admin',
    })
    expect(review.withdrawalReason).toMatch(/Platform Support.*verified request/i)
    expect(review.comment).toEqual(expect.any(String))
    expect(review.starRating).toEqual(expect.any(Number))
    expect(asRecord(review.withdrawnBy)).toEqual({ relationTo: 'platformStaff' })
    expect(platformStaffIds.has(String(review.withdrawnByStableId))).toBe(true)
    expect(response).toMatchObject({
      reviewStableId: review.stableId,
      moderationStatus: 'approved',
    })
    expect(asRecord(response.publishedResponse).isBlocked).toBe(false)
  })

  it('spans multiple existing clinics across the canonical workflow cases', () => {
    const clinicIds = new Set((clinics as SeedRecord[]).map((clinic) => clinic.stableId))
    const workflowReviewIds = new Set(
      [...responseRecords, ...appealRecords, ...initialModerationRecords, ...moderationRecords].map((record) =>
        String(record.reviewStableId ?? record.stableId),
      ),
    )
    const usedClinicIds = new Set(
      reviewRecords
        .filter((review) => workflowReviewIds.has(review.stableId))
        .map((review) => String(review.clinicStableId)),
    )

    expect(usedClinicIds.size).toBeGreaterThanOrEqual(2)
    for (const clinicId of usedClinicIds) {
      expect(clinicIds.has(clinicId)).toBe(true)
    }
  })

  it('contains no evidence, passage, upload, document, or direct-contact fields', () => {
    const workflowFixtures = [
      reviewRecords,
      responseRecords,
      appealRecords,
      initialAppealRecords,
      moderationRecords,
      initialModerationRecords,
    ]
    const forbiddenKeys = collectKeys(workflowFixtures).filter((key) =>
      /evidence|passage|proof|document|upload|attachment/i.test(key),
    )
    const serializedFixtures = JSON.stringify(workflowFixtures)

    expect(forbiddenKeys).toEqual([])
    expect(serializedFixtures).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  })
})

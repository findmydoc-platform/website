import platformStaff from '@/endpoints/seed/data/demo/platformStaff.json'
import reviewAppeals from '@/endpoints/seed/data/demo/reviewAppeals.json'
import reviewAppealsInitial from '@/endpoints/seed/data/demo/reviewAppealsInitial.json'
import reviewModerations from '@/endpoints/seed/data/demo/reviewModerations.json'
import reviews from '@/endpoints/seed/data/demo/reviews.json'
import { loadSeedFile } from '@/endpoints/seed/utils/load-json'
import { demoPlan } from '@/endpoints/seed/utils/plan'
import { describe, expect, it } from 'vitest'

describe('review appeal moderation seed snapshots', () => {
  it('registers the partial review moderation fixture with its platform actor', async () => {
    const records = await loadSeedFile('demo', 'reviewModerations')
    const moderation = reviewModerations[0]

    expect(records).toEqual(reviewModerations)
    expect(reviewModerations).toHaveLength(1)
    expect(moderation).toMatchObject({
      stableId: 'seed-review-06',
      publicMeasure: 'removed',
      publicComment: null,
      publicNotice: null,
      moderatedAt: '2026-01-24T09:30:00.000Z',
      moderatedByStableId: 'seed-platform-admin',
    })
    expect(moderation?.moderationReason).toMatch(/privacy|identify another patient/i)
    expect(reviews.some((review) => review.stableId === moderation?.stableId)).toBe(true)
    expect(platformStaff.some((staff) => staff.stableId === moderation?.moderatedByStableId)).toBe(true)
  })

  it('orders the audited review moderation between the initial and final appeal snapshots', () => {
    const initialIndex = demoPlan.findIndex((step) => step.name === 'review-appeals-initial-history')
    const moderationIndex = demoPlan.findIndex((step) => step.name === 'review-moderations')
    const finalIndex = demoPlan.findIndex((step) => step.name === 'review-appeals-final-state')
    const moderationStep = demoPlan[moderationIndex]

    expect(initialIndex).toBeGreaterThanOrEqual(0)
    expect(moderationIndex).toBeGreaterThan(initialIndex)
    expect(finalIndex).toBeGreaterThan(moderationIndex)
    expect(moderationStep).toMatchObject({
      kind: 'collection',
      collection: 'reviews',
      fileName: 'reviewModerations',
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
    expect(moderationStep).not.toHaveProperty('context')
  })

  it('keeps appeal submission, review moderation, and appeal decision timestamps ordered', () => {
    const initialAppeal = reviewAppealsInitial.find((appeal) => appeal.stableId === 'seed-review-appeal-03')
    const finalAppeal = reviewAppeals.find((appeal) => appeal.stableId === 'seed-review-appeal-03')
    const moderation = reviewModerations.find((review) => review.stableId === 'seed-review-06')

    expect(initialAppeal).toMatchObject({
      reviewStableId: 'seed-review-06',
      status: 'submitted',
      createdAt: '2026-01-24T09:00:00.000Z',
    })
    expect(finalAppeal).toMatchObject({
      reviewStableId: 'seed-review-06',
      status: 'upheld',
      decidedAt: '2026-01-24T10:00:00.000Z',
    })
    expect(Date.parse(initialAppeal?.createdAt ?? '')).toBeLessThan(Date.parse(moderation?.moderatedAt ?? ''))
    expect(Date.parse(moderation?.moderatedAt ?? '')).toBeLessThan(Date.parse(finalAppeal?.decidedAt ?? ''))
  })
})

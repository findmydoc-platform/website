import { describe, expect, it } from 'vitest'

import {
  communicationReviewDueAt,
  isRetentionReviewDue,
  mapLegacyInquiryState,
  moderationReviewDueAt,
} from '@/features/inquiryRetention/policy'

describe('inquiry retention policy', () => {
  it('anchors communication review to the last external activity or inquiry creation', () => {
    expect(communicationReviewDueAt('2025-01-31T12:30:00.000Z', 12)).toBe('2026-01-31T12:30:00.000Z')
    expect(communicationReviewDueAt('2024-02-29T08:00:00.000Z', 12)).toBe('2025-02-28T08:00:00.000Z')
  })

  it('anchors moderation review after both the final outcome and the end of every measure', () => {
    expect(
      moderationReviewDueAt({
        finalOutcomeAt: '2025-02-01T00:00:00.000Z',
        measureEndedAt: '2025-04-15T00:00:00.000Z',
        reviewMonths: 24,
      }),
    ).toBe('2027-04-15T00:00:00.000Z')
    expect(
      moderationReviewDueAt({
        finalOutcomeAt: '2025-02-01T00:00:00.000Z',
        measureEndedAt: null,
        reviewMonths: 24,
      }),
    ).toBeNull()
  })

  it('marks elapsed records for review without changing the original deadline while held', () => {
    const reviewDueAt = '2025-01-01T00:00:00.000Z'
    expect(isRetentionReviewDue({ activeLegalHold: false, now: '2025-01-02T00:00:00.000Z', reviewDueAt })).toBe(true)
    expect(isRetentionReviewDue({ activeLegalHold: true, now: '2025-01-02T00:00:00.000Z', reviewDueAt })).toBe(false)
    expect(reviewDueAt).toBe('2025-01-01T00:00:00.000Z')
  })

  it.each([
    ['submitted', { handlingStatus: 'submitted', lifecycle: 'open' }],
    ['in_review', { handlingStatus: 'in_review', lifecycle: 'open' }],
    ['contacted', { handlingStatus: 'contacted', lifecycle: 'open' }],
    ['spam', { handlingStatus: 'spam', lifecycle: 'closed' }],
    ['closed', { handlingStatus: 'submitted', lifecycle: 'closed' }],
  ] as const)('maps legacy %s deterministically without creating a conversation', (status, expected) => {
    expect(mapLegacyInquiryState(status)).toEqual(expected)
  })
})

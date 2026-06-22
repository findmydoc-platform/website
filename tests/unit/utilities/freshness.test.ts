import { describe, expect, it } from 'vitest'

import { buildFreshnessMetadata, buildFreshnessSignals } from '@/utilities/freshness'

describe('freshness utilities', () => {
  it('builds source-backed freshness signals without inventing missing values', () => {
    expect(
      buildFreshnessSignals({
        updatedAt: '2026-01-01T00:00:00.000Z',
        latestPatientReviewAt: '2026-01-05T00:00:00.000Z',
        verificationTier: 'gold',
        sourceCollections: ['reviews', 'clinics', 'reviews'],
      }),
    ).toEqual({
      updatedAt: '2026-01-05T00:00:00.000Z',
      latestPatientReviewAt: '2026-01-05T00:00:00.000Z',
      verificationTier: 'gold',
      sourceCollections: ['clinics', 'reviews'],
    })
  })

  it('renders only available metadata fields', () => {
    expect(
      buildFreshnessMetadata({
        updatedAt: '2026-01-05T00:00:00.000Z',
        latestPatientReviewAt: '2026-01-04T00:00:00.000Z',
        sourceCollections: ['clinics', 'reviews'],
      }),
    ).toEqual({
      other: {
        'last-modified': '2026-01-05T00:00:00.000Z',
        'findmydoc:updated_at': '2026-01-05T00:00:00.000Z',
        'findmydoc:latest_patient_review_at': '2026-01-04T00:00:00.000Z',
        'findmydoc:freshness_sources': 'clinics,reviews',
      },
    })
  })
})

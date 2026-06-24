import type { Metadata } from 'next'

import { findLatestIsoTimestampString, normalizeToIsoTimestampString } from './timestamps'

export type FreshnessSignals = {
  updatedAt?: string
  publishedAt?: string
  latestPatientReviewAt?: string
  verificationTier?: string
  sourceCollections: string[]
}

export type FreshnessInput = {
  updatedAt?: unknown
  publishedAt?: unknown
  latestPatientReviewAt?: unknown
  verificationTier?: unknown
  sourceCollections?: string[]
}

function normalizeFreshnessSourceCollectionNames(sourceCollections: string[] | undefined): string[] {
  if (!sourceCollections) return []

  return Array.from(
    new Set(sourceCollections.map((source) => source.trim()).filter((source) => source.length > 0)),
  ).sort((left, right) => left.localeCompare(right, 'en'))
}

export function buildFreshnessSignals(input: FreshnessInput = {}): FreshnessSignals {
  const latestPatientReviewAt = normalizeToIsoTimestampString(input.latestPatientReviewAt)
  const updatedAt = findLatestIsoTimestampString([input.updatedAt, latestPatientReviewAt])
  const publishedAt = normalizeToIsoTimestampString(input.publishedAt)
  const verificationTier = typeof input.verificationTier === 'string' ? input.verificationTier.trim() : ''

  return {
    ...(updatedAt ? { updatedAt } : {}),
    ...(publishedAt ? { publishedAt } : {}),
    ...(latestPatientReviewAt ? { latestPatientReviewAt } : {}),
    ...(verificationTier.length > 0 ? { verificationTier } : {}),
    sourceCollections: normalizeFreshnessSourceCollectionNames(input.sourceCollections),
  }
}

export function buildFreshnessMetadata(freshness?: FreshnessSignals | null): Pick<Metadata, 'other'> {
  if (!freshness) return {}

  const other: NonNullable<Metadata['other']> = {}

  if (freshness.updatedAt) {
    other['last-modified'] = freshness.updatedAt
    other['findmydoc:updated_at'] = freshness.updatedAt
  }

  if (freshness.publishedAt) {
    other['findmydoc:published_at'] = freshness.publishedAt
  }

  if (freshness.latestPatientReviewAt) {
    other['findmydoc:latest_patient_review_at'] = freshness.latestPatientReviewAt
  }

  if (freshness.verificationTier) {
    other['findmydoc:verification_tier'] = freshness.verificationTier
  }

  if (freshness.sourceCollections.length > 0) {
    other['findmydoc:freshness_sources'] = freshness.sourceCollections.join(',')
  }

  return Object.keys(other).length > 0 ? { other } : {}
}

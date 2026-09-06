'use client'

import React from 'react'

import { CacheRevalidationVisibilityCardView } from '@/components/organisms/CacheRevalidationVisibility/CacheRevalidationVisibilityCardView'
import type {
  CacheRevalidationEventViewModel,
  CacheRevalidationVisibilityViewModel,
} from '@/features/adminDashboard/cacheRevalidationViewModel'

const readRecord = (value: unknown): Record<string, unknown> | null => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

const readString = (value: unknown): string | null => {
  return typeof value === 'string' ? value : null
}

const readNumber = (value: unknown): number | null => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const readStringArray = (value: unknown): string[] | null => {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? [...value] : null
}

const toEventViewModel = (value: unknown): CacheRevalidationEventViewModel | null => {
  const event = readRecord(value)
  const source = readRecord(event?.source)
  const subject = readRecord(event?.subject)
  const failures = Array.isArray(event?.failuresPreview) ? event.failuresPreview : null
  const cacheClasses = readStringArray(event?.cacheClasses)
  const surfaceIds = readStringArray(event?.surfaceIds)
  const tagsPreview = readStringArray(event?.tagsPreview)
  const pathsPreview = readStringArray(event?.pathsPreview)

  if (!event || !source || !subject || !failures || !cacheClasses || !surfaceIds || !tagsPreview || !pathsPreview) {
    return null
  }

  const id = readString(event.id)
  const timestamp = readString(event.timestamp)
  const eventName = readString(event.event)
  const operation = readString(event.operation)
  const sourceKind = readString(source.kind)
  const subjectKind = readString(subject.kind)
  const tagCount = readNumber(event.tagCount)
  const pathCount = readNumber(event.pathCount)
  const failureCount = readNumber(event.failureCount)
  const failuresPreview = failures.flatMap((failure) => {
    const candidate = readRecord(failure)
    const kind: 'tag' | 'path' | null = candidate?.kind === 'tag' || candidate?.kind === 'path' ? candidate.kind : null
    const identifier = readString(candidate?.identifier)
    return kind && identifier ? [{ kind, identifier, message: 'redacted' as const }] : []
  })

  if (
    !id ||
    !timestamp ||
    !eventName ||
    !operation ||
    !sourceKind ||
    !subjectKind ||
    tagCount === null ||
    pathCount === null ||
    failureCount === null ||
    failuresPreview.length !== failures.length ||
    typeof event.tagsTruncated !== 'boolean' ||
    typeof event.pathsTruncated !== 'boolean' ||
    typeof event.failuresTruncated !== 'boolean'
  ) {
    return null
  }

  const sourceId = readString(source.id)
  const subjectId = readString(subject.id)
  const subjectCollection = readString(subject.collection)
  const subjectGlobal = readString(subject.global)
  const emptyReason = readString(event.emptyReason)

  return {
    id,
    timestamp,
    event: eventName,
    operation,
    source: {
      kind: sourceKind,
      ...(sourceId ? { id: sourceId } : {}),
    },
    subject: {
      kind: subjectKind,
      ...(subjectId ? { id: subjectId } : {}),
      ...(subjectCollection ? { collection: subjectCollection } : {}),
      ...(subjectGlobal ? { global: subjectGlobal } : {}),
    },
    cacheClasses,
    surfaceIds,
    tagCount,
    pathCount,
    failureCount,
    tagsPreview,
    pathsPreview,
    failuresPreview,
    tagsTruncated: event.tagsTruncated,
    pathsTruncated: event.pathsTruncated,
    failuresTruncated: event.failuresTruncated,
    ...(emptyReason ? { emptyReason } : {}),
  }
}

const toVisibilityViewModel = (value: unknown): CacheRevalidationVisibilityViewModel | null => {
  const candidate = readRecord(value)
  if (!candidate || !Array.isArray(candidate.events)) return null

  const limit = readNumber(candidate.limit)
  const count = readNumber(candidate.count)
  const totalRecorded = readNumber(candidate.totalRecorded)
  const droppedOldestCount = readNumber(candidate.droppedOldestCount)
  const events = candidate.events.map(toEventViewModel)

  if (
    limit === null ||
    count === null ||
    totalRecorded === null ||
    droppedOldestCount === null ||
    events.some((event) => event === null)
  ) {
    return null
  }

  return {
    limit,
    count,
    totalRecorded,
    droppedOldestCount,
    events: events as CacheRevalidationEventViewModel[],
  }
}

export const CacheRevalidationVisibilityWidget: React.FC = () => {
  const [snapshot, setSnapshot] = React.useState<CacheRevalidationVisibilityViewModel | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [accessDenied, setAccessDenied] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const loadVisibility = React.useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/cache-revalidation/visibility', { credentials: 'include' })
      if (response.status === 403) {
        setSnapshot(null)
        setAccessDenied(true)
        return
      }

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`.trim())
      }

      const data = (await response.json()) as unknown
      const viewModel = toVisibilityViewModel(data)
      if (!viewModel) {
        throw new Error('Unexpected response')
      }

      setAccessDenied(false)
      setSnapshot(viewModel)
    } catch (loadError: unknown) {
      setSnapshot(null)
      setAccessDenied(false)
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadVisibility()
  }, [loadVisibility])

  return (
    <CacheRevalidationVisibilityCardView
      accessDenied={accessDenied}
      error={error}
      loading={loading}
      snapshot={snapshot}
      onRefresh={() => {
        void loadVisibility()
      }}
    />
  )
}

export default CacheRevalidationVisibilityWidget

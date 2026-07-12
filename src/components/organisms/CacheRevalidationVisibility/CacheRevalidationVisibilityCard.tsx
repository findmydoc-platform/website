'use client'

import React from 'react'

import type { CacheRevalidationVisibilitySnapshot } from '@/utilities/cacheRevalidation/visibility'
import { CacheRevalidationVisibilityCardView } from './CacheRevalidationVisibilityCardView'

const isVisibilitySnapshot = (value: unknown): value is CacheRevalidationVisibilitySnapshot => {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Partial<Record<keyof CacheRevalidationVisibilitySnapshot, unknown>>

  return (
    typeof candidate.limit === 'number' &&
    typeof candidate.count === 'number' &&
    typeof candidate.totalRecorded === 'number' &&
    typeof candidate.droppedOldestCount === 'number' &&
    Array.isArray(candidate.events)
  )
}

export const CacheRevalidationVisibilityCard: React.FC = () => {
  const [snapshot, setSnapshot] = React.useState<CacheRevalidationVisibilitySnapshot | null>(null)
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
      if (!isVisibilitySnapshot(data)) {
        throw new Error('Unexpected response')
      }

      setAccessDenied(false)
      setSnapshot(data)
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

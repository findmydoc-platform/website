import { getCurrentIsoTimestampString } from '@/utilities/timestamps'
import { REVALIDATION_LOG_EVENTS, type RevalidationLogEventName } from './logPayload'

export const CACHE_REVALIDATION_VISIBILITY_LIMIT = 200
export const CACHE_REVALIDATION_VISIBILITY_PREVIEW_LIMIT = 10

type VisibilitySource = {
  readonly kind: string
  readonly id?: string
}

type VisibilitySubject = {
  readonly kind: string
  readonly id?: string
  readonly collection?: string
  readonly global?: string
}

export type CacheRevalidationVisibilityFailureSummary = {
  readonly kind: 'tag' | 'path'
  readonly identifier: string
  readonly message: 'redacted'
}

export type CacheRevalidationVisibilityEvent = {
  readonly id: string
  readonly timestamp: string
  readonly event: RevalidationLogEventName
  readonly operation: string
  readonly source: VisibilitySource
  readonly subject: VisibilitySubject
  readonly cacheClasses: readonly string[]
  readonly surfaceIds: readonly string[]
  readonly tagCount: number
  readonly pathCount: number
  readonly failureCount: number
  readonly tagsPreview: readonly string[]
  readonly pathsPreview: readonly string[]
  readonly failuresPreview: readonly CacheRevalidationVisibilityFailureSummary[]
  readonly tagsTruncated: boolean
  readonly pathsTruncated: boolean
  readonly failuresTruncated: boolean
  readonly emptyReason?: string
}

export type CacheRevalidationVisibilitySnapshot = {
  readonly limit: number
  readonly count: number
  readonly totalRecorded: number
  readonly droppedOldestCount: number
  readonly events: readonly CacheRevalidationVisibilityEvent[]
}

const EVENT_NAMES = new Set<RevalidationLogEventName>(Object.values(REVALIDATION_LOG_EVENTS))

let events: CacheRevalidationVisibilityEvent[] = []
let totalRecorded = 0

const readRecord = (value: unknown): Record<string, unknown> | null => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

const readString = (value: unknown, maxLength = 160): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0) return undefined
  return trimmed.slice(0, maxLength)
}

const readNumber = (value: unknown): number => {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0
}

const readStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => readString(entry, 200))
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, CACHE_REVALIDATION_VISIBILITY_PREVIEW_LIMIT)
}

const readFailureSummaries = (value: unknown): CacheRevalidationVisibilityFailureSummary[] => {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => {
      const record = readRecord(entry)
      if (!record) return null
      const kind = record.kind === 'tag' || record.kind === 'path' ? record.kind : null
      const identifier = readString(record.identifier, 200)
      if (!kind || !identifier) return null

      return {
        kind,
        identifier,
        message: 'redacted',
      } satisfies CacheRevalidationVisibilityFailureSummary
    })
    .filter((entry): entry is CacheRevalidationVisibilityFailureSummary => Boolean(entry))
    .slice(0, CACHE_REVALIDATION_VISIBILITY_PREVIEW_LIMIT)
}

export const recordCacheRevalidationVisibilityFromLogPayload = (
  payload: Record<string, unknown>,
  now: () => string = getCurrentIsoTimestampString,
): CacheRevalidationVisibilityEvent | null => {
  const eventName = readString(payload.event)
  if (!eventName || !EVENT_NAMES.has(eventName as RevalidationLogEventName)) return null

  const source = readRecord(payload.source)
  const subject = readRecord(payload.subject)
  const sourceKind = readString(source?.kind) ?? 'unknown'
  const subjectKind = readString(subject?.kind) ?? 'unknown'

  totalRecorded += 1
  const timestamp = now()
  const event = {
    id: `${timestamp}-${totalRecorded}`,
    timestamp,
    event: eventName as RevalidationLogEventName,
    operation: readString(payload.operation) ?? 'unknown',
    source: {
      kind: sourceKind,
      ...(readString(source?.id) ? { id: readString(source?.id) } : {}),
    },
    subject: {
      kind: subjectKind,
      ...(readString(subject?.id) ? { id: readString(subject?.id) } : {}),
      ...(readString(subject?.collection) ? { collection: readString(subject?.collection) } : {}),
      ...(readString(subject?.global) ? { global: readString(subject?.global) } : {}),
    },
    cacheClasses: readStringArray(payload.cacheClasses),
    surfaceIds: readStringArray(payload.surfaceIds),
    tagCount: readNumber(payload.tagCount),
    pathCount: readNumber(payload.pathCount),
    failureCount: readNumber(payload.failureCount),
    tagsPreview: readStringArray(payload.tagsPreview),
    pathsPreview: readStringArray(payload.pathsPreview),
    failuresPreview: readFailureSummaries(payload.failuresPreview),
    tagsTruncated: payload.tagsTruncated === true,
    pathsTruncated: payload.pathsTruncated === true,
    failuresTruncated: payload.failuresTruncated === true,
    ...(readString(payload.emptyReason) ? { emptyReason: readString(payload.emptyReason) } : {}),
  } satisfies CacheRevalidationVisibilityEvent

  events.push(event)
  if (events.length > CACHE_REVALIDATION_VISIBILITY_LIMIT) {
    events = events.slice(events.length - CACHE_REVALIDATION_VISIBILITY_LIMIT)
  }

  return event
}

export const getCacheRevalidationVisibilitySnapshot = (): CacheRevalidationVisibilitySnapshot => {
  const visibleEvents = events.slice().reverse()

  return {
    limit: CACHE_REVALIDATION_VISIBILITY_LIMIT,
    count: visibleEvents.length,
    totalRecorded,
    droppedOldestCount: Math.max(0, totalRecorded - visibleEvents.length),
    events: visibleEvents,
  }
}

export const resetCacheRevalidationVisibilityForTests = (): void => {
  events = []
  totalRecorded = 0
}

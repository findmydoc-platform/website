export type CacheRevalidationFailureViewModel = {
  kind: 'tag' | 'path'
  identifier: string
  message: 'redacted'
}

export type CacheRevalidationEventViewModel = {
  id: string
  timestamp: string
  event: string
  operation: string
  source: {
    kind: string
    id?: string
  }
  subject: {
    kind: string
    id?: string
    collection?: string
    global?: string
  }
  cacheClasses: string[]
  surfaceIds: string[]
  tagCount: number
  pathCount: number
  failureCount: number
  tagsPreview: string[]
  pathsPreview: string[]
  failuresPreview: CacheRevalidationFailureViewModel[]
  tagsTruncated: boolean
  pathsTruncated: boolean
  failuresTruncated: boolean
  emptyReason?: string
}

export type CacheRevalidationVisibilityViewModel = {
  limit: number
  count: number
  totalRecorded: number
  droppedOldestCount: number
  events: CacheRevalidationEventViewModel[]
}

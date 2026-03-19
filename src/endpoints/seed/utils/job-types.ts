import type { CollectionSlug } from 'payload'
import type { RelationMapping } from './import-collection'
import type { SeedType } from './runtime'

export type SeedQueueJobKind = 'reset' | 'globals' | 'collection'

export type SeedQueueJobInput = {
  runId: string
  type: SeedType
  reset: boolean
  queue: string
  title?: string
  stepName: string
  kind: SeedQueueJobKind
  collection?: CollectionSlug
  fileName?: string
  mapping?: RelationMapping[]
  context?: Record<string, unknown>
  reqUserStableId?: string
  requiresPlatformUser?: boolean
  stableIds?: string[]
  chunkIndex?: number
  chunkTotal?: number
}

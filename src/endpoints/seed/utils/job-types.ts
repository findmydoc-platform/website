import type { CollectionSlug } from 'payload'
import type { RelationMapping } from './import-collection'
import type { SeedType } from './runtime'
import type { SeedUpsertPolicy } from './upsert'

export type SeedQueueJobKind = 'reset' | 'globals' | 'collection'

export type SeedQueueJobInput = {
  runId: string
  type: SeedType
  reset: boolean
  queue: string
  title?: string
  stepName: string
  kind: SeedQueueJobKind
  atomicGroup?: string
  collection?: CollectionSlug
  fileName?: string
  mapping?: RelationMapping[]
  context?: Record<string, unknown>
  localizedFields?: string[]
  reqUserStableId?: string
  requiresPlatformUser?: boolean
  upsertPolicy?: SeedUpsertPolicy
  stableIds?: string[]
  chunkIndex?: number
  chunkTotal?: number
}

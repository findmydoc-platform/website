import type { CacheClass, CacheOperation } from '@/utilities/cachePolicy'

export type PublicDocumentStatus = 'draft' | 'published'

export type CoreCollectionRevalidationCollection = 'pages' | 'posts'

export type CoreGlobalRevalidationSlug = 'header' | 'footer' | 'landingPages' | 'cookieConsent'

export type RevalidationSourceKind =
  | 'payload-hook'
  | 'global-hook'
  | 'redirect-hook'
  | 'public-discovery'
  | 'seed-runner'
  | 'test'

export interface RevalidationSource {
  readonly kind: RevalidationSourceKind
  readonly id?: string | number
  readonly correlationId?: string
}

export interface CollectionRevalidationSubject {
  readonly kind: 'collection'
  readonly collection: CoreCollectionRevalidationCollection
  readonly id: string | number
  readonly slug: string
  readonly previousSlug?: string
  readonly status: PublicDocumentStatus
  readonly previousStatus?: PublicDocumentStatus
}

export interface GlobalRevalidationSubject {
  readonly kind: 'global'
  readonly global: CoreGlobalRevalidationSlug
}

export interface RedirectRevalidationSubject {
  readonly kind: 'redirects'
  readonly id?: string | number
}

export interface PrivateLiveRevalidationSubject {
  readonly kind: 'private-live'
  readonly surfaceId?: string
}

export interface DeferredRevalidationSubject {
  readonly kind: 'deferred'
  readonly area: DeferredRevalidationArea
  readonly id?: string | number
}

export type RevalidationSubject =
  | CollectionRevalidationSubject
  | GlobalRevalidationSubject
  | RedirectRevalidationSubject
  | PrivateLiveRevalidationSubject
  | DeferredRevalidationSubject

export interface CollectionRevalidationEvent {
  readonly kind: 'collection'
  readonly collection: CoreCollectionRevalidationCollection
  readonly operation: Extract<CacheOperation, 'publish' | 'update' | 'unpublish' | 'delete' | 'slug-change'>
  readonly source: RevalidationSource
  readonly subject: Omit<CollectionRevalidationSubject, 'kind' | 'collection'>
}

export interface GlobalRevalidationEvent {
  readonly kind: 'global'
  readonly global: CoreGlobalRevalidationSlug
  readonly operation: Extract<CacheOperation, 'global-update'>
  readonly source: RevalidationSource
}

export interface RedirectRevalidationEvent {
  readonly kind: 'redirects'
  readonly operation: Extract<CacheOperation, 'publish' | 'update' | 'unpublish' | 'delete'>
  readonly source: RevalidationSource
  readonly subject: Omit<RedirectRevalidationSubject, 'kind'>
}

export interface PrivateLiveRevalidationEvent {
  readonly kind: 'private-live'
  readonly operation: Extract<CacheOperation, 'preview-read'>
  readonly source: RevalidationSource
  readonly subject: Omit<PrivateLiveRevalidationSubject, 'kind'>
}

export type DeferredRevalidationArea =
  | 'clinic-listing'
  | 'public-discovery'
  | 'seed-bulk'
  | 'media-dependency'
  | 'observability'

export interface DeferredRevalidationEvent {
  readonly kind: 'deferred'
  readonly area: DeferredRevalidationArea
  readonly operation: Extract<CacheOperation, 'related-update' | 'seed-final-flush' | 'update'>
  readonly source: RevalidationSource
  readonly subject?: Omit<DeferredRevalidationSubject, 'kind' | 'area'>
}

export type RevalidationEvent =
  | CollectionRevalidationEvent
  | GlobalRevalidationEvent
  | RedirectRevalidationEvent
  | PrivateLiveRevalidationEvent
  | DeferredRevalidationEvent

export interface RevalidationLogContext {
  readonly operation: CacheOperation
  readonly sourceKind: RevalidationSourceKind
  readonly sourceId?: string
  readonly correlationId?: string
  readonly subjectKind: RevalidationSubject['kind']
  readonly subjectId?: string
  readonly collection?: CoreCollectionRevalidationCollection
  readonly global?: CoreGlobalRevalidationSlug
  readonly cacheClasses: readonly CacheClass[]
  readonly surfaceIds: readonly string[]
  readonly tagCount: number
  readonly pathCount: number
}

export interface RevalidationPlan {
  readonly operation: CacheOperation
  readonly source: RevalidationSource
  readonly subject: RevalidationSubject
  readonly cacheClasses: readonly CacheClass[]
  readonly surfaceIds: readonly string[]
  readonly tags: readonly string[]
  readonly paths: readonly string[]
  readonly logContext: RevalidationLogContext
  readonly emptyReason?: 'private-live-noop'
}

export interface RevalidationFailure {
  readonly kind: 'tag' | 'path'
  readonly identifier: string
  readonly message: string
}

export interface RevalidationExecutionResult {
  readonly operation: CacheOperation
  readonly source: RevalidationSource
  readonly subject: RevalidationSubject
  readonly attempted: {
    readonly tagCount: number
    readonly pathCount: number
  }
  readonly succeeded: {
    readonly tagCount: number
    readonly pathCount: number
  }
  readonly failed: {
    readonly tagCount: number
    readonly pathCount: number
  }
  readonly failures: readonly RevalidationFailure[]
}

export interface RevalidationLogger {
  readonly info?: (payload: Record<string, unknown>, message?: string) => void
  readonly warn?: (payload: Record<string, unknown>, message?: string) => void
  readonly error?: (payload: Record<string, unknown>, message?: string) => void
}

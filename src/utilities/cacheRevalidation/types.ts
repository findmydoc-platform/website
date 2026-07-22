import type {
  CacheClass,
  CacheDiscoveryId,
  CacheOperation,
  CachePolicyGlobal,
  CacheSitemapId,
  CacheTaggableCollection,
  CacheTaggableSurfaceId,
} from '@/utilities/cachePolicy'

export type PublicDocumentStatus = 'draft' | 'published'

export type CoreCollectionRevalidationCollection = 'pages' | 'posts'

export type CoreGlobalRevalidationSlug = 'header' | 'footer' | 'landingPages' | 'cookieConsent'

export type ClinicSurfaceRevalidationCollection =
  | 'clinics'
  | 'clinictreatments'
  | 'doctors'
  | 'doctorspecialties'
  | 'reviews'
  | 'treatments'
  | 'medical-specialties'
  | 'cities'
  | 'accreditation'

export type ClinicPublicStatus = 'draft' | 'pending' | 'approved' | 'rejected'

export type ReviewPublicStatus = 'pending' | 'approved' | 'rejected'

export type ClinicSurfacePublicStatus = ClinicPublicStatus | ReviewPublicStatus | 'public'

export type RevalidationSourceKind =
  'payload-hook' | 'global-hook' | 'redirect-hook' | 'public-discovery' | 'seed-runner' | 'test'

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

export interface ClinicSurfaceRevalidationSubject {
  readonly kind: 'clinic-surface'
  readonly collection: ClinicSurfaceRevalidationCollection
  readonly id: string | number
  readonly slug?: string
  readonly previousSlug?: string
  readonly status?: ClinicSurfacePublicStatus
  readonly previousStatus?: ClinicSurfacePublicStatus
  readonly clinicIds?: readonly (string | number)[]
  readonly clinicSlugs?: readonly string[]
  readonly previousClinicIds?: readonly (string | number)[]
  readonly previousClinicSlugs?: readonly string[]
}

export interface PrivateLiveRevalidationSubject {
  readonly kind: 'private-live'
  readonly surfaceId?: string
}

export interface SitemapRevalidationSubject {
  readonly kind: 'sitemap'
  readonly sitemapId: CacheSitemapId
}

export interface PostsListRevalidationSubject {
  readonly kind: 'posts-list'
}

export interface PublicDiscoveryRevalidationSubject {
  readonly kind: 'public-discovery'
  readonly discoveryId: CacheDiscoveryId
}

export interface SeedFinalFlushRevalidationSubject {
  readonly kind: 'seed-final-flush'
  readonly runId: string
  readonly seedType: 'baseline' | 'demo'
  readonly reset: boolean
  readonly terminalStatus: 'completed' | 'partial' | 'failed' | 'cancelled'
  readonly affectedCollections: readonly CacheTaggableCollection[]
  readonly affectedGlobals: readonly CachePolicyGlobal[]
  readonly affectedSurfaces: readonly CacheTaggableSurfaceId[]
  readonly affectedSitemaps: readonly CacheSitemapId[]
  readonly affectedDiscovery: readonly CacheDiscoveryId[]
  readonly affectedPostSlugs: readonly string[]
  readonly completedJobCount: number
  readonly publicJobCount: number
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
  | ClinicSurfaceRevalidationSubject
  | PrivateLiveRevalidationSubject
  | SitemapRevalidationSubject
  | PostsListRevalidationSubject
  | PublicDiscoveryRevalidationSubject
  | SeedFinalFlushRevalidationSubject
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

export interface ClinicSurfaceRevalidationEvent {
  readonly kind: 'clinic-surface'
  readonly collection: ClinicSurfaceRevalidationCollection
  readonly operation: Extract<
    CacheOperation,
    'publish' | 'update' | 'unpublish' | 'delete' | 'slug-change' | 'related-update'
  >
  readonly source: RevalidationSource
  readonly subject: Omit<ClinicSurfaceRevalidationSubject, 'kind' | 'collection'>
}

export interface PrivateLiveRevalidationEvent {
  readonly kind: 'private-live'
  readonly operation: Extract<CacheOperation, 'preview-read'>
  readonly source: RevalidationSource
  readonly subject: Omit<PrivateLiveRevalidationSubject, 'kind'>
}

export interface SitemapRevalidationEvent {
  readonly kind: 'sitemap'
  readonly operation: Extract<CacheOperation, 'update'>
  readonly source: RevalidationSource
  readonly subject: Omit<SitemapRevalidationSubject, 'kind'>
}

export interface PostsListRevalidationEvent {
  readonly kind: 'posts-list'
  readonly operation: Extract<CacheOperation, 'update'>
  readonly source: RevalidationSource
}

export interface PublicDiscoveryRevalidationEvent {
  readonly kind: 'public-discovery'
  readonly operation: Extract<CacheOperation, 'update'>
  readonly source: RevalidationSource
  readonly subject: Omit<PublicDiscoveryRevalidationSubject, 'kind'>
}

export interface SeedFinalFlushRevalidationEvent {
  readonly kind: 'seed-final-flush'
  readonly operation: Extract<CacheOperation, 'seed-final-flush'>
  readonly source: RevalidationSource
  readonly subject: Omit<SeedFinalFlushRevalidationSubject, 'kind'>
}

export type DeferredRevalidationArea =
  'clinic-listing' | 'public-discovery' | 'seed-bulk' | 'media-dependency' | 'observability'

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
  | ClinicSurfaceRevalidationEvent
  | PrivateLiveRevalidationEvent
  | SitemapRevalidationEvent
  | PostsListRevalidationEvent
  | PublicDiscoveryRevalidationEvent
  | SeedFinalFlushRevalidationEvent
  | DeferredRevalidationEvent

export interface RevalidationLogContext {
  readonly operation: CacheOperation
  readonly sourceKind: RevalidationSourceKind
  readonly sourceId?: string
  readonly correlationId?: string
  readonly subjectKind: RevalidationSubject['kind']
  readonly subjectId?: string
  readonly collection?: CoreCollectionRevalidationCollection | ClinicSurfaceRevalidationCollection
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
  readonly emptyReason?: 'private-live-noop' | 'static-public-discovery-noop' | 'seed-final-flush-noop'
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

import {
  buildCollectionTag,
  buildClinicPath,
  buildDiscoveryTag,
  buildEntityTag,
  buildFixedPublicPath,
  buildGlobalTag,
  buildPagePath,
  buildPostPath,
  buildPostsIndexPath,
  buildSitemapPath,
  buildSitemapTag,
  buildSlugTag,
  buildSurfaceInstanceTag,
  buildSurfaceTag,
  getCachePolicyEntry,
} from '@/utilities/cachePolicy'
import type {
  ClinicSurfacePublicStatus,
  ClinicSurfaceRevalidationCollection,
  ClinicSurfaceRevalidationEvent,
  CollectionRevalidationEvent,
  CoreCollectionRevalidationCollection,
  CoreGlobalRevalidationSlug,
  DeferredRevalidationEvent,
  GlobalRevalidationEvent,
  PrivateLiveRevalidationEvent,
  PostsListRevalidationEvent,
  PublicDiscoveryRevalidationEvent,
  RedirectRevalidationEvent,
  RevalidationEvent,
  RevalidationLogContext,
  RevalidationPlan,
  RevalidationSource,
  RevalidationSubject,
  SeedFinalFlushRevalidationEvent,
  SitemapRevalidationEvent,
} from './types'

export class DeferredRevalidationError extends Error {
  constructor(area: string) {
    super(`Revalidation area is deferred for a later cache-stack PR: ${area}`)
    this.name = 'DeferredRevalidationError'
  }
}

export class UnsupportedRevalidationEventError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsupportedRevalidationEventError'
  }
}

const PUBLIC_STATUS = 'published'
const APPROVED_CLINIC_STATUS = 'approved'
const APPROVED_REVIEW_STATUS = 'approved'
const PUBLISHED_GALLERY_STATUS = 'published'

const unique = <Value extends string>(values: readonly Value[]): Value[] => [...new Set(values)]

const normalizeRequiredText = (value: string | number | undefined, label: string): string => {
  const normalized = typeof value === 'undefined' ? '' : String(value).trim()

  if (!normalized) {
    throw new UnsupportedRevalidationEventError(`Missing required ${label}`)
  }

  return normalized
}

const normalizeOptionalText = (value: string | number | undefined): string | undefined => {
  if (typeof value === 'undefined') return undefined
  const normalized = String(value).trim()
  return normalized || undefined
}

const normalizeOptionalTextArray = (values: readonly (string | number)[] | undefined): string[] => {
  if (!values) return []

  return values.map((value) => normalizeRequiredText(value, 'array item')).filter(Boolean)
}

const normalizeSource = (source: RevalidationSource): RevalidationSource => ({
  kind: source.kind,
  ...(typeof source.id !== 'undefined' ? { id: normalizeRequiredText(source.id, 'source id') } : {}),
  ...(source.correlationId ? { correlationId: normalizeRequiredText(source.correlationId, 'correlation id') } : {}),
})

const buildLogContext = ({
  cacheClasses,
  paths,
  source,
  subject,
  surfaceIds,
  tags,
  operation,
}: Pick<
  RevalidationPlan,
  'cacheClasses' | 'paths' | 'source' | 'subject' | 'surfaceIds' | 'tags' | 'operation'
>): RevalidationLogContext => ({
  operation,
  sourceKind: source.kind,
  ...(typeof source.id !== 'undefined' ? { sourceId: String(source.id) } : {}),
  ...(source.correlationId ? { correlationId: source.correlationId } : {}),
  subjectKind: subject.kind,
  ...('id' in subject && typeof subject.id !== 'undefined' ? { subjectId: String(subject.id) } : {}),
  ...(subject.kind === 'seed-final-flush' ? { subjectId: subject.runId } : {}),
  ...(subject.kind === 'collection' ? { collection: subject.collection } : {}),
  ...(subject.kind === 'global' ? { global: subject.global } : {}),
  cacheClasses,
  surfaceIds,
  tagCount: tags.length,
  pathCount: paths.length,
})

const createPlan = ({
  cacheClasses,
  emptyReason,
  operation,
  paths,
  source,
  subject,
  surfaceIds,
  tags,
}: Omit<RevalidationPlan, 'logContext'>): RevalidationPlan => {
  const normalizedTags = unique(tags)
  const normalizedPaths = unique(paths)
  const normalizedSurfaceIds = unique(surfaceIds)
  const normalizedCacheClasses = unique(cacheClasses)

  const plan = {
    operation,
    source: normalizeSource(source),
    subject,
    cacheClasses: normalizedCacheClasses,
    surfaceIds: normalizedSurfaceIds,
    tags: normalizedTags,
    paths: normalizedPaths,
    ...(emptyReason ? { emptyReason } : {}),
  } satisfies Omit<RevalidationPlan, 'logContext'>

  return {
    ...plan,
    logContext: buildLogContext(plan),
  }
}

const assertRedirectPolicySupported = () => {
  const redirectsPolicy = getCachePolicyEntry('collection:redirects')

  if (!redirectsPolicy.collections?.includes('redirects') || !redirectsPolicy.tagFamilies.includes('collection')) {
    throw new UnsupportedRevalidationEventError('Canonical redirect cache policy is not available')
  }
}

const isPublicNow = (event: CollectionRevalidationEvent): boolean => {
  return event.subject.status === PUBLIC_STATUS && event.operation !== 'unpublish' && event.operation !== 'delete'
}

const wasPublicBefore = (event: CollectionRevalidationEvent): boolean => {
  if (event.subject.previousStatus) {
    return event.subject.previousStatus === PUBLIC_STATUS
  }

  if (event.operation === 'delete' || event.operation === 'unpublish') {
    throw new UnsupportedRevalidationEventError(
      `Missing required previous status for ${event.operation} ${event.collection} event`,
    )
  }

  return false
}

const buildDocumentPath = (collection: CoreCollectionRevalidationCollection, slug: string): string => {
  switch (collection) {
    case 'pages':
      return buildPagePath(slug)
    case 'posts':
      return buildPostPath(slug)
  }
}

const buildCollectionPlan = (event: CollectionRevalidationEvent): RevalidationPlan => {
  const { collection, operation } = event
  const id = normalizeRequiredText(event.subject.id, 'subject id')
  const slug = normalizeRequiredText(event.subject.slug, 'subject slug')
  const previousSlug = normalizeOptionalText(event.subject.previousSlug)

  if (!event.subject.status) {
    throw new UnsupportedRevalidationEventError('Missing required subject status')
  }

  const subject = {
    kind: 'collection',
    collection,
    id,
    slug,
    ...(previousSlug ? { previousSlug } : {}),
    status: event.subject.status,
    ...(event.subject.previousStatus ? { previousStatus: event.subject.previousStatus } : {}),
  } satisfies RevalidationSubject

  const publicNow = isPublicNow(event)
  const publicBefore = wasPublicBefore(event)

  if (!publicNow && !publicBefore) {
    return createPlan({
      operation,
      source: event.source,
      subject: { kind: 'private-live' },
      cacheClasses: ['private-live'],
      surfaceIds: [],
      tags: [],
      paths: [],
      emptyReason: 'private-live-noop',
    })
  }

  const tags = [buildEntityTag(collection, id), buildCollectionTag(collection)]
  const paths: string[] = []
  const surfaceIds: string[] = []
  const cacheClasses = ['critical-public', 'aggregated-public'] as const

  if (publicNow) {
    tags.push(buildSlugTag(collection, slug))
  }

  if (publicBefore) {
    const staleSlug = previousSlug ?? slug
    tags.push(buildSlugTag(collection, staleSlug))
  }

  if (publicNow) {
    paths.push(buildDocumentPath(collection, slug))
  }

  if (publicBefore) {
    const staleSlug = previousSlug ?? slug
    paths.push(buildDocumentPath(collection, staleSlug))
  }

  if (collection === 'pages') {
    tags.push(buildSitemapTag('pages'))
    surfaceIds.push('page-detail', 'surface:sitemap:pages')
  }

  if (collection === 'posts') {
    tags.push(
      buildSitemapTag('posts'),
      buildSurfaceTag('posts-list'),
      buildSurfaceTag('home'),
      buildSurfaceTag('partners-clinics'),
    )
    paths.push(buildPostsIndexPath())
    surfaceIds.push('post-detail', 'posts-list', 'home', 'partners-clinics', 'surface:sitemap:posts')
  }

  return createPlan({
    operation,
    source: event.source,
    subject,
    cacheClasses,
    surfaceIds,
    tags,
    paths,
  })
}

const isClinicDocumentPublicNow = (event: ClinicSurfaceRevalidationEvent): boolean => {
  return (
    event.collection === 'clinics' &&
    event.subject.status === APPROVED_CLINIC_STATUS &&
    event.operation !== 'unpublish' &&
    event.operation !== 'delete'
  )
}

const wasClinicDocumentPublicBefore = (event: ClinicSurfaceRevalidationEvent): boolean => {
  if (event.collection !== 'clinics') return false

  if (event.subject.previousStatus) {
    return event.subject.previousStatus === APPROVED_CLINIC_STATUS
  }

  if (event.operation === 'delete' || event.operation === 'unpublish') {
    throw new UnsupportedRevalidationEventError(
      `Missing required previous status for ${event.operation} clinic surface event`,
    )
  }

  return false
}

const isPublicRelatedEvent = (event: ClinicSurfaceRevalidationEvent): boolean => {
  if (event.collection === 'clinics') {
    return isClinicDocumentPublicNow(event) || wasClinicDocumentPublicBefore(event)
  }

  const status = event.subject.status
  const previousStatus = event.subject.previousStatus

  switch (event.collection) {
    case 'reviews':
      return status === APPROVED_REVIEW_STATUS || previousStatus === APPROVED_REVIEW_STATUS
    case 'clinicGalleryEntries':
      return status === PUBLISHED_GALLERY_STATUS || previousStatus === PUBLISHED_GALLERY_STATUS
    default:
      return true
  }
}

const buildClinicDocumentPlan = (event: ClinicSurfaceRevalidationEvent): RevalidationPlan => {
  const id = normalizeRequiredText(event.subject.id, 'clinic id')
  const slug = normalizeRequiredText(event.subject.slug, 'clinic slug')
  const previousSlug = normalizeOptionalText(event.subject.previousSlug)

  if (!event.subject.status) {
    throw new UnsupportedRevalidationEventError('Missing required clinic status')
  }

  const publicNow = isClinicDocumentPublicNow(event)
  const publicBefore = wasClinicDocumentPublicBefore(event)

  if (!publicNow && !publicBefore) {
    return createPlan({
      operation: event.operation,
      source: event.source,
      subject: { kind: 'private-live' },
      cacheClasses: ['private-live'],
      surfaceIds: [],
      tags: [],
      paths: [],
      emptyReason: 'private-live-noop',
    })
  }

  const tags = [
    buildEntityTag('clinics', id),
    buildCollectionTag('clinics'),
    buildSurfaceTag('clinic-detail'),
    buildSurfaceInstanceTag('clinic-detail', id),
    buildSurfaceTag('listing-comparison'),
    buildSitemapTag('pages'),
  ]
  const paths: string[] = []

  if (publicNow) {
    tags.push(buildSlugTag('clinics', slug))
    paths.push(buildClinicPath(slug))
  }

  if (publicBefore) {
    const staleSlug = previousSlug ?? slug
    tags.push(buildSlugTag('clinics', staleSlug))
    paths.push(buildClinicPath(staleSlug))
  }

  return createPlan({
    operation: event.operation,
    source: event.source,
    subject: {
      kind: 'clinic-surface',
      collection: 'clinics',
      id,
      slug,
      ...(previousSlug ? { previousSlug } : {}),
      status: event.subject.status,
      ...(event.subject.previousStatus ? { previousStatus: event.subject.previousStatus } : {}),
    },
    cacheClasses: ['critical-public', 'aggregated-public'],
    surfaceIds: ['clinic-detail', 'listing-comparison', 'surface:sitemap:pages'],
    tags,
    paths,
  })
}

const CLINIC_DETAIL_RELATED_COLLECTIONS = [
  'clinictreatments',
  'doctors',
  'doctorspecialties',
  'reviews',
  'accreditation',
  'clinicGalleryEntries',
] as const satisfies readonly ClinicSurfaceRevalidationCollection[]

const LISTING_COMPARISON_COLLECTIONS = [
  'clinics',
  'clinictreatments',
  'reviews',
  'treatments',
  'medical-specialties',
  'cities',
] as const satisfies readonly ClinicSurfaceRevalidationCollection[]

const HOME_DEPENDENCY_COLLECTIONS = ['cities', 'medical-specialties'] as const
const PARTNER_DEPENDENCY_COLLECTIONS = ['treatments', 'medical-specialties'] as const

const includesCollection = <Collection extends string>(
  collections: readonly Collection[],
  collection: string,
): collection is Collection => collections.includes(collection as Collection)

const buildClinicSurfacePlan = (event: ClinicSurfaceRevalidationEvent): RevalidationPlan => {
  if (event.collection === 'clinics') {
    return buildClinicDocumentPlan(event)
  }

  if (!isPublicRelatedEvent(event)) {
    return createPlan({
      operation: event.operation,
      source: event.source,
      subject: { kind: 'private-live' },
      cacheClasses: ['private-live'],
      surfaceIds: [],
      tags: [],
      paths: [],
      emptyReason: 'private-live-noop',
    })
  }

  const collection = event.collection
  const id = normalizeRequiredText(event.subject.id, `${collection} id`)
  const clinicIds = normalizeOptionalTextArray(event.subject.clinicIds)
  const clinicSlugs = normalizeOptionalTextArray(event.subject.clinicSlugs)
  const previousClinicIds = normalizeOptionalTextArray(event.subject.previousClinicIds)
  const previousClinicSlugs = normalizeOptionalTextArray(event.subject.previousClinicSlugs)
  const allClinicIds = unique([...clinicIds, ...previousClinicIds])
  const allClinicSlugs = unique([...clinicSlugs, ...previousClinicSlugs])

  const tags = [buildEntityTag(collection, id), buildCollectionTag(collection)]
  const surfaceIds: string[] = []
  const paths: string[] = []

  if (includesCollection(CLINIC_DETAIL_RELATED_COLLECTIONS, collection)) {
    tags.push(buildSurfaceTag('clinic-detail'))
    surfaceIds.push('clinic-detail')

    for (const clinicId of allClinicIds) {
      tags.push(buildSurfaceInstanceTag('clinic-detail', clinicId))
    }

    for (const clinicSlug of allClinicSlugs) {
      tags.push(buildSlugTag('clinics', clinicSlug))
      paths.push(buildClinicPath(clinicSlug))
    }
  }

  if (includesCollection(LISTING_COMPARISON_COLLECTIONS, collection)) {
    tags.push(buildSurfaceTag('listing-comparison'), buildSitemapTag('pages'))
    surfaceIds.push('listing-comparison', 'surface:sitemap:pages')
  }

  if (includesCollection(HOME_DEPENDENCY_COLLECTIONS, collection)) {
    tags.push(buildSurfaceTag('home'))
    surfaceIds.push('home')
    paths.push(buildFixedPublicPath('home'))
  }

  if (includesCollection(PARTNER_DEPENDENCY_COLLECTIONS, collection)) {
    tags.push(buildSurfaceTag('partners-clinics'))
    surfaceIds.push('partners-clinics')
    paths.push(buildFixedPublicPath('partners-clinics'))
  }

  return createPlan({
    operation: event.operation,
    source: event.source,
    subject: {
      kind: 'clinic-surface',
      collection,
      id,
      ...(event.subject.slug ? { slug: normalizeRequiredText(event.subject.slug, `${collection} slug`) } : {}),
      ...(event.subject.previousSlug
        ? { previousSlug: normalizeRequiredText(event.subject.previousSlug, `${collection} previous slug`) }
        : {}),
      ...(event.subject.status ? { status: event.subject.status as ClinicSurfacePublicStatus } : {}),
      ...(event.subject.previousStatus
        ? { previousStatus: event.subject.previousStatus as ClinicSurfacePublicStatus }
        : {}),
      ...(clinicIds.length > 0 ? { clinicIds } : {}),
      ...(clinicSlugs.length > 0 ? { clinicSlugs } : {}),
      ...(previousClinicIds.length > 0 ? { previousClinicIds } : {}),
      ...(previousClinicSlugs.length > 0 ? { previousClinicSlugs } : {}),
    },
    cacheClasses: ['critical-public', 'aggregated-public'],
    surfaceIds,
    tags,
    paths,
  })
}

const buildGlobalPlan = (global: CoreGlobalRevalidationSlug, event: GlobalRevalidationEvent): RevalidationPlan => {
  const base = {
    operation: event.operation,
    source: event.source,
    subject: { kind: 'global', global } satisfies RevalidationSubject,
  }

  switch (global) {
    case 'header':
      return createPlan({
        ...base,
        cacheClasses: ['shared-public'],
        surfaceIds: ['public-chrome'],
        tags: [buildGlobalTag('header'), buildSurfaceTag('public-chrome')],
        paths: [],
      })
    case 'footer':
      return createPlan({
        ...base,
        cacheClasses: ['shared-public'],
        surfaceIds: ['public-chrome'],
        tags: [buildGlobalTag('footer'), buildSurfaceTag('public-chrome')],
        paths: [],
      })
    case 'cookieConsent':
      return createPlan({
        ...base,
        cacheClasses: ['shared-public'],
        surfaceIds: ['public-chrome'],
        tags: [buildGlobalTag('cookieConsent'), buildSurfaceTag('public-chrome')],
        paths: [],
      })
    case 'landingPages':
      return createPlan({
        ...base,
        cacheClasses: ['aggregated-public'],
        surfaceIds: ['home', 'about', 'partners-clinics', 'surface:sitemap:pages'],
        tags: [
          buildGlobalTag('landingPages'),
          buildSurfaceTag('home'),
          buildSurfaceTag('about'),
          buildSurfaceTag('partners-clinics'),
          buildSitemapTag('pages'),
        ],
        paths: [buildFixedPublicPath('home'), buildFixedPublicPath('about'), buildFixedPublicPath('partners-clinics')],
      })
  }
}

const buildRedirectPlan = (event: RedirectRevalidationEvent): RevalidationPlan => {
  assertRedirectPolicySupported()

  return createPlan({
    operation: event.operation,
    source: event.source,
    subject: {
      kind: 'redirects',
      ...('subject' in event && event.subject?.id
        ? { id: normalizeRequiredText(event.subject.id, 'redirect id') }
        : {}),
    } satisfies RevalidationSubject,
    cacheClasses: ['critical-public'],
    surfaceIds: ['redirects'],
    tags: [buildCollectionTag('redirects'), buildSurfaceTag('redirects')],
    paths: [],
  })
}

const buildPrivateLivePlan = (event: PrivateLiveRevalidationEvent): RevalidationPlan => {
  return createPlan({
    operation: event.operation,
    source: event.source,
    subject: {
      kind: 'private-live',
      ...('subject' in event && event.subject?.surfaceId ? { surfaceId: event.subject.surfaceId } : {}),
    } satisfies RevalidationSubject,
    cacheClasses: ['private-live'],
    surfaceIds: [],
    tags: [],
    paths: [],
    emptyReason: 'private-live-noop',
  })
}

const buildSitemapPlan = (event: SitemapRevalidationEvent): RevalidationPlan => {
  const sitemapId = normalizeRequiredText(event.subject.sitemapId, 'sitemap id')
  const sitemapSurfaceId = buildSitemapTag(sitemapId)

  return createPlan({
    operation: event.operation,
    source: event.source,
    subject: {
      kind: 'sitemap',
      sitemapId: sitemapId as SitemapRevalidationEvent['subject']['sitemapId'],
    },
    cacheClasses: ['aggregated-public'],
    surfaceIds: [sitemapSurfaceId],
    tags: [sitemapSurfaceId],
    paths: [],
  })
}

const buildPostsListPlan = (event: PostsListRevalidationEvent): RevalidationPlan => {
  return createPlan({
    operation: event.operation,
    source: event.source,
    subject: { kind: 'posts-list' },
    cacheClasses: ['aggregated-public'],
    surfaceIds: ['posts-list', 'home', 'partners-clinics', 'surface:sitemap:posts'],
    tags: [
      buildCollectionTag('posts'),
      buildSurfaceTag('posts-list'),
      buildSurfaceTag('home'),
      buildSurfaceTag('partners-clinics'),
      buildSitemapTag('posts'),
    ],
    paths: [buildPostsIndexPath()],
  })
}

const buildPublicDiscoveryPlan = (event: PublicDiscoveryRevalidationEvent): RevalidationPlan => {
  const discoveryId = normalizeRequiredText(event.subject.discoveryId, 'discovery id')
  const discoverySurfaceId = buildDiscoveryTag(discoveryId)

  return createPlan({
    operation: event.operation,
    source: event.source,
    subject: {
      kind: 'public-discovery',
      discoveryId: discoveryId as PublicDiscoveryRevalidationEvent['subject']['discoveryId'],
    },
    cacheClasses: ['aggregated-public'],
    surfaceIds: [discoverySurfaceId],
    tags: [],
    paths: [],
    emptyReason: 'static-public-discovery-noop',
  })
}

const buildSeedFinalFlushPlan = (event: SeedFinalFlushRevalidationEvent): RevalidationPlan => {
  const runId = normalizeRequiredText(event.subject.runId, 'seed run id')
  const collections = unique(
    event.subject.affectedCollections.map((collection) => normalizeRequiredText(collection, 'collection')),
  )
  const globals = unique(event.subject.affectedGlobals.map((global) => normalizeRequiredText(global, 'global')))
  const surfaces = unique(event.subject.affectedSurfaces.map((surface) => normalizeRequiredText(surface, 'surface')))
  const sitemaps = unique(event.subject.affectedSitemaps.map((sitemap) => normalizeRequiredText(sitemap, 'sitemap')))
  const discovery = unique(
    event.subject.affectedDiscovery.map((discoveryId) => normalizeRequiredText(discoveryId, 'discovery')),
  )
  const tags = [
    ...collections.map((collection) => buildCollectionTag(collection)),
    ...globals.map((global) => buildGlobalTag(global)),
    ...surfaces.map((surface) => buildSurfaceTag(surface)),
    ...sitemaps.map((sitemap) => buildSitemapTag(sitemap)),
    ...discovery.map((discoveryId) => buildDiscoveryTag(discoveryId)),
  ]
  const paths = [
    ...surfaces.flatMap((surface) => {
      if (surface === 'posts-list') {
        return [buildPostsIndexPath()]
      }

      try {
        return [buildFixedPublicPath(surface)]
      } catch {
        return []
      }
    }),
    ...sitemaps.map((sitemap) => buildSitemapPath(sitemap)),
  ]

  return createPlan({
    operation: event.operation,
    source: {
      ...event.source,
      id: event.source.id ?? runId,
    },
    subject: {
      kind: 'seed-final-flush',
      runId,
      seedType: event.subject.seedType,
      reset: event.subject.reset,
      terminalStatus: event.subject.terminalStatus,
      affectedCollections: event.subject.affectedCollections,
      affectedGlobals: event.subject.affectedGlobals,
      affectedSurfaces: event.subject.affectedSurfaces,
      affectedSitemaps: event.subject.affectedSitemaps,
      affectedDiscovery: event.subject.affectedDiscovery,
      completedJobCount: event.subject.completedJobCount,
      publicJobCount: event.subject.publicJobCount,
    },
    cacheClasses: ['operational-scaling', 'aggregated-public'],
    surfaceIds: [
      ...surfaces,
      ...sitemaps.map((sitemap) => buildSitemapTag(sitemap)),
      ...discovery.map((discoveryId) => buildDiscoveryTag(discoveryId)),
    ],
    tags,
    paths,
    ...(tags.length === 0 && paths.length === 0 ? { emptyReason: 'seed-final-flush-noop' as const } : {}),
  })
}

const throwDeferred = (event: DeferredRevalidationEvent): never => {
  throw new DeferredRevalidationError(event.area)
}

export const planRevalidation = (event: RevalidationEvent): RevalidationPlan => {
  switch (event.kind) {
    case 'collection':
      return buildCollectionPlan(event)
    case 'global':
      return buildGlobalPlan(event.global, event)
    case 'redirects':
      return buildRedirectPlan(event)
    case 'clinic-surface':
      return buildClinicSurfacePlan(event)
    case 'private-live':
      return buildPrivateLivePlan(event)
    case 'sitemap':
      return buildSitemapPlan(event)
    case 'posts-list':
      return buildPostsListPlan(event)
    case 'public-discovery':
      return buildPublicDiscoveryPlan(event)
    case 'seed-final-flush':
      return buildSeedFinalFlushPlan(event)
    case 'deferred':
      return throwDeferred(event)
    default:
      throw new UnsupportedRevalidationEventError(
        `Unsupported revalidation event kind: ${String((event as { kind?: unknown }).kind)}`,
      )
  }
}

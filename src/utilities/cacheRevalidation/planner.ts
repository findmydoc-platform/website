import {
  buildCollectionTag,
  buildEntityTag,
  buildFixedPublicPath,
  buildGlobalTag,
  buildPagePath,
  buildPostPath,
  buildPostsIndexPath,
  buildSitemapTag,
  buildSlugTag,
  buildSurfaceTag,
  getCachePolicyEntry,
} from '@/utilities/cachePolicy'
import type {
  CollectionRevalidationEvent,
  CoreCollectionRevalidationCollection,
  CoreGlobalRevalidationSlug,
  DeferredRevalidationEvent,
  GlobalRevalidationEvent,
  PrivateLiveRevalidationEvent,
  RedirectRevalidationEvent,
  RevalidationEvent,
  RevalidationLogContext,
  RevalidationPlan,
  RevalidationSource,
  RevalidationSubject,
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
    case 'private-live':
      return buildPrivateLivePlan(event)
    case 'deferred':
      return throwDeferred(event)
    default:
      throw new UnsupportedRevalidationEventError(
        `Unsupported revalidation event kind: ${String((event as { kind?: unknown }).kind)}`,
      )
  }
}

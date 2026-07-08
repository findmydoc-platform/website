export const CACHE_CLASSES = [
  'critical-public',
  'shared-public',
  'aggregated-public',
  'private-live',
  'operational-scaling',
] as const

export type CacheClass = (typeof CACHE_CLASSES)[number]

export const CACHE_TAG_FAMILY_TEMPLATES = [
  'entity:<collection>:<id>',
  'slug:<collection>:<slug>',
  'collection:<collection>',
  'global:<slug>',
  'surface:<name>',
  'surface:sitemap:<name>',
  'surface:discovery:<name>',
] as const

export type CacheTagFamilyTemplate = (typeof CACHE_TAG_FAMILY_TEMPLATES)[number]

export const CACHE_TAG_FAMILIES = [
  'entity',
  'slug',
  'collection',
  'global',
  'surface',
  'surface:sitemap',
  'surface:discovery',
] as const

export type CacheTagFamily = (typeof CACHE_TAG_FAMILIES)[number]

export const CACHE_OPERATIONS = [
  'publish',
  'update',
  'unpublish',
  'delete',
  'slug-change',
  'global-update',
  'related-update',
  'seed-final-flush',
  'preview-read',
] as const

export type CacheOperation = (typeof CACHE_OPERATIONS)[number]

export const CACHE_POLICY_COLLECTIONS = [
  'pages',
  'posts',
  'redirects',
  'clinics',
  'clinictreatments',
  'doctors',
  'doctorspecialties',
  'doctortreatments',
  'reviews',
  'accreditation',
  'clinicMedia',
  'clinicGalleryEntries',
  'clinicGalleryMedia',
  'doctorMedia',
  'platformContentMedia',
  'treatments',
  'medical-specialties',
  'cities',
  'countries',
  'categories',
  'tags',
  'favoriteclinics',
  'patients',
  'basicUsers',
  'platformStaff',
  'clinicApplications',
  'patientClinicInquiries',
  'userProfileMedia',
] as const

export type CachePolicyCollection = (typeof CACHE_POLICY_COLLECTIONS)[number]

export const CACHE_POLICY_GLOBALS = ['header', 'footer', 'landingPages', 'cookieConsent'] as const

export type CachePolicyGlobal = (typeof CACHE_POLICY_GLOBALS)[number]

export const CACHE_SURFACE_IDS = [
  'page-detail',
  'post-detail',
  'posts-list',
  'clinic-detail',
  'home',
  'about',
  'partners-clinics',
  'listing-comparison',
  'contact',
  'clinic-registration',
  'patient-registration',
  'redirects',
  'public-chrome',
  'patient-favorites',
  'auth',
  'admin',
  'preview',
  'cache-visibility',
] as const

export type CacheSurfaceId = (typeof CACHE_SURFACE_IDS)[number]

export const PARAMETERIZED_SURFACE_IDS = ['clinic-detail'] as const

export type ParameterizedSurfaceId = (typeof PARAMETERIZED_SURFACE_IDS)[number]

export const CACHE_SITEMAP_IDS = ['pages', 'posts'] as const

export type CacheSitemapId = (typeof CACHE_SITEMAP_IDS)[number]

export const CACHE_DISCOVERY_IDS = [
  'robots',
  'sitemap-index',
  'llms',
  'well-known-llms',
  'canonical-noindex',
  'structured-data',
] as const

export type CacheDiscoveryId = (typeof CACHE_DISCOVERY_IDS)[number]

export const FIXED_PUBLIC_PATHS = {
  home: '/',
  about: '/about',
  'partners-clinics': '/partners/clinics',
  'listing-comparison': '/listing-comparison',
  contact: '/contact',
  'clinic-registration': '/register/clinic',
  'patient-registration': '/register/patient',
} as const

export const FIXED_PUBLIC_PATH_SURFACE_IDS = Object.keys(FIXED_PUBLIC_PATHS) as FixedPublicPathSurfaceId[]

export type FixedPublicPathSurfaceId = keyof typeof FIXED_PUBLIC_PATHS

export type CachePolicyBoundary = 'public' | 'private' | 'operational'

export type CachePolicyEntryKind = 'public-route' | 'global' | 'collection' | 'discovery' | 'seed-flow' | 'operational'

export type CachePolicyOwner =
  | 'collection-hook'
  | 'global-hook'
  | 'redirect-hook'
  | 'route-owner'
  | 'public-discovery'
  | 'search-indexing'
  | 'seed-runner'
  | 'admin-dashboard'
  | 'auth-owner'
  | 'media-dependency-follow-up'

export type CachePathRelationship =
  | 'path-second'
  | 'tag-first'
  | 'known-paths'
  | 'no-path-invalidation'
  | 'private-live'
  | 'operational-terminal-flush'
  | 'deferred'

export type CachePolicyPathFamily =
  | 'page-detail'
  | 'post-detail'
  | 'posts-index'
  | 'posts-pagination'
  | 'clinic-detail'
  | 'fixed-public-path'
  | 'sitemap'
  | 'discovery'
  | 'none'

export interface CachePolicyCatalogEntry {
  readonly id: string
  readonly kind: CachePolicyEntryKind
  readonly cacheClass: CacheClass
  readonly boundary: CachePolicyBoundary
  readonly owner: CachePolicyOwner
  readonly tagFamilies: readonly CacheTagFamily[]
  readonly pathRelationship: CachePathRelationship
  readonly pathFamilies: readonly CachePolicyPathFamily[]
  readonly collections?: readonly CachePolicyCollection[]
  readonly globals?: readonly CachePolicyGlobal[]
  readonly surfaces?: readonly CacheSurfaceId[]
  readonly sitemapSurfaces?: readonly CacheSitemapId[]
  readonly discoverySurfaces?: readonly CacheDiscoveryId[]
}

export const CACHE_POLICY_CATALOG = [
  {
    id: 'route:pages',
    kind: 'public-route',
    cacheClass: 'critical-public',
    boundary: 'public',
    owner: 'collection-hook',
    tagFamilies: ['entity', 'slug', 'collection', 'surface:sitemap'],
    pathRelationship: 'path-second',
    pathFamilies: ['page-detail'],
    collections: ['pages'],
    sitemapSurfaces: ['pages'],
  },
  {
    id: 'route:posts:detail',
    kind: 'public-route',
    cacheClass: 'critical-public',
    boundary: 'public',
    owner: 'collection-hook',
    tagFamilies: ['entity', 'slug', 'collection', 'surface:sitemap'],
    pathRelationship: 'path-second',
    pathFamilies: ['post-detail'],
    collections: ['posts'],
    sitemapSurfaces: ['posts'],
  },
  {
    id: 'route:posts:list',
    kind: 'public-route',
    cacheClass: 'aggregated-public',
    boundary: 'public',
    owner: 'collection-hook',
    tagFamilies: ['collection', 'surface'],
    pathRelationship: 'tag-first',
    pathFamilies: ['posts-index', 'posts-pagination'],
    collections: ['posts'],
    surfaces: ['posts-list', 'home', 'partners-clinics'],
  },
  {
    id: 'route:clinics:detail',
    kind: 'public-route',
    cacheClass: 'critical-public',
    boundary: 'public',
    owner: 'collection-hook',
    tagFamilies: ['entity', 'slug', 'collection', 'surface'],
    pathRelationship: 'path-second',
    pathFamilies: ['clinic-detail'],
    collections: ['clinics'],
    surfaces: ['clinic-detail'],
  },
  {
    id: 'route:clinic-detail:related-data',
    kind: 'collection',
    cacheClass: 'critical-public',
    boundary: 'public',
    owner: 'collection-hook',
    tagFamilies: ['collection', 'surface'],
    pathRelationship: 'path-second',
    pathFamilies: ['clinic-detail'],
    collections: [
      'clinictreatments',
      'doctors',
      'doctorspecialties',
      'reviews',
      'accreditation',
      'clinicGalleryEntries',
    ],
    surfaces: ['clinic-detail'],
  },
  {
    id: 'route:home',
    kind: 'public-route',
    cacheClass: 'aggregated-public',
    boundary: 'public',
    owner: 'global-hook',
    tagFamilies: ['global', 'collection', 'surface'],
    pathRelationship: 'known-paths',
    pathFamilies: ['fixed-public-path'],
    collections: ['posts', 'medical-specialties', 'cities'],
    globals: ['landingPages'],
    surfaces: ['home'],
  },
  {
    id: 'route:about',
    kind: 'public-route',
    cacheClass: 'aggregated-public',
    boundary: 'public',
    owner: 'global-hook',
    tagFamilies: ['global', 'surface'],
    pathRelationship: 'known-paths',
    pathFamilies: ['fixed-public-path'],
    globals: ['landingPages'],
    surfaces: ['about'],
  },
  {
    id: 'route:partners-clinics',
    kind: 'public-route',
    cacheClass: 'aggregated-public',
    boundary: 'public',
    owner: 'global-hook',
    tagFamilies: ['global', 'collection', 'surface'],
    pathRelationship: 'known-paths',
    pathFamilies: ['fixed-public-path'],
    collections: ['posts', 'medical-specialties', 'treatments'],
    globals: ['landingPages'],
    surfaces: ['partners-clinics'],
  },
  {
    id: 'route:listing-comparison',
    kind: 'public-route',
    cacheClass: 'aggregated-public',
    boundary: 'public',
    owner: 'collection-hook',
    tagFamilies: ['collection', 'surface', 'surface:sitemap'],
    pathRelationship: 'tag-first',
    pathFamilies: ['fixed-public-path'],
    collections: ['clinics', 'clinictreatments', 'reviews', 'treatments', 'medical-specialties', 'cities'],
    surfaces: ['listing-comparison'],
    sitemapSurfaces: ['pages'],
  },
  {
    id: 'route:contact-and-registration',
    kind: 'public-route',
    cacheClass: 'aggregated-public',
    boundary: 'public',
    owner: 'route-owner',
    tagFamilies: ['global', 'surface'],
    pathRelationship: 'known-paths',
    pathFamilies: ['fixed-public-path'],
    surfaces: ['contact', 'clinic-registration', 'patient-registration'],
  },
  {
    id: 'route:patient-favorites-and-auth',
    kind: 'public-route',
    cacheClass: 'private-live',
    boundary: 'private',
    owner: 'auth-owner',
    tagFamilies: [],
    pathRelationship: 'private-live',
    pathFamilies: ['none'],
    collections: ['favoriteclinics', 'patients', 'basicUsers', 'userProfileMedia'],
    surfaces: ['patient-favorites', 'auth'],
  },
  {
    id: 'route:admin-and-preview',
    kind: 'public-route',
    cacheClass: 'private-live',
    boundary: 'private',
    owner: 'auth-owner',
    tagFamilies: [],
    pathRelationship: 'private-live',
    pathFamilies: ['none'],
    surfaces: ['admin', 'preview'],
  },
  {
    id: 'global:header',
    kind: 'global',
    cacheClass: 'shared-public',
    boundary: 'public',
    owner: 'global-hook',
    tagFamilies: ['global', 'surface'],
    pathRelationship: 'tag-first',
    pathFamilies: ['none'],
    globals: ['header'],
    surfaces: ['public-chrome'],
  },
  {
    id: 'global:footer',
    kind: 'global',
    cacheClass: 'shared-public',
    boundary: 'public',
    owner: 'global-hook',
    tagFamilies: ['global', 'surface'],
    pathRelationship: 'tag-first',
    pathFamilies: ['none'],
    globals: ['footer'],
    surfaces: ['public-chrome'],
  },
  {
    id: 'global:landingPages',
    kind: 'global',
    cacheClass: 'aggregated-public',
    boundary: 'public',
    owner: 'global-hook',
    tagFamilies: ['global', 'surface'],
    pathRelationship: 'known-paths',
    pathFamilies: ['fixed-public-path'],
    globals: ['landingPages'],
    surfaces: ['home', 'about', 'partners-clinics'],
  },
  {
    id: 'global:cookieConsent',
    kind: 'global',
    cacheClass: 'shared-public',
    boundary: 'public',
    owner: 'global-hook',
    tagFamilies: ['global', 'surface'],
    pathRelationship: 'tag-first',
    pathFamilies: ['none'],
    globals: ['cookieConsent'],
    surfaces: ['public-chrome'],
  },
  {
    id: 'collection:redirects',
    kind: 'collection',
    cacheClass: 'critical-public',
    boundary: 'public',
    owner: 'redirect-hook',
    tagFamilies: ['collection', 'surface'],
    pathRelationship: 'tag-first',
    pathFamilies: ['none'],
    collections: ['redirects'],
    surfaces: ['redirects'],
  },
  {
    id: 'collection:listing-support',
    kind: 'collection',
    cacheClass: 'aggregated-public',
    boundary: 'public',
    owner: 'collection-hook',
    tagFamilies: ['collection', 'surface'],
    pathRelationship: 'tag-first',
    pathFamilies: ['fixed-public-path'],
    collections: ['treatments', 'medical-specialties', 'cities', 'countries', 'categories', 'tags'],
    surfaces: ['listing-comparison', 'home', 'partners-clinics'],
  },
  {
    id: 'collection:media-inherited',
    kind: 'collection',
    cacheClass: 'critical-public',
    boundary: 'public',
    owner: 'media-dependency-follow-up',
    tagFamilies: ['entity', 'collection'],
    pathRelationship: 'deferred',
    pathFamilies: ['none'],
    collections: ['clinicMedia', 'clinicGalleryMedia', 'doctorMedia', 'platformContentMedia'],
  },
  {
    id: 'collection:private-operational',
    kind: 'collection',
    cacheClass: 'private-live',
    boundary: 'private',
    owner: 'auth-owner',
    tagFamilies: [],
    pathRelationship: 'private-live',
    pathFamilies: ['none'],
    collections: ['platformStaff', 'clinicApplications', 'patientClinicInquiries'],
  },
  {
    id: 'discovery:sitemap:pages',
    kind: 'discovery',
    cacheClass: 'aggregated-public',
    boundary: 'public',
    owner: 'public-discovery',
    tagFamilies: ['surface:sitemap', 'collection', 'surface'],
    pathRelationship: 'tag-first',
    pathFamilies: ['sitemap'],
    sitemapSurfaces: ['pages'],
  },
  {
    id: 'discovery:sitemap:posts',
    kind: 'discovery',
    cacheClass: 'aggregated-public',
    boundary: 'public',
    owner: 'public-discovery',
    tagFamilies: ['surface:sitemap', 'collection'],
    pathRelationship: 'tag-first',
    pathFamilies: ['sitemap'],
    sitemapSurfaces: ['posts'],
  },
  {
    id: 'discovery:robots-and-indexing',
    kind: 'discovery',
    cacheClass: 'critical-public',
    boundary: 'public',
    owner: 'search-indexing',
    tagFamilies: ['surface:discovery'],
    pathRelationship: 'no-path-invalidation',
    pathFamilies: ['discovery'],
    discoverySurfaces: ['robots', 'sitemap-index', 'canonical-noindex', 'structured-data'],
  },
  {
    id: 'discovery:llms',
    kind: 'discovery',
    cacheClass: 'aggregated-public',
    boundary: 'public',
    owner: 'public-discovery',
    tagFamilies: ['surface:discovery'],
    pathRelationship: 'tag-first',
    pathFamilies: ['discovery'],
    discoverySurfaces: ['llms', 'well-known-llms'],
  },
  {
    id: 'seed:queued-runs',
    kind: 'seed-flow',
    cacheClass: 'operational-scaling',
    boundary: 'operational',
    owner: 'seed-runner',
    tagFamilies: ['collection', 'global', 'surface', 'surface:sitemap', 'surface:discovery'],
    pathRelationship: 'operational-terminal-flush',
    pathFamilies: ['none'],
  },
  {
    id: 'seed:baseline',
    kind: 'seed-flow',
    cacheClass: 'operational-scaling',
    boundary: 'operational',
    owner: 'seed-runner',
    tagFamilies: ['collection', 'global', 'surface', 'surface:sitemap', 'surface:discovery'],
    pathRelationship: 'operational-terminal-flush',
    pathFamilies: ['none'],
  },
  {
    id: 'seed:demo',
    kind: 'seed-flow',
    cacheClass: 'operational-scaling',
    boundary: 'operational',
    owner: 'seed-runner',
    tagFamilies: ['collection', 'global', 'surface', 'surface:sitemap', 'surface:discovery'],
    pathRelationship: 'operational-terminal-flush',
    pathFamilies: ['none'],
  },
  {
    id: 'operational:search-sync-suppression',
    kind: 'operational',
    cacheClass: 'operational-scaling',
    boundary: 'operational',
    owner: 'seed-runner',
    tagFamilies: [],
    pathRelationship: 'no-path-invalidation',
    pathFamilies: ['none'],
  },
  {
    id: 'operational:cache-visibility',
    kind: 'operational',
    cacheClass: 'operational-scaling',
    boundary: 'operational',
    owner: 'admin-dashboard',
    tagFamilies: [],
    pathRelationship: 'no-path-invalidation',
    pathFamilies: ['none'],
    surfaces: ['cache-visibility'],
  },
] as const satisfies readonly CachePolicyCatalogEntry[]

const CONTROL_CHARACTERS_PATTERN = /[\u0000-\u001F\u007F]/
const WHITESPACE_PATTERN = /\s/

const assertNonEmptyText = (value: string, label: string): string => {
  const normalized = value.trim()

  if (!normalized) {
    throw new Error(`Invalid ${label}: value must not be empty`)
  }

  return normalized
}

const assertKnownValue = <AllowedValue extends string>(
  value: string,
  allowedValues: readonly AllowedValue[],
  label: string,
): AllowedValue => {
  const normalized = assertCacheToken(value, label)

  if (!allowedValues.includes(normalized as AllowedValue)) {
    throw new Error(`Unknown ${label}: ${normalized}`)
  }

  return normalized as AllowedValue
}

const assertCacheToken = (value: string | number, label: string): string => {
  const normalized = String(value).trim()

  if (!normalized) {
    throw new Error(`Invalid ${label}: value must not be empty`)
  }

  if (CONTROL_CHARACTERS_PATTERN.test(normalized) || WHITESPACE_PATTERN.test(normalized)) {
    throw new Error(`Invalid ${label}: value must not contain whitespace or control characters`)
  }

  if (normalized.includes(':')) {
    throw new Error(`Invalid ${label}: value must not contain ":"`)
  }

  return normalized
}

const assertPayloadSlug = (slug: string, label: string, { allowNested = false }: { allowNested?: boolean } = {}) => {
  const normalized = assertCacheToken(slug, label)

  if (
    normalized.startsWith('/') ||
    normalized.endsWith('/') ||
    normalized.includes('//') ||
    normalized.includes('?') ||
    normalized.includes('#')
  ) {
    throw new Error(`Invalid ${label}: value must be a Payload slug, not a path`)
  }

  if (!allowNested && normalized.includes('/')) {
    throw new Error(`Invalid ${label}: nested slugs are not allowed for this path family`)
  }

  return normalized
}

const assertPositivePageNumber = (page: number): number => {
  if (!Number.isInteger(page) || page < 1) {
    throw new Error('Invalid page: value must be a positive integer')
  }

  return page
}

export const assertKnownCollection = (collection: string): CachePolicyCollection =>
  assertKnownValue(collection, CACHE_POLICY_COLLECTIONS, 'collection')

export const assertKnownGlobal = (global: string): CachePolicyGlobal =>
  assertKnownValue(global, CACHE_POLICY_GLOBALS, 'global')

export const assertKnownSurfaceId = (surfaceId: string): CacheSurfaceId =>
  assertKnownValue(surfaceId, CACHE_SURFACE_IDS, 'surface')

export const assertKnownSitemapId = (sitemapId: string): CacheSitemapId =>
  assertKnownValue(sitemapId, CACHE_SITEMAP_IDS, 'sitemap')

export const assertKnownDiscoveryId = (discoveryId: string): CacheDiscoveryId =>
  assertKnownValue(discoveryId, CACHE_DISCOVERY_IDS, 'discovery surface')

export const getCachePolicyEntry = (id: string): CachePolicyCatalogEntry => {
  const normalizedId = assertNonEmptyText(id, 'policy entry id')
  const entry = CACHE_POLICY_CATALOG.find((candidate) => candidate.id === normalizedId)

  if (!entry) {
    throw new Error(`Unknown policy entry id: ${normalizedId}`)
  }

  return entry
}

export const buildEntityTag = (collection: string, id: string | number): string =>
  `entity:${assertKnownCollection(collection)}:${assertCacheToken(id, 'id')}`

export const buildSlugTag = (collection: string, slug: string): string =>
  `slug:${assertKnownCollection(collection)}:${assertPayloadSlug(slug, 'slug', { allowNested: true })}`

export const buildCollectionTag = (collection: string): string => `collection:${assertKnownCollection(collection)}`

export const buildGlobalTag = (global: string): string => `global:${assertKnownGlobal(global)}`

export const buildSurfaceTag = (surfaceId: string): string => `surface:${assertKnownSurfaceId(surfaceId)}`

export const buildSurfaceInstanceTag = (surfaceId: ParameterizedSurfaceId, id: string | number): string => {
  const normalizedSurface = assertKnownValue(surfaceId, PARAMETERIZED_SURFACE_IDS, 'parameterized surface')

  return `surface:${normalizedSurface}:${assertCacheToken(id, 'surface id')}`
}

export const buildSitemapTag = (sitemapId: string): string => `surface:sitemap:${assertKnownSitemapId(sitemapId)}`

export const buildDiscoveryTag = (discoveryId: string): string =>
  `surface:discovery:${assertKnownDiscoveryId(discoveryId)}`

export const buildPagePath = (slug: string): string => {
  const normalizedSlug = assertPayloadSlug(slug, 'page slug', { allowNested: true })

  if (normalizedSlug === 'home') {
    return '/'
  }

  return `/${normalizedSlug}`
}

export const buildPostPath = (slug: string): string =>
  `/posts/${assertPayloadSlug(slug, 'post slug', { allowNested: false })}`

export const buildClinicPath = (slug: string): string =>
  `/clinics/${assertPayloadSlug(slug, 'clinic slug', { allowNested: false })}`

export const buildPostsIndexPath = (): string => '/posts'

export const buildPostsPaginationPath = (page: number): string => {
  const normalizedPage = assertPositivePageNumber(page)

  return normalizedPage === 1 ? buildPostsIndexPath() : `/posts/page/${normalizedPage}`
}

export const buildFixedPublicPath = (surfaceId: string): string => {
  const normalizedSurfaceId = assertKnownValue(surfaceId, FIXED_PUBLIC_PATH_SURFACE_IDS, 'fixed public surface')

  return FIXED_PUBLIC_PATHS[normalizedSurfaceId]
}

export const buildSitemapPath = (sitemapId: string): string => {
  const normalizedSitemapId = assertKnownSitemapId(sitemapId)

  return `/${normalizedSitemapId}-sitemap.xml`
}

export const buildDiscoveryPath = (discoveryId: string): string => {
  const normalizedDiscoveryId = assertKnownDiscoveryId(discoveryId)

  switch (normalizedDiscoveryId) {
    case 'robots':
      return '/robots.txt'
    case 'sitemap-index':
      return '/sitemap.xml'
    case 'llms':
      return '/llms.txt'
    case 'well-known-llms':
      return '/.well-known/llms.txt'
    case 'canonical-noindex':
    case 'structured-data':
      throw new Error(`Discovery surface does not have a standalone path: ${normalizedDiscoveryId}`)
  }
}

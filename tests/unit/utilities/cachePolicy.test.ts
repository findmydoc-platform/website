import { describe, expect, it } from 'vitest'

import {
  buildClinicPath,
  buildCollectionTag,
  buildDiscoveryPath,
  buildDiscoveryTag,
  buildEntityTag,
  buildFixedPublicPath,
  buildGlobalTag,
  buildPagePath,
  buildPostPath,
  buildPostsIndexPath,
  buildPostsPaginationPath,
  buildSitemapPath,
  buildSitemapTag,
  buildSlugTag,
  buildSurfaceInstanceTag,
  buildSurfaceTag,
  CACHE_CLASSES,
  CACHE_DISCOVERY_IDS,
  CACHE_OPERATIONS,
  CACHE_POLICY_CATALOG,
  CACHE_POLICY_COLLECTIONS,
  CACHE_POLICY_GLOBALS,
  CACHE_SITEMAP_IDS,
  CACHE_SURFACE_IDS,
  CACHE_TAGGABLE_COLLECTIONS,
  CACHE_TAGGABLE_SURFACE_IDS,
  CACHE_TAG_FAMILIES,
  CACHE_TAG_FAMILY_TEMPLATES,
  getCachePolicyEntry,
  type CachePolicyCatalogEntry,
} from '@/utilities/cachePolicy'

describe('cache policy contract', () => {
  it('exposes the accepted ADR 023 cache classes and tag families', () => {
    expect(CACHE_CLASSES).toEqual([
      'critical-public',
      'shared-public',
      'aggregated-public',
      'private-live',
      'operational-scaling',
    ])

    expect(CACHE_TAG_FAMILY_TEMPLATES).toEqual([
      'entity:<collection>:<id>',
      'slug:<collection>:<slug>',
      'collection:<collection>',
      'global:<slug>',
      'surface:<name>',
      'surface:sitemap:<name>',
      'surface:discovery:<name>',
    ])

    expect(CACHE_TAG_FAMILIES).toEqual([
      'entity',
      'slug',
      'collection',
      'global',
      'surface',
      'surface:sitemap',
      'surface:discovery',
    ])
  })

  it('builds canonical cache tags without legacy tag strings', () => {
    const generatedTags = [
      buildEntityTag('posts', 123),
      buildSlugTag('pages', 'medical-tourism/checklist'),
      buildCollectionTag('clinics'),
      buildGlobalTag('landingPages'),
      buildSurfaceTag('listing-comparison'),
      buildSurfaceInstanceTag('clinic-detail', 42),
      buildSitemapTag('pages'),
      buildDiscoveryTag('llms'),
    ]

    expect(generatedTags).toEqual([
      'entity:posts:123',
      'slug:pages:medical-tourism/checklist',
      'collection:clinics',
      'global:landingPages',
      'surface:listing-comparison',
      'surface:clinic-detail:42',
      'surface:sitemap:pages',
      'surface:discovery:llms',
    ])

    expect(generatedTags).not.toContain('global_header')
    expect(generatedTags).not.toContain('global_footer')
    expect(generatedTags).not.toContain('global_landingPages')
    expect(generatedTags).not.toContain('global_cookieConsent')
    expect(generatedTags).not.toContain('pages-sitemap')
    expect(generatedTags).not.toContain('posts-sitemap')
    expect(generatedTags).not.toContain('redirects')
    expect(generatedTags).not.toContain('pages_home')
    expect(generatedTags.every((tag) => tag.includes(':'))).toBe(true)
  })

  it('fails closed before generating cache tags for private-live collections and surfaces', () => {
    const privateCollections = [
      'favoriteclinics',
      'patients',
      'basicUsers',
      'clinicStaff',
      'platformStaff',
      'clinicApplications',
      'patientClinicInquiries',
      'userProfileMedia',
    ]

    const privateSurfaces = ['patient-favorites', 'auth', 'admin', 'preview', 'cache-visibility']

    for (const collection of privateCollections) {
      expect(CACHE_POLICY_COLLECTIONS).toContain(collection)
      expect(CACHE_TAGGABLE_COLLECTIONS).not.toContain(collection)
      expect(() => buildEntityTag(collection, 1)).toThrow(/not public-cache taggable/)
      expect(() => buildCollectionTag(collection)).toThrow(/not public-cache taggable/)
    }

    for (const surface of privateSurfaces) {
      expect(CACHE_SURFACE_IDS).toContain(surface)
      expect(CACHE_TAGGABLE_SURFACE_IDS).not.toContain(surface)
      expect(() => buildSurfaceTag(surface)).toThrow(/not public-cache taggable/)
    }
  })

  it('builds known public route, sitemap, and discovery paths', () => {
    expect(buildPagePath('home')).toBe('/')
    expect(buildPagePath('medical-tourism/checklist')).toBe('/medical-tourism/checklist')
    expect(buildPostPath('clinic-checklist')).toBe('/posts/clinic-checklist')
    expect(buildClinicPath('berlin-health')).toBe('/clinics/berlin-health')
    expect(buildPostsIndexPath()).toBe('/posts')
    expect(buildPostsPaginationPath(1)).toBe('/posts')
    expect(buildPostsPaginationPath(3)).toBe('/posts/page/3')
    expect(buildFixedPublicPath('about')).toBe('/about')
    expect(buildFixedPublicPath('partners-clinics')).toBe('/partners/clinics')
    expect(buildFixedPublicPath('listing-comparison')).toBe('/listing-comparison')
    expect(buildSitemapPath('pages')).toBe('/pages-sitemap.xml')
    expect(buildSitemapPath('posts')).toBe('/posts-sitemap.xml')
    expect(buildDiscoveryPath('robots')).toBe('/robots.txt')
    expect(buildDiscoveryPath('sitemap-index')).toBe('/sitemap.xml')
    expect(buildDiscoveryPath('llms')).toBe('/llms.txt')
    expect(buildDiscoveryPath('well-known-llms')).toBe('/.well-known/llms.txt')
  })

  it('fails fast for invalid ids, slugs, paths, and surface ids', () => {
    expect(() => buildEntityTag('unknown', 1)).toThrow(/Unknown collection/)
    expect(() => buildEntityTag('posts', ' ')).toThrow(/must not be empty/)
    expect(() => buildSlugTag('posts', 'hello world')).toThrow(/whitespace/)
    expect(() => buildSlugTag('posts', 'hello:world')).toThrow(/must not contain ":"/)
    expect(() => buildPagePath('/about')).toThrow(/not a path/)
    expect(() => buildPagePath('about/')).toThrow(/not a path/)
    expect(() => buildPostPath('category/post')).toThrow(/nested slugs/)
    expect(() => buildClinicPath('berlin?draft=1')).toThrow(/not a path/)
    expect(() => buildPostsPaginationPath(0)).toThrow(/positive integer/)
    expect(() => buildPostsPaginationPath(1.5)).toThrow(/positive integer/)
    expect(() => buildFixedPublicPath('unknown')).toThrow(/Unknown fixed public surface/)
    expect(() => buildSurfaceTag('unknown')).toThrow(/Unknown surface/)
    expect(() => buildSitemapTag('unknown')).toThrow(/Unknown sitemap/)
    expect(() => buildDiscoveryTag('unknown')).toThrow(/Unknown discovery surface/)
    expect(() => buildDiscoveryPath('canonical-noindex')).toThrow(/does not have a standalone path/)
  })

  it('keeps operations as vocabulary without planner output', () => {
    expect(CACHE_OPERATIONS).toEqual([
      'publish',
      'update',
      'unpublish',
      'delete',
      'slug-change',
      'global-update',
      'related-update',
      'seed-final-flush',
      'preview-read',
    ])

    expect(CACHE_OPERATIONS.every((operation) => typeof operation === 'string')).toBe(true)
  })

  it('maps the PR1 cache assignment matrix into a machine-readable catalog', () => {
    const expectedEntries = [
      'route:pages',
      'route:posts:detail',
      'route:posts:list',
      'route:clinics:detail',
      'route:clinic-detail:related-data',
      'route:home',
      'route:about',
      'route:partners-clinics',
      'route:listing-comparison',
      'route:contact-and-registration',
      'route:patient-favorites-and-auth',
      'route:admin-and-preview',
      'global:header',
      'global:footer',
      'global:landingPages',
      'global:cookieConsent',
      'collection:redirects',
      'collection:listing-support',
      'collection:media-inherited',
      'collection:private-operational',
      'discovery:sitemap:pages',
      'discovery:sitemap:posts',
      'discovery:robots-and-indexing',
      'discovery:llms',
      'seed:queued-runs',
      'seed:baseline',
      'seed:demo',
      'operational:search-sync-suppression',
      'operational:cache-visibility',
    ]

    expect(CACHE_POLICY_CATALOG.map((entry) => entry.id)).toEqual(expectedEntries)

    expect(getCachePolicyEntry('route:pages')).toMatchObject({
      cacheClass: 'critical-public',
      boundary: 'public',
      owner: 'collection-hook',
      tagFamilies: ['entity', 'slug', 'collection', 'surface:sitemap'],
      pathRelationship: 'path-second',
      pathFamilies: ['page-detail'],
      collections: ['pages'],
      sitemapSurfaces: ['pages'],
    })

    expect(getCachePolicyEntry('route:home')).toMatchObject({
      tagFamilies: ['global', 'collection', 'surface', 'surface:sitemap'],
      surfaces: ['home'],
      sitemapSurfaces: ['pages'],
    })

    expect(getCachePolicyEntry('route:about')).toMatchObject({
      tagFamilies: ['global', 'surface', 'surface:sitemap'],
      surfaces: ['about'],
      sitemapSurfaces: ['pages'],
    })

    expect(getCachePolicyEntry('route:partners-clinics')).toMatchObject({
      tagFamilies: ['global', 'collection', 'surface', 'surface:sitemap'],
      surfaces: ['partners-clinics'],
      sitemapSurfaces: ['pages'],
    })

    expect(getCachePolicyEntry('route:patient-favorites-and-auth')).toMatchObject({
      kind: 'private-route',
      cacheClass: 'private-live',
      boundary: 'private',
      tagFamilies: [],
      pathRelationship: 'private-live',
    })

    expect(getCachePolicyEntry('seed:queued-runs')).toMatchObject({
      cacheClass: 'operational-scaling',
      boundary: 'operational',
      owner: 'seed-runner',
      pathRelationship: 'operational-terminal-flush',
    })
  })

  it('keeps public-route catalog iteration public-only', () => {
    const publicRouteEntries = (CACHE_POLICY_CATALOG as readonly CachePolicyCatalogEntry[]).filter(
      (entry) => entry.kind === 'public-route',
    )

    expect(publicRouteEntries.length).toBeGreaterThan(0)
    expect(publicRouteEntries.every((entry) => entry.boundary === 'public')).toBe(true)
    expect(publicRouteEntries.every((entry) => entry.cacheClass !== 'private-live')).toBe(true)
    expect(publicRouteEntries.map((entry) => entry.id)).not.toContain('route:patient-favorites-and-auth')
    expect(publicRouteEntries.map((entry) => entry.id)).not.toContain('route:admin-and-preview')
  })

  it('keeps every catalog reference inside the exported policy vocabulary', () => {
    const classes = new Set<string>(CACHE_CLASSES)
    const tagFamilies = new Set<string>(CACHE_TAG_FAMILIES)
    const collections = new Set<string>(CACHE_POLICY_COLLECTIONS)
    const globals = new Set<string>(CACHE_POLICY_GLOBALS)
    const surfaces = new Set<string>(CACHE_SURFACE_IDS)
    const sitemapSurfaces = new Set<string>(CACHE_SITEMAP_IDS)
    const discoverySurfaces = new Set<string>(CACHE_DISCOVERY_IDS)

    for (const entry of CACHE_POLICY_CATALOG as readonly CachePolicyCatalogEntry[]) {
      expect(classes.has(entry.cacheClass)).toBe(true)
      expect(entry.tagFamilies.every((family) => tagFamilies.has(family))).toBe(true)
      expect(entry.collections?.every((collection) => collections.has(collection)) ?? true).toBe(true)
      expect(entry.globals?.every((global) => globals.has(global)) ?? true).toBe(true)
      expect(entry.surfaces?.every((surface) => surfaces.has(surface)) ?? true).toBe(true)
      expect(entry.sitemapSurfaces?.every((surface) => sitemapSurfaces.has(surface)) ?? true).toBe(true)
      expect(entry.discoverySurfaces?.every((surface) => discoverySurfaces.has(surface)) ?? true).toBe(true)
    }
  })
})

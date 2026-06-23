import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const routeMocks = vi.hoisted(() => ({
  buildListingComparisonJsonLd: vi.fn(() => [{ '@type': 'ItemList' }]),
  findFavoriteClinicStateRecord: vi.fn(),
  getListingComparisonServerData: vi.fn(),
  getPayload: vi.fn(),
  headers: vi.fn(),
  jsonLdScriptComponent: vi.fn(() => null),
  listingComparisonPageClient: vi.fn(() => null),
  resolveFavoriteClinicAuthContext: vi.fn(),
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('next/headers', () => ({
  headers: routeMocks.headers,
}))

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: routeMocks.getPayload,
  }
})

vi.mock('@/features/favorites/server', () => ({
  findFavoriteClinicStateRecord: routeMocks.findFavoriteClinicStateRecord,
  resolveFavoriteClinicAuthContext: routeMocks.resolveFavoriteClinicAuthContext,
}))

vi.mock('@/utilities/listingComparison/serverData', () => ({
  getListingComparisonServerData: routeMocks.getListingComparisonServerData,
}))

vi.mock('@/app/(frontend)/listing-comparison/ListingComparisonPage.client', () => ({
  ListingComparisonPageClient: routeMocks.listingComparisonPageClient,
}))

vi.mock('@/utilities/structuredData', () => ({
  buildListingComparisonJsonLd: routeMocks.buildListingComparisonJsonLd,
  JsonLdScript: routeMocks.jsonLdScriptComponent,
}))

type ReactNodeLike = React.ReactNode

const findElementByType = (node: ReactNodeLike, type: unknown): React.ReactElement<Record<string, unknown>> | null => {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findElementByType(child, type)
      if (match) {
        return match
      }
    }

    return null
  }

  if (!React.isValidElement(node)) {
    return null
  }

  const element = node as React.ReactElement<{ children?: ReactNodeLike }>

  if (element.type === type) {
    return element as React.ReactElement<Record<string, unknown>>
  }

  return findElementByType(element.props.children, type)
}

function buildListingData() {
  return {
    freshness: {
      sourceCollections: [],
    },
    filterOptions: {
      cities: [],
      waitTimes: [],
      specialties: [],
      treatments: [],
    },
    priceBounds: { min: 0, max: 20000 },
    queryState: {
      page: 1,
      sort: 'rank',
      cities: [],
      treatments: [],
      specialties: [],
      ratingMin: null,
      priceMin: 0,
      priceMax: 20000,
    },
    pagination: {
      page: 1,
      perPage: 24,
      totalPages: 1,
      totalResults: 0,
      totalAvailableResults: 0,
    },
    specialtyContext: {
      selected: [],
      breadcrumbs: [
        { label: 'Home', href: '/' },
        { label: 'Clinics', href: '/listing-comparison' },
      ],
    },
    results: [],
    metrics: {
      verifiedClinics: 0,
      treatmentTypes: 0,
      cities: 0,
      priceEntries: 0,
    },
  }
}

describe('listing comparison page route metadata', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    routeMocks.getPayload.mockResolvedValue({})
    routeMocks.getListingComparisonServerData.mockResolvedValue(buildListingData())
    routeMocks.headers.mockResolvedValue(new Headers())
    routeMocks.resolveFavoriteClinicAuthContext.mockResolvedValue({
      isPatient: false,
      patient: null,
    })
  })

  it('keeps the canonical base route indexable', async () => {
    const pageModule = await import('@/app/(frontend)/listing-comparison/page')

    await expect(
      pageModule.generateMetadata({
        searchParams: Promise.resolve({}),
      }),
    ).resolves.toEqual({
      alternates: {
        canonical: '/listing-comparison',
      },
    })
  })

  it('canonicalizes query variants and marks them noindex, follow', async () => {
    const pageModule = await import('@/app/(frontend)/listing-comparison/page')

    await expect(
      pageModule.generateMetadata({
        searchParams: Promise.resolve({
          city: 'berlin',
        }),
      }),
    ).resolves.toEqual({
      alternates: {
        canonical: '/listing-comparison',
      },
      robots: {
        index: false,
        follow: true,
      },
    })
  })

  it('renders canonical listing comparison JSON-LD from listing server data', async () => {
    const pageModule = await import('@/app/(frontend)/listing-comparison/page')
    const result = await pageModule.default({
      searchParams: Promise.resolve({}),
    })

    expect(routeMocks.buildListingComparisonJsonLd).toHaveBeenCalledWith({
      breadcrumbs: [
        { label: 'Home', href: '/' },
        { label: 'Clinics', href: '/listing-comparison' },
      ],
      clinics: [],
      isCanonicalRoute: true,
    })
    const jsonLdElement = findElementByType(result, routeMocks.jsonLdScriptComponent) as React.ReactElement<{
      data: unknown
    }> | null
    expect(jsonLdElement?.props.data).toEqual([{ '@type': 'ItemList' }])
  })

  it('keeps query variant JSON-LD from emitting a discovery ItemList', async () => {
    const pageModule = await import('@/app/(frontend)/listing-comparison/page')

    await pageModule.default({
      searchParams: Promise.resolve({ city: 'berlin' }),
    })

    expect(routeMocks.buildListingComparisonJsonLd).toHaveBeenCalledWith(
      expect.objectContaining({
        isCanonicalRoute: false,
      }),
    )
  })
})

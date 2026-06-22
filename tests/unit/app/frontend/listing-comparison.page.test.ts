import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const routeMocks = vi.hoisted(() => ({
  breadcrumbJsonLdComponent: vi.fn(() => null),
  findFavoriteClinicStateRecord: vi.fn(),
  getListingComparisonServerData: vi.fn(),
  getPayload: vi.fn(),
  headers: vi.fn(),
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

vi.mock('@/components/molecules/Breadcrumb/BreadcrumbJsonLd', () => ({
  BreadcrumbJsonLd: routeMocks.breadcrumbJsonLdComponent,
}))

vi.mock('@/app/(frontend)/listing-comparison/ListingComparisonPage.client', () => ({
  ListingComparisonPageClient: routeMocks.listingComparisonPageClient,
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

  it('renders BreadcrumbList JSON-LD from listing server breadcrumbs', async () => {
    const pageModule = await import('@/app/(frontend)/listing-comparison/page')
    const result = await pageModule.default({
      searchParams: Promise.resolve({}),
    })

    const breadcrumbJsonLdElement = findElementByType(
      result,
      routeMocks.breadcrumbJsonLdComponent,
    ) as React.ReactElement<{
      items: Array<{ href: string; label: string }>
    }> | null
    expect(breadcrumbJsonLdElement?.props.items).toEqual([
      { label: 'Home', href: '/' },
      { label: 'Clinics', href: '/listing-comparison' },
    ])
  })
})

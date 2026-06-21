import { beforeEach, describe, expect, it, vi } from 'vitest'

const routeMocks = vi.hoisted(() => ({
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

vi.mock('@/app/(frontend)/listing-comparison/ListingComparisonPage.client', () => ({
  ListingComparisonPageClient: routeMocks.listingComparisonPageClient,
}))

describe('listing comparison page route metadata', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
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
})

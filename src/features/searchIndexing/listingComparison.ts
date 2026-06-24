import type { ListingComparisonRawSearchParams } from '@/utilities/listingComparison/queryState'

import { hasRouteSearchParams, NOINDEX_FOLLOW_ROBOTS, type IndexingPolicyResult } from './routePolicies'

export const LISTING_COMPARISON_CANONICAL_PATH = '/listing-comparison'

export function resolveListingComparisonIndexing(
  searchParams?: ListingComparisonRawSearchParams | URLSearchParams | null,
): IndexingPolicyResult {
  if (hasRouteSearchParams(searchParams)) {
    return {
      canonicalPath: LISTING_COMPARISON_CANONICAL_PATH,
      robots: NOINDEX_FOLLOW_ROBOTS,
      reason: 'query-variant',
    }
  }

  return {
    canonicalPath: LISTING_COMPARISON_CANONICAL_PATH,
    reason: 'canonical-route',
  }
}

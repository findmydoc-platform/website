import { LISTING_COMPARISON_PATHS } from '@/i18n/listingComparisonPath'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import type { ListingComparisonRawSearchParams } from '@/utilities/listingComparison/queryState'

import { hasRouteSearchParams, NOINDEX_FOLLOW_ROBOTS, type IndexingPolicyResult } from './routePolicies'

export const LISTING_COMPARISON_CANONICAL_PATH = LISTING_COMPARISON_PATHS.de

export function resolveListingComparisonIndexing(
  searchParams?: ListingComparisonRawSearchParams | URLSearchParams | null,
  locale: UiCopyLocale = 'de',
): IndexingPolicyResult {
  const canonicalPath = locale === 'en' ? LISTING_COMPARISON_PATHS.en : LISTING_COMPARISON_CANONICAL_PATH
  if (hasRouteSearchParams(searchParams)) {
    return {
      canonicalPath,
      robots: NOINDEX_FOLLOW_ROBOTS,
      reason: 'query-variant',
    }
  }

  // Discovery for the English comparison remains disabled during the UI copy rollout.
  if (locale === 'en') return { canonicalPath, robots: NOINDEX_FOLLOW_ROBOTS }

  return {
    canonicalPath,
    reason: 'canonical-route',
  }
}

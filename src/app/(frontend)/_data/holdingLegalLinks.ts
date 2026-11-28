import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import { cache } from 'react'

import { getTemporaryLandingPageContent } from '@/features/temporaryLandingMode/content'
import type { TemporaryLandingLocale } from '@/features/temporaryLandingMode/i18n'
import { resolveHoldingLegalLinks } from '@/features/temporaryLandingMode/navigation'
import { buildSlugTag } from '@/utilities/cachePolicy'
import { findPublishedPageSlugs } from '@/utilities/content/serverData/pages'
import type { ContentLocale } from '@/utilities/contentLocalization'
import { MANAGED_LEGAL_PAGE_SLUGS } from '@/utilities/legalPages'

const getPublishedLegalSlugs = unstable_cache(
  async (locale: ContentLocale) => {
    const payload = await getPayload({ config: configPromise })
    return findPublishedPageSlugs(payload, MANAGED_LEGAL_PAGE_SLUGS, locale)
  },
  ['holding-legal-page-slugs'],
  { tags: MANAGED_LEGAL_PAGE_SLUGS.map((slug) => buildSlugTag('pages', slug)) },
)

export const getHoldingLegalLinks = cache(async (locale: TemporaryLandingLocale) => {
  const [german, english] = await Promise.all([getPublishedLegalSlugs('de'), getPublishedLegalSlugs('en')])
  return resolveHoldingLegalLinks(getTemporaryLandingPageContent(locale).footerLinks, locale, german, english)
})

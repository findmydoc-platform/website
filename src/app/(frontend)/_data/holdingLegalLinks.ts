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

const navigationSlugs = [...MANAGED_LEGAL_PAGE_SLUGS, 'home']

export const getPublishedNavigationPageSlugs = cache(unstable_cache(
  async (locale: ContentLocale) => {
    const payload = await getPayload({ config: configPromise })
    return findPublishedPageSlugs(payload, navigationSlugs, locale)
  },
  ['public-navigation-page-slugs'],
  { tags: navigationSlugs.map((slug) => buildSlugTag('pages', slug)) },
))

export const getHoldingLegalLinks = cache(async (locale: TemporaryLandingLocale) => {
  const [german, english] = await Promise.all([getPublishedNavigationPageSlugs('de'), getPublishedNavigationPageSlugs('en')])
  return resolveHoldingLegalLinks(getTemporaryLandingPageContent(locale).footerLinks, locale, german, english)
})

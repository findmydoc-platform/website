import type { Metadata } from 'next'

import { FormBridgeTemporaryLandingPageAdapter } from '@/features/contactRequests/FormBridgeTemporaryLandingPageAdapter'
import {
  buildTemporaryLandingLanguageOptions,
  getTemporaryLandingPageContent,
  resolveTemporaryLandingContentLocale,
  TEMPORARY_LANDING_PATHS,
  type TemporaryLandingLocale,
} from '@/features/temporaryLandingMode'
import { normalizePost } from '@/utilities/blog/normalizePost'
import { getCachedLatestPosts } from '@/utilities/content/serverData'
import { createSiteMetadata } from '@/utilities/generateMeta'
import { getServerSideURL } from '@/utilities/getURL'

export type HoldingHomeSearchParams = Record<string, string | string[] | undefined>

export async function renderHoldingHome(locale: TemporaryLandingLocale, searchParams?: HoldingHomeSearchParams) {
  const contentLocale = resolveTemporaryLandingContentLocale(locale)
  const posts = await getCachedLatestPosts(3, contentLocale)
  return (
    <FormBridgeTemporaryLandingPageAdapter
      contentLocale={contentLocale}
      locale={locale}
      languageOptions={buildTemporaryLandingLanguageOptions(searchParams)}
      posts={posts.map((post) => normalizePost(post, { contentLocale }))}
    />
  )
}

export function generateHoldingHomeMetadata(locale: TemporaryLandingLocale): Metadata {
  const absolute = (path: string) => new URL(path, getServerSideURL()).href
  const path = TEMPORARY_LANDING_PATHS[locale]
  const { searchSnapshot } = getTemporaryLandingPageContent(locale)
  return {
    ...createSiteMetadata({ title: searchSnapshot.metaTitle, description: searchSnapshot.metaDescription, path }),
    alternates: {
      canonical: absolute(path),
      // The Turkish landing page addresses clinics rather than the same audience as the other variants.
      ...(locale !== 'tr'
        ? {
            languages: {
              de: absolute(TEMPORARY_LANDING_PATHS.de),
              en: absolute(TEMPORARY_LANDING_PATHS.en),
              'x-default': absolute(TEMPORARY_LANDING_PATHS.de),
            },
          }
        : {}),
    },
  }
}

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import { cache } from 'react'

import { findPageBySlug, findPublicPageRoute } from '@/utilities/content/serverData'
import { buildPagePath } from '@/utilities/cachePolicy'
import type { ContentLocale } from '@/utilities/contentLocalization'

const queryPage = cache(async (slug: string, locale: ContentLocale, draft: boolean) => {
  const payload = await getPayload({ config: configPromise })
  if (!draft) return findPublicPageRoute(payload, slug, locale)

  const page = await findPageBySlug(payload, slug, true, { locale, fallbackLocale: false })
  return page ? { page, locale, canonicalPath: buildPagePath(slug, locale), languagePaths: undefined } : null
})

export async function loadPageRoute(pathSegments: string[], previewLocale?: string | string[]) {
  const { isEnabled: draft } = await draftMode()
  const isEnglishPath = pathSegments[0] === 'en'
  const slugSegments = isEnglishPath ? pathSegments.slice(1) : pathSegments
  const locale =
    draft && (previewLocale === 'de' || previewLocale === 'en') ? previewLocale : isEnglishPath ? 'en' : 'de'
  const url = '/' + pathSegments.join('/')
  const route = await queryPage(slugSegments.join('/') || 'home', locale, draft)
  return { route, draft, url }
}

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode, headers } from 'next/headers'
import { cache } from 'react'

import { findPostBySlug, getCachedPublicPostRoute } from '@/utilities/content/serverData'
import { isTemporaryLandingModeRequest } from '@/features/temporaryLandingMode'
import type { ContentLocale } from '@/utilities/contentLocalization'
import { buildPostPath } from '@/utilities/cachePolicy'

export const resolvePost = cache(async (slug: string, pathLocale: ContentLocale, previewLocale: ContentLocale) => {
  const draftPayload = await resolveDraftPayload()
  if (!draftPayload) {
    const route = await getCachedPublicPostRoute(slug, pathLocale)
    return { draft: false, route }
  }

  const post = await findPostBySlug(draftPayload, slug, true, { locale: previewLocale, fallbackLocale: false })
  const route = post?.slug
    ? { post, locale: previewLocale, canonicalPath: buildPostPath(post.slug, previewLocale), languagePaths: undefined }
    : null
  return { draft: true, route }
})

const resolveDraftPayload = async () => {
  const { isEnabled } = await draftMode()

  if (!isEnabled) {
    return null
  }

  const requestHeaders = await headers()

  if (isTemporaryLandingModeRequest(requestHeaders)) {
    return null
  }

  const payload = await getPayload({ config: configPromise })

  try {
    const { user } = await payload.auth({ headers: requestHeaders })

    return user?.collection === 'platformStaff' ? payload : null
  } catch {
    return null
  }
}

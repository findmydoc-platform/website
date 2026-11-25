import {
  appendContentLocaleToPath,
  DEFAULT_CONTENT_LOCALE,
  type ContentLocaleContext,
} from '@/utilities/contentLocalization'
import { buildPostPath as buildCanonicalPostPath } from '@/utilities/cachePolicy'

const POSTS_INDEX_PATH = '/posts'

export const buildPostsIndexPath = (contentLocale?: ContentLocaleContext): string => {
  return appendContentLocaleToPath(POSTS_INDEX_PATH, contentLocale?.locale)
}

export const buildPostPath = (slug: string, contentLocale?: ContentLocaleContext): string =>
  buildCanonicalPostPath(slug, contentLocale?.locale ?? DEFAULT_CONTENT_LOCALE)

export const buildEnglishPostCanonicalPath = (slug: string, availableLegacySlug?: string): string =>
  availableLegacySlug ? buildCanonicalPostPath(availableLegacySlug) : buildCanonicalPostPath(slug, 'en')

export const buildPostsPagePath = (page: number, contentLocale?: ContentLocaleContext): string => {
  if (page <= 1) {
    return buildPostsIndexPath(contentLocale)
  }

  return appendContentLocaleToPath(`${POSTS_INDEX_PATH}/page/${page}`, contentLocale?.locale)
}

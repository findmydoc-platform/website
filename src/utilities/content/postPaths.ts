import { DEFAULT_CONTENT_LOCALE, type ContentLocaleContext } from '@/utilities/contentLocalization'
import {
  buildPostPath as buildCanonicalPostPath,
  buildPostsIndexPath as buildCanonicalPostsIndexPath,
  buildPostsPaginationPath,
} from '@/utilities/cachePolicy'

export const buildPostsIndexPath = (contentLocale?: ContentLocaleContext): string =>
  buildCanonicalPostsIndexPath(contentLocale?.locale)

export const buildPostPath = (slug: string, contentLocale?: ContentLocaleContext): string =>
  buildCanonicalPostPath(slug, contentLocale?.locale ?? DEFAULT_CONTENT_LOCALE)

// A legacy alias must match the persisted slug verbatim for the detail lookup to resolve it.
export function resolveLegacyEnglishPostSlug(slug?: string | null): string | undefined {
  if (!slug || slug.trim() !== slug) return
  try {
    buildCanonicalPostPath(slug)
    return slug
  } catch {
    return
  }
}

export const buildEnglishPostCanonicalPath = (slug: string, availableLegacySlug?: string): string =>
  availableLegacySlug ? buildCanonicalPostPath(availableLegacySlug) : buildCanonicalPostPath(slug, 'en')

export const buildPostsPagePath = (page: number, contentLocale?: ContentLocaleContext): string =>
  buildPostsPaginationPath(page, contentLocale?.locale)

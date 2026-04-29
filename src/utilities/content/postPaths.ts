import { appendContentLocaleToPath, type ContentLocaleContext } from '@/utilities/contentLocalization'

const POSTS_INDEX_PATH = '/posts'

export const buildPostsIndexPath = (contentLocale?: ContentLocaleContext): string => {
  return appendContentLocaleToPath(POSTS_INDEX_PATH, contentLocale?.locale)
}

export const buildPostPath = (slug: string, contentLocale?: ContentLocaleContext): string => {
  return appendContentLocaleToPath(`${POSTS_INDEX_PATH}/${slug}`, contentLocale?.locale)
}

export const buildPostsPagePath = (page: number, contentLocale?: ContentLocaleContext): string => {
  if (page <= 1) {
    return buildPostsIndexPath(contentLocale)
  }

  return appendContentLocaleToPath(`${POSTS_INDEX_PATH}/page/${page}`, contentLocale?.locale)
}

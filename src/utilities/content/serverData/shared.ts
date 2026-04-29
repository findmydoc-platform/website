import type { Where } from 'payload'
import { DEFAULT_CONTENT_LOCALE, type ContentLocaleContext } from '@/utilities/contentLocalization'

export type PagedResult<T> = {
  docs: T[]
  page?: number
  totalDocs?: number
  totalPages?: number
}

export type PaginatedResult<T> = {
  docs: T[]
  page?: number
  totalDocs: number
  totalPages: number
}

export type LocalizedDocQuery = ContentLocaleContext

export const PUBLISHED_WHERE: Where = {
  _status: {
    equals: 'published',
  },
}

export function buildLocalizedQueryOptions(contentLocale?: LocalizedDocQuery): LocalizedDocQuery {
  if (!contentLocale?.locale) {
    return {}
  }

  return {
    locale: contentLocale.locale,
    fallbackLocale: contentLocale.fallbackLocale ?? DEFAULT_CONTENT_LOCALE,
  }
}

export function mergePublishedWhere(where?: Where, draft = false): Where | undefined {
  if (draft) {
    return where
  }

  if (!where) {
    return PUBLISHED_WHERE
  }

  return {
    and: [PUBLISHED_WHERE, where],
  }
}

import type { Where } from 'payload'
import type { ContentLocaleContext } from '@/utilities/contentLocalization'

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

const PUBLISHED_WHERE: Where = {
  _status: {
    equals: 'published',
  },
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

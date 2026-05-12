import { PREVIEW_GUARD_LOCK_REQUEST_HEADER } from '@/features/previewGuard'
import { resolveRuntimeClass } from '@/features/runtimePolicy'

export type SearchIndexingEnvInput = {
  DEPLOYMENT_ENV?: string
  NODE_ENV?: string
  VERCEL_ENV?: string
}

export const SEARCH_ROBOTS_HEADER = 'X-Robots-Tag'
export const SEARCH_ROBOTS_HEADER_VALUE = 'noindex, nofollow, noarchive'

export const shouldBlockSearchIndexing = (env: SearchIndexingEnvInput = process.env): boolean => {
  return resolveRuntimeClass(env) === 'preview'
}

export const shouldBlockSearchIndexingForRequest = ({
  env = process.env,
  headers,
}: {
  env?: SearchIndexingEnvInput
  headers: Headers
}): boolean => {
  return headers.get(PREVIEW_GUARD_LOCK_REQUEST_HEADER) === '1' || shouldBlockSearchIndexing(env)
}

import { resolveRuntimeClass } from '@/features/runtimePolicy'
import { isTemporaryLandingModeEnabled } from '@/features/temporaryLandingMode'

type SearchIndexingEnvInput = {
  DEPLOYMENT_ENV?: string
  NODE_ENV?: string
  TEMPORARY_LANDING_MODE_ENABLED?: string
  VERCEL_ENV?: string
}

export const SEARCH_ROBOTS_HEADER = 'X-Robots-Tag'
export const SEARCH_ROBOTS_HEADER_VALUE = 'noindex, nofollow, noarchive'

export const shouldBlockSearchIndexing = (env: SearchIndexingEnvInput = process.env): boolean => {
  return resolveRuntimeClass(env) === 'preview' || isTemporaryLandingModeEnabled(env)
}

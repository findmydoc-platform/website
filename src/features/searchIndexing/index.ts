import { isPreviewRuntime } from '@/features/runtimePolicy'
import { readHoldingViewRequestHeader } from '@/features/temporaryLandingMode'

export type SearchIndexingEnvInput = {
  DEPLOYMENT_ENVIRONMENT?: string
  NODE_ENV?: string
  VERCEL_ENV?: string
}

export const SEARCH_ROBOTS_HEADER = 'X-Robots-Tag'
export const SEARCH_ROBOTS_HEADER_VALUE = 'noindex, nofollow, noarchive'

export const shouldBlockSearchIndexing = (env: SearchIndexingEnvInput = process.env): boolean => {
  return isPreviewRuntime(env)
}

export const shouldBlockSearchIndexingForRequest = ({
  env = process.env,
  headers,
}: {
  env?: SearchIndexingEnvInput
  headers: Headers
}): boolean => {
  return readHoldingViewRequestHeader(headers) === 'standalone' || shouldBlockSearchIndexing(env)
}

export * from './listingComparison'
export * from './metadata'
export * from './routePolicies'

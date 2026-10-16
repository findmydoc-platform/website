import {
  SEARCH_ROBOTS_HEADER,
  SEARCH_ROBOTS_HEADER_VALUE,
  shouldBlockSearchIndexing,
  type SearchIndexingEnvInput,
} from '@/features/searchIndexing'
import { isTemporaryLandingPublicDiscoveryPath, readPublicSiteModeRequestHeader } from '@/features/temporaryLandingMode'
import { resolveHoldingMode } from '@/features/temporaryLandingMode/resolver'

export type PublicDiscoveryBlockReason = 'preview-runtime' | 'temporary-landing-mode'

export type PublicDiscoveryAccess =
  | {
      allowed: true
      temporaryLandingMode?: true
    }
  | {
      allowed: false
      reason: PublicDiscoveryBlockReason
    }

const resolvePublicDiscoveryAccessForRuntime = (env: SearchIndexingEnvInput = process.env): PublicDiscoveryAccess => {
  if (shouldBlockSearchIndexing(env)) {
    return {
      allowed: false,
      reason: 'preview-runtime',
    }
  }

  return {
    allowed: true,
  }
}

export const resolvePublicDiscoveryAccessForRequest = async (
  request: Request,
  env: SearchIndexingEnvInput & Partial<Pick<NodeJS.ProcessEnv, 'PUBLIC_SITE_FALLBACK_MODE'>> = process.env,
): Promise<PublicDiscoveryAccess> => {
  const runtimeAccess = resolvePublicDiscoveryAccessForRuntime(env)
  if (!runtimeAccess.allowed) return runtimeAccess

  const requestMode = readPublicSiteModeRequestHeader(request.headers)
  const mode =
    requestMode ??
    (
      await resolveHoldingMode(new URL(request.url), {
        PUBLIC_SITE_FALLBACK_MODE: env.PUBLIC_SITE_FALLBACK_MODE,
      })
    ).mode

  if (mode === 'holding') {
    if (isTemporaryLandingPublicDiscoveryPath(new URL(request.url).pathname)) {
      return {
        allowed: true,
        temporaryLandingMode: true,
      }
    }

    return {
      allowed: false,
      reason: 'temporary-landing-mode',
    }
  }

  return {
    allowed: true,
  }
}

export const buildPublicDiscoveryBlockedResponse = (init: ResponseInit = {}): Response => {
  const headers = new Headers(init.headers)
  headers.set(SEARCH_ROBOTS_HEADER, SEARCH_ROBOTS_HEADER_VALUE)

  return new Response(null, {
    ...init,
    headers,
    status: init.status ?? 404,
  })
}

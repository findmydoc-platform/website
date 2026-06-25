import { createPostHogFlagEvaluationContext, evaluatePostHogFlags, resolvePostHogSiteFlagActor } from '@/posthog/api'
import {
  SEARCH_ROBOTS_HEADER,
  SEARCH_ROBOTS_HEADER_VALUE,
  shouldBlockSearchIndexing,
  type SearchIndexingEnvInput,
} from '@/features/searchIndexing'

export type PublicDiscoveryBlockReason = 'preview-runtime' | 'temporary-landing-mode'

export type PublicDiscoveryAccess =
  | {
      allowed: true
    }
  | {
      allowed: false
      reason: PublicDiscoveryBlockReason
    }

export const PUBLIC_DISCOVERY_BLOCK_HEADERS = {
  [SEARCH_ROBOTS_HEADER]: SEARCH_ROBOTS_HEADER_VALUE,
} as const

export const resolvePublicDiscoveryAccessForRuntime = (
  env: SearchIndexingEnvInput = process.env,
): PublicDiscoveryAccess => {
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
  env: SearchIndexingEnvInput = process.env,
): Promise<PublicDiscoveryAccess> => {
  const runtimeAccess = resolvePublicDiscoveryAccessForRuntime(env)
  if (!runtimeAccess.allowed) return runtimeAccess

  const context = createPostHogFlagEvaluationContext({
    url: new URL(request.url),
  })
  const actor = resolvePostHogSiteFlagActor(context)
  const flags = await evaluatePostHogFlags(actor, ['temporary-landing-mode'], {
    context,
  })

  if (flags.isEnabled('temporary-landing-mode')) {
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

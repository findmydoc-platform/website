import { resolveCmsRequest } from '@/app/(frontend)/_data/resolveCmsRequest'
import { SEARCH_ROBOTS_HEADER, SEARCH_ROBOTS_HEADER_VALUE } from '@/features/searchIndexing'
import { isTemporaryLandingIndexablePath } from '@/features/temporaryLandingMode'
import { parseCmsRedirectPath } from '@/utilities/content/cmsRedirectPaths'
import { isCmsRedirectRequestAuthorized } from '@/utilities/routing/cmsRedirectRequest'

const headers = {
  'Cache-Control': 'private, no-store',
  [SEARCH_ROBOTS_HEADER]: SEARCH_ROBOTS_HEADER_VALUE,
}

export async function POST(request: Request): Promise<Response> {
  if (!isCmsRedirectRequestAuthorized(request)) return new Response(null, { status: 404, headers })

  try {
    const input = (await request.json()) as { pathname?: unknown; holding?: unknown } | null
    if (typeof input?.pathname !== 'string' || typeof input.holding !== 'boolean') {
      return new Response(null, { status: 400, headers })
    }

    const { pathname, holding } = input
    const source = parseCmsRedirectPath(pathname)
    if (!source || (holding && !isTemporaryLandingIndexablePath(pathname))) {
      return new Response(null, { status: 204, headers })
    }

    const result = await resolveCmsRequest(pathname, source, holding)
    return result ? Response.json(result, { headers }) : new Response(null, { status: 204, headers })
  } catch {
    return new Response(null, { status: 503, headers })
  }
}

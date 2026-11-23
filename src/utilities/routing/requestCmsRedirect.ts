import type { NextRequest } from 'next/server'

import { resolveServerRuntimeEnvironment } from '@/features/runtimePolicy'
import { getServerSideURL } from '@/utilities/getURL'
import { parseCmsRedirectPath, type CmsRedirectSource } from '@/utilities/content/cmsRedirectPaths'
import { fallbackConsoleLogger } from '@/utilities/logging/consoleLogger'
import { CMS_REDIRECT_RESOLVER_PATH, cmsRedirectRequestToken } from './cmsRedirectRequest'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
const REDIRECT_LOOKUP_TIMEOUT_MS = 1000

function resolveLookupOrigin(request: NextRequest, deploymentHost?: string): URL | null {
  if (deploymentHost) {
    const deployment = new URL(`https://${deploymentHost}`)
    return deployment.hostname.endsWith('.vercel.app') ? deployment : null
  }

  if (process.env.VERCEL === '1') return null

  const runtime = resolveServerRuntimeEnvironment()
  const isLocalRuntime = runtime === 'development' || runtime === 'test'
  const port = Number(process.env.PORT)
  if (
    isLocalRuntime &&
    LOOPBACK_HOSTS.has(request.nextUrl.hostname) &&
    Number.isInteger(port) &&
    port > 0 &&
    port <= 65535
  ) {
    return new URL(`http://localhost:${port}`)
  }

  const configured = new URL(getServerSideURL())
  const isLoopback = configured.protocol === 'http:' && LOOPBACK_HOSTS.has(configured.hostname)
  return configured.protocol === 'https:' || (isLocalRuntime && isLoopback) ? configured : null
}

export async function requestCmsRedirect(
  request: NextRequest,
  source: CmsRedirectSource,
  holding: boolean,
): Promise<string | null> {
  const token = cmsRedirectRequestToken()
  if (!token) return null

  try {
    const deploymentHost = process.env.VERCEL_URL
    const origin = resolveLookupOrigin(request, deploymentHost)
    if (!origin) return null

    const headers = new Headers({
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    })
    const deploymentToken = deploymentHost && request.headers.get('x-vercel-oidc-token')
    if (deploymentToken) headers.set('x-vercel-trusted-oidc-idp-token', deploymentToken)

    const { pathname } = request.nextUrl
    const response = await fetch(new URL(CMS_REDIRECT_RESOLVER_PATH, origin), {
      method: 'POST',
      body: JSON.stringify({ pathname, holding }),
      cache: 'no-store',
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(REDIRECT_LOOKUP_TIMEOUT_MS),
    })
    if (response.status === 204) return null
    if (!response.ok) throw new Error('CMS redirect lookup failed')

    const destination = await response.text()
    const target = parseCmsRedirectPath(destination)
    return destination !== pathname && target?.locale === source.locale && target.collection === source.collection
      ? destination
      : null
  } catch {
    fallbackConsoleLogger.warn(
      { event: 'cms_permanent_redirect.lookup_failed' },
      'CMS permanent redirects are temporarily unavailable',
    )
    return null
  }
}

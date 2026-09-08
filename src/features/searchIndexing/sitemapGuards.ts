import { resolvePublicDiscoveryAccessForRequest } from '@/features/publicDiscovery/access'
import type { SearchIndexingEnvInput } from './index'

export const resolveSitemapIndexingAccessForRequest = (request: Request, env: SearchIndexingEnvInput = process.env) =>
  resolvePublicDiscoveryAccessForRequest(request, env)

export async function shouldBlockSitemapIndexingForRequest(
  request: Request,
  env: SearchIndexingEnvInput = process.env,
): Promise<boolean> {
  const access = await resolveSitemapIndexingAccessForRequest(request, env)
  return !access.allowed
}

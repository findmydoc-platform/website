import { resolvePublicDiscoveryAccessForRequest } from '@/features/publicDiscovery/access'
import type { SearchIndexingEnvInput } from './index'

export async function shouldBlockSitemapIndexingForRequest(
  request: Request,
  env: SearchIndexingEnvInput = process.env,
): Promise<boolean> {
  const access = await resolvePublicDiscoveryAccessForRequest(request, env)
  return !access.allowed
}

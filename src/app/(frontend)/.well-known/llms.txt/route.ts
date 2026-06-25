import { resolvePublicDiscoveryAccessForRequest } from '@/features/publicDiscovery/access'
import { buildLlmsTxtResponse } from '@/features/publicDiscovery/llmsTxt'

export async function GET(request: Request): Promise<Response> {
  const access = await resolvePublicDiscoveryAccessForRequest(request)
  return buildLlmsTxtResponse(access)
}

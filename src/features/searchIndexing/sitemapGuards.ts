import { createPostHogFlagEvaluationContext, evaluatePostHogFlags, resolvePostHogSiteFlagActor } from '@/posthog/api'
import { shouldBlockSearchIndexing, type SearchIndexingEnvInput } from './index'

export async function shouldBlockSitemapIndexingForRequest(
  request: Request,
  env: SearchIndexingEnvInput = process.env,
): Promise<boolean> {
  if (shouldBlockSearchIndexing(env)) return true

  const context = createPostHogFlagEvaluationContext({
    url: new URL(request.url),
  })
  const actor = resolvePostHogSiteFlagActor(context)
  const flags = await evaluatePostHogFlags(actor, ['temporary-landing-mode'], {
    context,
  })

  return flags.isEnabled('temporary-landing-mode')
}

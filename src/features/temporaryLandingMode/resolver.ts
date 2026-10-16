import {
  createPostHogHoldingEvaluationContext,
  evaluatePostHogFlags,
  resolvePostHogHoldingFlagActor,
  type PostHogFlagEvaluation,
} from '@/posthog/api'
import { fallbackConsoleLogger } from '@/utilities/logging/consoleLogger'
import { createScopedLogger } from '@/utilities/logging/shared'

export type PublicSiteMode = 'full' | 'holding'

export type HoldingModeFallbackReason =
  | 'error'
  | 'invalid'
  | 'invalid-fallback-configuration'
  | 'invalid-output'
  | 'missing'
  | 'missing-fallback-configuration'
  | 'not-configured'
  | 'unsupported-runtime'

export type HoldingModeDecision =
  | { mode: PublicSiteMode; source: 'posthog' }
  | { mode: PublicSiteMode; reason: HoldingModeFallbackReason; source: 'deployment-fallback' }

type HoldingModeEnvironment = Record<string, string | undefined>

const FALLBACK_FLAG_KEY = 'temporary-landing-mode' as const
const logger = createScopedLogger(fallbackConsoleLogger, {
  component: 'temporary-landing-mode',
  scope: 'public-site.mode',
})

const resolveFallback = (env: HoldingModeEnvironment, reason: HoldingModeFallbackReason): HoldingModeDecision => {
  const configuredMode = env.PUBLIC_SITE_FALLBACK_MODE?.trim()
  const validMode = configuredMode === 'holding' || configuredMode === 'full'
  const mode: PublicSiteMode = validMode ? configuredMode : 'holding'
  const fallbackReason = !configuredMode
    ? 'missing-fallback-configuration'
    : validMode
      ? reason
      : 'invalid-fallback-configuration'

  logger.warn(
    {
      event: 'public_site.mode_fallback',
      mode,
      reason: fallbackReason,
      source: 'deployment-fallback',
    },
    'Public site mode uses deployment fallback',
  )

  return {
    mode,
    reason: fallbackReason,
    source: 'deployment-fallback',
  }
}

const resolveEvaluation = (evaluation: PostHogFlagEvaluation): HoldingModeDecision | null => {
  if (evaluation.status === 'unavailable') return null
  if (typeof evaluation.value !== 'boolean') return null

  return {
    mode: evaluation.value ? 'holding' : 'full',
    source: 'posthog',
  }
}

export const resolveHoldingMode = async (
  url: Pick<URL, 'hostname' | 'href' | 'pathname'>,
  env: HoldingModeEnvironment = process.env,
): Promise<HoldingModeDecision> => {
  const context = createPostHogHoldingEvaluationContext({ url })
  const actor = resolvePostHogHoldingFlagActor(context)

  try {
    const flags = await evaluatePostHogFlags(actor, [FALLBACK_FLAG_KEY], { context })
    const decision = resolveEvaluation(flags.getEvaluation(FALLBACK_FLAG_KEY))
    if (decision) return decision

    const evaluation = flags.getEvaluation(FALLBACK_FLAG_KEY)
    const reason = evaluation.status === 'unavailable' ? evaluation.reason : 'invalid-output'
    return resolveFallback(env, reason)
  } catch {
    return resolveFallback(env, 'error')
  }
}

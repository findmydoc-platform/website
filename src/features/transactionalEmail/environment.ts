import { TransactionalEmailError } from './errors'
import { resolveHostedLettermintBinding } from './hostedConfiguration'
import registry from './lettermintRegistry.json' with { type: 'json' }
import targetLocks from './lettermintTargetLocks.json' with { type: 'json' }
import activationRegistry from './activationRegistry.json' with { type: 'json' }
import { resolveActivationPolicy } from './activationPolicy'

export type EmailEnvironment = 'local' | 'test' | 'ci' | 'preview' | 'production'

function classifyEnvironment(env: Record<string, string | undefined>): EmailEnvironment {
  if (env.VERCEL_ENV?.trim() && env.DEPLOYMENT_ENV?.trim() && env.VERCEL_ENV.trim() !== env.DEPLOYMENT_ENV.trim())
    throw new TransactionalEmailError('environment-unavailable')
  const configured = env.VERCEL_ENV?.trim() || env.DEPLOYMENT_ENV?.trim()
  if (configured === 'preview' || configured === 'production') {
    if (env.CI === 'true' || env.NODE_ENV === 'test') throw new TransactionalEmailError('environment-unavailable')
    return configured
  }
  if (Object.keys(env).some((key) => key.startsWith('LETTERMINT_'))) {
    throw new TransactionalEmailError('environment-unavailable')
  }
  if (configured && !['local', 'development', 'test', 'ci'].includes(configured)) {
    throw new TransactionalEmailError('environment-unavailable')
  }
  let environment: EmailEnvironment
  if (env.CI === 'true' || configured === 'ci') environment = 'ci'
  else if (env.NODE_ENV === 'test' || configured === 'test') environment = 'test'
  else if (env.NODE_ENV === 'production' || env.VERCEL === '1') {
    throw new TransactionalEmailError('environment-unavailable')
  } else environment = 'local'
  return environment
}

function resolveStartup(
  env: Record<string, string | undefined> = process.env,
  registryInput: unknown = registry,
  lockedTargets: unknown = targetLocks,
  now = Date.now(),
  activationInput: unknown = activationRegistry,
) {
  const environment = classifyEnvironment(env)
  if (environment === 'preview' || environment === 'production') {
    const binding = resolveHostedLettermintBinding(environment, registryInput, env, now, lockedTargets)
    let previewRecipients: unknown
    if (environment === 'preview') {
      try {
        previewRecipients = JSON.parse(env.LETTERMINT_PREVIEW_RECIPIENT_DIGESTS ?? '[]')
      } catch {
        throw new TransactionalEmailError('environment-unavailable')
      }
    }
    return { environment, activationPolicy: resolveActivationPolicy(binding, activationInput, previewRecipients) }
  }
  return { environment, activationPolicy: Object.freeze({ evaluate: () => null }) }
}

export function validateTransactionalEmailStartup(...args: Parameters<typeof resolveStartup>) {
  const { environment } = resolveStartup(...args)
  return { environment }
}

export function selectTransactionalEmailRuntime(env: Record<string, string | undefined> = process.env) {
  const { environment, activationPolicy } = resolveStartup(env)
  if (environment === 'preview' || environment === 'production') {
    // Hosted delivery remains unavailable until suppression and product preparation are integrated.
    throw new TransactionalEmailError('environment-unavailable')
  }
  return { environment, delivery: 'fake', links: 'fake', activationPolicy } as const
}

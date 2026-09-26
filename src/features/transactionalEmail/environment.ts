import { TransactionalEmailError } from './errors'
import { resolveHostedLettermintBinding } from './hostedConfiguration'
import registry from './lettermintRegistry.json' with { type: 'json' }
import targetLocks from './lettermintTargetLocks.json' with { type: 'json' }

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

export function validateTransactionalEmailStartup(
  env: Record<string, string | undefined> = process.env,
  registryInput: unknown = registry,
  lockedTargets: unknown = targetLocks,
  now = Date.now(),
) {
  const environment = classifyEnvironment(env)
  if (environment === 'preview' || environment === 'production') {
    resolveHostedLettermintBinding(environment, registryInput, env, now, lockedTargets)
  }
  return { environment }
}

export function selectTransactionalEmailRuntime(env: Record<string, string | undefined> = process.env) {
  const { environment } = validateTransactionalEmailStartup(env)
  if (environment === 'preview' || environment === 'production') {
    // The real adapter and signature verifier are installed by later delivery-edge issues.
    throw new TransactionalEmailError('environment-unavailable')
  }
  return { environment, delivery: 'fake', links: 'fake' } as const
}

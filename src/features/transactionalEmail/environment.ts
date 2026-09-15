import { TransactionalEmailError } from './errors'

export type EmailEnvironment = 'local' | 'test' | 'ci' | 'preview' | 'production'

export function selectTransactionalEmailRuntime(env: NodeJS.ProcessEnv = process.env) {
  const configured = env.VERCEL_ENV?.trim() || env.DEPLOYMENT_ENV?.trim()
  // Hosted deployment signals take precedence over test/CI flags; missing real adapters always fail closed.
  if (
    [env.VERCEL_ENV?.trim(), env.DEPLOYMENT_ENV?.trim()].some((value) => value === 'preview' || value === 'production')
  ) {
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
  return { environment, delivery: 'fake', links: 'fake' } as const
}

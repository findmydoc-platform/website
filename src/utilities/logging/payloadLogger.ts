import { defaultLoggerOptions } from 'payload'
import type { Config } from 'payload'
import { getDeploymentEnv, isLogLevel } from './shared'

const REDACT_PATHS = [
  'password',
  'secret',
  'token',
  'accessToken',
  'refreshToken',
  'headers.authorization',
  'headers.cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  'request.headers.authorization',
  'request.headers.cookie',
  'secretAccessKey',
  'serviceRoleKey',
] as const

const resolveFallbackLevel = (env: Partial<NodeJS.ProcessEnv>): 'error' | 'info' | 'warn' => {
  const deploymentEnv = getDeploymentEnv(env)

  if (deploymentEnv === 'test') return 'error'
  if (deploymentEnv === 'preview') return 'info'
  if (deploymentEnv === 'production') return 'warn'
  if (deploymentEnv === 'development') return 'info'

  return 'error'
}

const resolveLogLevel = (env: Partial<NodeJS.ProcessEnv>) => {
  const configuredLevel = env.PAYLOAD_LOG_LEVEL?.trim().toLowerCase()
  if (isLogLevel(configuredLevel)) {
    return configuredLevel
  }

  return resolveFallbackLevel(env)
}

export const createPayloadLoggerConfig = (
  env: Partial<NodeJS.ProcessEnv> = process.env,
): NonNullable<Config['logger']> => {
  const deploymentEnv = getDeploymentEnv(env)
  const options = {
    level: resolveLogLevel(env),
    messageKey: 'msg',
    name: 'findmydoc',
    redact: {
      paths: [...REDACT_PATHS],
      remove: true,
    },
    base: {
      deploymentEnv,
    },
  }

  if (deploymentEnv === 'development') {
    return {
      destination: defaultLoggerOptions,
      options,
    }
  }

  return { options }
}

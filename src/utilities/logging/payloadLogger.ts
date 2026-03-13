import { defaultLoggerOptions } from 'payload'
import type { Config } from 'payload'
import { resolveRuntimeClass, resolveServerRuntimeEnvironment, RUNTIME_POLICY } from '@/features/runtimePolicy'

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

const resolveLogLevel = (env: Partial<NodeJS.ProcessEnv>): 'error' | 'info' | 'warn' => {
  const deploymentEnv = resolveServerRuntimeEnvironment(env)
  if (deploymentEnv === 'test') return 'error'

  const runtimeClass = resolveRuntimeClass(env)
  return RUNTIME_POLICY[runtimeClass].logging.defaultLevel
}

export const createPayloadLoggerConfig = (
  env: Partial<NodeJS.ProcessEnv> = process.env,
): NonNullable<Config['logger']> => {
  const deploymentEnv = resolveServerRuntimeEnvironment(env)
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
